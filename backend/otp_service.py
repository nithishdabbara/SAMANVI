"""Server-side one-time-password (OTP) service.

Guarantees
  * OTPs are generated with ``secrets`` (CSPRNG) and stored only as an HMAC-SHA256 digest.
  * Every challenge expires (OTP_TTL_SECONDS), is single-use, and locks after OTP_MAX_ATTEMPTS
    wrong guesses.  Sends are throttled per phone (cooldown + daily cap).
  * There is no master code and no bypass.  An OTP is "verified" only when the stored digest
    matches the submitted code for an unexpired, unused, unlocked challenge.
  * The code is returned in an API response ONLY in an explicit local-development mode
    (APP_ENV=development, ALLOW_DEV_OTP=true, ENABLE_LIVE_SMS=false).  It is refused in production.
  * A successful verification yields a short-lived, single-use, purpose-bound token that other
    endpoints (login-with-otp, reset-password, registration) must present.
"""
import datetime
import hashlib
import hmac
import logging
import os
import re
import secrets

import jwt
import requests
from psycopg2.extras import RealDictCursor

log = logging.getLogger("samanvi.otp")

OTP_LENGTH = 6
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "25"))
OTP_MAX_SENDS_PER_DAY = int(os.getenv("OTP_MAX_SENDS_PER_DAY", "5"))
VERIFICATION_TOKEN_TTL_SECONDS = 15 * 60

PURPOSES = ("register", "login", "password_reset")
CHANNELS = ("sms", "whatsapp")
_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


class OtpError(Exception):
    """An error that is safe to show to the client."""

    def __init__(self, code, message, status=400, extra=None):
        super().__init__(message)
        self.code, self.message, self.status, self.extra = code, message, status, extra or {}

    def to_response(self):
        body = {"error": self.message, "code": self.code}
        body.update(self.extra)
        return body, self.status


# ----------------------------------------------------------------- configuration helpers
def is_production():
    return os.getenv("APP_ENV", "production").strip().lower() in ("production", "prod")


def _truthy(name, default="false"):
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes")


def sms_live():
    return _truthy("ENABLE_LIVE_SMS")


def dev_otp_allowed():
    """Testing fallback: Enabled if live SMS is off."""
    return not sms_live()


def _hmac_key():
    explicit = os.getenv("OTP_HMAC_KEY")
    if explicit:
        return explicit.encode()
    base = os.getenv("JWT_SECRET_KEY", "")
    if not base:
        raise RuntimeError("JWT_SECRET_KEY must be configured before OTPs can be issued")
    return hmac.new(base.encode(), b"samanvi-otp-v1", hashlib.sha256).digest()


def jwt_key():
    key = os.getenv("JWT_SECRET_KEY", "")
    if not key:
        raise RuntimeError("JWT_SECRET_KEY must be configured")
    return key


# ----------------------------------------------------------------- primitives
def normalize_phone(raw):
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not _PHONE_RE.match(digits):
        raise OtpError("invalid_phone", "Enter a valid 10-digit Indian mobile number", 400)
    return digits


def mask_phone(phone):
    return f"{'*' * 6}{phone[-4:]}" if phone else ""


def generate_otp():
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(otp, phone, purpose):
    msg = f"{purpose}:{phone}:{otp}".encode()
    return hmac.new(_hmac_key(), msg, hashlib.sha256).hexdigest()


# ----------------------------------------------------------------- challenges
def create_challenge(conn, phone, purpose, channel="sms"):
    """Create a fresh challenge (superseding older open ones).  Returns (challenge_id, otp)."""
    if purpose not in PURPOSES:
        raise OtpError("invalid_purpose", "Unsupported OTP purpose", 400)
    if channel not in CHANNELS:
        raise OtpError("invalid_channel", "Unsupported OTP channel", 400)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """SELECT COUNT(*) AS n,
                      COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(created_at))), 1e9) AS since_last
               FROM otp_challenges
               WHERE phone=%s AND created_at > NOW() - INTERVAL '24 hours'""",
            (phone,),
        )
        row = cur.fetchone()
        if row["n"] >= OTP_MAX_SENDS_PER_DAY:
            raise OtpError("daily_limit", "Too many OTP requests for this number. Try again tomorrow.", 429)
        if row["since_last"] < OTP_RESEND_COOLDOWN_SECONDS:
            wait = int(OTP_RESEND_COOLDOWN_SECONDS - row["since_last"]) + 1
            raise OtpError("cooldown", f"Please wait {wait}s before requesting another code.", 429,
                           {"retry_after": wait})
        cur.execute("UPDATE otp_challenges SET used=TRUE WHERE phone=%s AND purpose=%s AND used=FALSE",
                    (phone, purpose))
        otp = generate_otp()
        cur.execute(
            """INSERT INTO otp_challenges (phone, purpose, channel, otp_hash, expires_at)
               VALUES (%s,%s,%s,%s, NOW() + make_interval(secs => %s)) RETURNING id""",
            (phone, purpose, channel, hash_otp(otp, phone, purpose), OTP_TTL_SECONDS),
        )
        cid = str(cur.fetchone()["id"])
        conn.commit()
        return cid, otp
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def void_challenge(conn, challenge_id):
    """Remove a challenge whose code was never delivered, so a provider outage does not consume the
    user's resend cooldown or daily quota."""
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM otp_challenges WHERE id=%s AND verified_at IS NULL", (challenge_id,))
        conn.commit()
    finally:
        cur.close()


def verify_challenge(conn, phone, purpose, otp):
    """Verify a code.  Raises OtpError unless the code is correct, unexpired, unused and not locked."""
    otp = re.sub(r"\D", "", otp or "")
    if len(otp) != OTP_LENGTH:
        raise OtpError("invalid_code", "Enter the 6-digit code", 400)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """SELECT id, otp_hash, attempts, (expires_at < NOW()) AS expired
               FROM otp_challenges
               WHERE phone=%s AND purpose=%s AND used=FALSE
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE""",
            (phone, purpose),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise OtpError("no_active_code", "No active code for this number. Request a new one.", 400)
        if row["expired"]:
            cur.execute("UPDATE otp_challenges SET used=TRUE WHERE id=%s", (row["id"],))
            conn.commit()
            raise OtpError("expired", "This code has expired. Request a new one.", 400)
        if row["attempts"] >= OTP_MAX_ATTEMPTS:
            cur.execute("UPDATE otp_challenges SET used=TRUE WHERE id=%s", (row["id"],))
            conn.commit()
            raise OtpError("locked", "Too many wrong attempts. Request a new code.", 429)
        if not hmac.compare_digest(row["otp_hash"], hash_otp(otp, phone, purpose)):
            cur.execute("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=%s RETURNING attempts", (row["id"],))
            attempts = cur.fetchone()["attempts"]
            if attempts >= OTP_MAX_ATTEMPTS:
                cur.execute("UPDATE otp_challenges SET used=TRUE WHERE id=%s", (row["id"],))
            conn.commit()
            left = max(OTP_MAX_ATTEMPTS - attempts, 0)
            raise OtpError("invalid_code", "Incorrect code.", 400, {"attempts_left": left})
        cur.execute("UPDATE otp_challenges SET used=TRUE, verified_at=NOW() WHERE id=%s", (row["id"],))
        conn.commit()
        return str(row["id"])
    except OtpError:
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


# ----------------------------------------------------------------- verification tokens
def issue_verification_token(phone, purpose, challenge_id):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(
        {"typ": "otp_verified", "phone": phone, "purpose": purpose, "jti": challenge_id,
         "iat": now, "exp": now + datetime.timedelta(seconds=VERIFICATION_TOKEN_TTL_SECONDS)},
        jwt_key(), algorithm="HS256",
    )


def consume_verification_token(conn, token, purpose, phone=None):
    """Validate and burn a verification token (single use).  Returns the verified phone."""
    try:
        data = jwt.decode(token or "", jwt_key(), algorithms=["HS256"], options={"require": ["exp", "iat", "jti"]})
    except jwt.PyJWTError:
        raise OtpError("invalid_token", "Verification is invalid or expired. Verify your phone again.", 401)
    if data.get("typ") != "otp_verified" or data.get("purpose") != purpose:
        raise OtpError("invalid_token", "Verification is invalid or expired. Verify your phone again.", 401)
    if phone and data.get("phone") != phone:
        raise OtpError("invalid_token", "Verification does not match this phone number.", 401)
    cur = conn.cursor()
    try:
        cur.execute(
            """UPDATE otp_challenges SET consumed_at=NOW()
               WHERE id=%s AND verified_at IS NOT NULL AND consumed_at IS NULL AND phone=%s AND purpose=%s
               RETURNING phone""",
            (data["jti"], data["phone"], purpose),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise OtpError("invalid_token", "Verification was already used. Verify your phone again.", 401)
        conn.commit()
        return row[0]
    finally:
        cur.close()


# ----------------------------------------------------------------- delivery
def _twilio_auth():
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    key_sid, key_secret = os.getenv("TWILIO_API_KEY_SID"), os.getenv("TWILIO_API_KEY_SECRET")
    if sid and token:
        return sid, (sid, token)
    if sid and key_sid and key_secret:
        return sid, (key_sid, key_secret)
    return None, None


def send_text(phone, body, channel="sms"):
    """Send a text through Twilio.  Returns True only if Twilio accepted the message."""
    sid, auth = _twilio_auth()
    if not sid:
        return False
    if channel == "whatsapp":
        sender = os.getenv("TWILIO_WHATSAPP_FROM")
        if not sender:
            return False
        to, frm = f"whatsapp:+91{phone}", f"whatsapp:{sender}"
    else:
        sender = os.getenv("TWILIO_PHONE_NUMBER")
        if not sender:
            return False
        to, frm = f"+91{phone}", sender
    try:
        resp = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            data={"To": to, "From": frm, "Body": body}, auth=auth, timeout=8,
        )
        ok = resp.status_code in (200, 201)
        if not ok:
            log.warning("Twilio rejected message to %s (HTTP %s)", mask_phone(phone), resp.status_code)
        return ok
    except requests.RequestException as exc:
        log.warning("Twilio request failed for %s: %s", mask_phone(phone), type(exc).__name__)
        return False


def deliver_otp(phone, otp, channel="sms"):
    """Deliver an OTP.  Raises OtpError if it cannot be delivered; never fakes delivery.

    Returns a dict that may contain ``dev_otp`` ONLY in permitted local-development mode.
    """
    if sms_live():
        if channel == "whatsapp" and not os.getenv("TWILIO_WHATSAPP_FROM"):
            raise OtpError("whatsapp_not_configured", "WhatsApp delivery is not configured on this server.", 501)
        if not _twilio_auth()[0]:
            raise OtpError("provider_unavailable", "SMS provider is not configured.", 503)
        body = f"Your Samanvi verification code is {otp}. It expires in {OTP_TTL_SECONDS // 60} minutes. Do not share it."
        if not send_text(phone, body, channel):
            raise OtpError("delivery_failed", "We could not send the code. Please try again shortly.", 502)
        return {"gateway": f"twilio_{channel}"}
    if dev_otp_allowed():
        if channel == "whatsapp":
            raise OtpError("whatsapp_not_configured", "WhatsApp delivery is not configured on this server.", 501)
        log.warning("TESTING MODE: OTP issued for %s is: %s", phone, otp)
        return {"gateway": "dev"}
    raise OtpError("provider_unavailable", "SMS provider is not configured.", 503)


# ----------------------------------------------------------------- Aadhaar proof tokens
def issue_aadhaar_token(aadhaar_hash, last4, full_name, challenge_id):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(
        {"typ": "aadhaar_verified", "h": aadhaar_hash, "last4": last4, "name": full_name, "jti": challenge_id,
         "iat": now, "exp": now + datetime.timedelta(minutes=30)},
        jwt_key(), algorithm="HS256",
    )


def consume_aadhaar_token(conn, token):
    """Validate and burn an Aadhaar proof (single use).  Returns dict(hash, last4, name)."""
    try:
        data = jwt.decode(token or "", jwt_key(), algorithms=["HS256"], options={"require": ["exp", "iat", "jti"]})
    except jwt.PyJWTError:
        raise OtpError("invalid_token", "Aadhaar verification is invalid or expired.", 401)
    if data.get("typ") != "aadhaar_verified":
        raise OtpError("invalid_token", "Aadhaar verification is invalid or expired.", 401)
    cur = conn.cursor()
    try:
        cur.execute("""UPDATE aadhaar_challenges SET consumed_at=NOW()
                       WHERE id=%s AND verified_at IS NOT NULL AND consumed_at IS NULL AND aadhaar_hash=%s RETURNING id""",
                    (data["jti"], data["h"]))
        if not cur.fetchone():
            conn.rollback()
            raise OtpError("invalid_token", "Aadhaar verification was already used.", 401)
        conn.commit()
        return {"hash": data["h"], "last4": data["last4"], "name": data.get("name")}
    finally:
        cur.close()
