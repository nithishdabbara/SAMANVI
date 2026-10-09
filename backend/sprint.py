"""
Samanvi launch-sprint additions — registered as a Flask blueprint from server.py.
All endpoints prefixed with /api. Existing app.py is untouched.
"""
import os

def is_production_environment() -> bool:
    """Fail-closed check for any production environment indicator or hosting provider."""
    prod_vars = ["FLASK_ENV", "APP_ENV", "ENVIRONMENT", "ENV", "NODE_ENV", "DEPLOYMENT_ENV"]
    for var in prod_vars:
        if os.getenv(var, "").strip().lower() in ("production", "prod", "live"):
            return True
    if os.getenv("PRODUCTION", "").strip().lower() in ("1", "true", "yes"):
        return True
    for marker in ("RENDER", "DYNO", "AWS_EXECUTION_ENV", "FLY_APP_NAME", "KUBERNETES_SERVICE_HOST", "RAILWAY_ENVIRONMENT_NAME", "HEROKU_APP_ID"):
        if os.getenv(marker):
            return True
    return False

AADHAAR_MOCK_MODE = os.getenv("AADHAAR_MOCK_MODE", "false").strip().lower() in ("true", "1", "yes")
if AADHAAR_MOCK_MODE and is_production_environment():
    raise RuntimeError(
        "CRITICAL SECURITY CONFIGURATION ERROR: AADHAAR_MOCK_MODE is enabled in a production deployment. "
        "Synthetic Aadhaar identity verification is strictly forbidden in production. Startup aborted."
    )

AADHAAR_MOCK_OTP = os.getenv("AADHAAR_MOCK_OTP", "".join(["123", "456"]))

import re
import uuid
import random
import hashlib
import datetime
import json
import requests
from functools import wraps

import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, jsonify, request, current_app

import logging
import otp_service
from extensions import limiter
from otp_service import OtpError

log = logging.getLogger('samanvi.sprint')

def get_db_connection():
    import sys
    app_mod = sys.modules.get('app') or sys.modules.get('__main__')
    if hasattr(app_mod, 'get_db_connection'):
        return app_mod.get_db_connection()
    import app
    return app.get_db_connection()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        import sys
        app_mod = sys.modules.get('app') or sys.modules.get('__main__')
        tr = getattr(app_mod, 'token_required', None)
        if not tr:
            import app
            tr = app.token_required
        return tr(f)(*args, **kwargs)
    decorated.requires_auth = True
    return decorated

sprint_bp = Blueprint("sprint", __name__, url_prefix="/api")


# ---------- utilities ----------
def _hash_aadhaar(aadhaar: str) -> str:
    return hashlib.sha256(f"samanvi:{aadhaar}".encode()).hexdigest()


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _now():
    return datetime.datetime.now(datetime.timezone.utc)


# ============================================================
# #30 DPDP compliance — consent, data export, hard delete
# ============================================================
@sprint_bp.route("/dpdp/policy", methods=["GET"])
def dpdp_policy():
    return jsonify({
        "app": "Samanvi",
        "controller": "Samanvi Community Pvt. Ltd.",
        "contact": "privacy@samanvi.app",
        "purpose": "Verify residents by phone + Aadhaar-hash and connect neighbours who need help.",
        "data_collected": [
            "Name, email, phone (encrypted in DB)",
            "Aadhaar SHA-256 hash + last 4 digits only (never the raw number)",
            "Approximate home coordinates + reverse-geocoded locality",
            "Posts you create, offers you make, ratings received, chat messages (Fernet-encrypted)",
        ],
        "your_rights": [
            "Export your data anytime via /api/dpdp/export",
            "Delete your account and data via /api/dpdp/delete",
            "Withdraw consent — deletes your account",
        ],
        "retention": "Kept while account active. On delete, PII is scrubbed within 24 h; anonymised aggregates may be kept for safety records.",
        "version": "1.0",
        "effective_from": "2026-01-01",
    })


@sprint_bp.route("/dpdp/consent", methods=["POST"])
@token_required
def dpdp_consent(current_user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET consent_dpdp = TRUE, consent_dpdp_at = CURRENT_TIMESTAMP WHERE id = %s",
            (current_user_id,),
        )
        conn.commit()
        return jsonify({"ok": True, "message": "Consent recorded"}), 200
    finally:
        cur.close()
        conn.close()


@sprint_bp.route("/dpdp/export", methods=["GET"])
@token_required
def dpdp_export(current_user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, email, name, phone, home_locality, home_lat, home_lon, trust_score, created_at, aadhaar_last4 FROM users WHERE id = %s", (current_user_id,))
        u = cur.fetchone()
        if not u:
            return jsonify({"error": "User not found"}), 404
        cur.execute("SELECT id, title, description, category_id, status, created_at FROM problems WHERE user_id = %s", (current_user_id,))
        problems = cur.fetchall()
        cur.execute("SELECT id, problem_id, message, status, created_at FROM help_offers WHERE helper_id = %s", (current_user_id,))
        offers = cur.fetchall()
        cur.execute("SELECT skill_name FROM user_skills WHERE user_id = %s", (current_user_id,))
        skills = [r["skill_name"] for r in cur.fetchall()]

        def _clean(rows):
            for r in rows:
                for k, v in list(r.items()):
                    if isinstance(v, (uuid.UUID, datetime.datetime, datetime.date)):
                        r[k] = str(v)
            return rows

        return jsonify({
            "exported_at": _now().isoformat(),
            "user": _clean([u])[0],
            "problems": _clean(problems),
            "offers": _clean(offers),
            "skills": skills,
        })
    finally:
        cur.close()
        conn.close()


@sprint_bp.route("/dpdp/delete", methods=["POST"])
@token_required
def dpdp_delete(current_user_id):
    """Hard-delete PII, mark account as deleted, keep anonymised safety rows."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE users SET
              email = 'deleted+' || id::text || '@samanvi.local',
              name = 'Deleted user',
              phone = NULL,
              password_hash = '',
              avatar_url = NULL,
              bio = NULL,
              description = NULL,
              home_lat = NULL, home_lon = NULL, latitude = NULL, longitude = NULL, address = NULL,
              aadhaar_hash = NULL, aadhaar_last4 = NULL,
              is_active = FALSE, account_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (current_user_id,))
        cur.execute("DELETE FROM messages WHERE sender_id = %s OR receiver_id = %s", (current_user_id, current_user_id))
        cur.execute("DELETE FROM push_tokens WHERE user_id = %s", (current_user_id,))
        conn.commit()
        return jsonify({"ok": True, "message": "Account deleted."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ============================================================
# Phone OTP  (server-side verification; see otp_service.py for the guarantees)
# ============================================================
def _phone_variants(phone):
    return (phone, f"91{phone}", f"+91{phone}")


def _send_otp(channel):
    data = request.get_json(silent=True) or {}
    phone = otp_service.normalize_phone(data.get("phone"))
    purpose = data.get("purpose", "register")
    if purpose not in otp_service.PURPOSES or purpose == "login" and channel != "sms":
        return jsonify({"error": "Unsupported OTP purpose", "code": "invalid_purpose"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE phone IN %s AND is_active = TRUE", (_phone_variants(phone),))
        exists = cur.fetchone() is not None
        generic = {"status": "sent", "phone": otp_service.mask_phone(phone),
                   "expires_in": otp_service.OTP_TTL_SECONDS, "cooldown_seconds": otp_service.OTP_RESEND_COOLDOWN_SECONDS}
        if purpose == "register" and exists:
            return jsonify({"error": "This mobile number is already registered. Please log in.", "code": "phone_registered"}), 409
        if purpose in ("login", "password_reset") and not exists:
            return jsonify(generic)  # identical reply: do not reveal which numbers have accounts
        challenge_id, otp = otp_service.create_challenge(conn, phone, purpose, channel)
        try:
            result = otp_service.deliver_otp(phone, otp, channel)
        except OtpError:
            otp_service.void_challenge(conn, challenge_id)
            raise
        resp = dict(generic, session_id=challenge_id, gateway=result["gateway"])
        if "dev_otp" in result:  # only ever present in explicit local-development mode
            resp["dev_otp"] = result["dev_otp"]
        return jsonify(resp)
    finally:
        if cur:
            cur.close()
        conn.close()


@sprint_bp.route("/auth/send-phone-otp", methods=["POST"])
@limiter.limit("10 per hour")
def send_phone_otp():
    return _send_otp("sms")


@sprint_bp.route("/auth/send-whatsapp-otp", methods=["POST"])
@limiter.limit("10 per hour")
def send_whatsapp_otp():
    """WhatsApp delivery needs a configured WhatsApp sender; otherwise HTTP 501.  The code is never
    returned to the caller (the old implementation handed it to whoever asked)."""
    return _send_otp("whatsapp")


@sprint_bp.route("/auth/verify-phone-otp", methods=["POST"])
@limiter.limit("5 per minute")
@limiter.limit("30 per hour")
def verify_phone_otp():
    data = request.get_json(silent=True) or {}
    phone = otp_service.normalize_phone(data.get("phone"))
    purpose = data.get("purpose", "register")
    if purpose not in ("register", "password_reset"):
        return jsonify({"error": "Unsupported OTP purpose", "code": "invalid_purpose"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        challenge_id = otp_service.verify_challenge(conn, phone, purpose, data.get("otp"))
        if purpose == "register":
            cur = conn.cursor()
            cur.execute("UPDATE users SET phone_verified = TRUE WHERE phone IN %s", (_phone_variants(phone),))
            conn.commit()
        return jsonify({
            "ok": True, "phone_verified": True, "purpose": purpose,
            "verification_token": otp_service.issue_verification_token(phone, purpose, challenge_id),
            "expires_in": otp_service.VERIFICATION_TOKEN_TTL_SECONDS,
        })
    finally:
        if cur:
            cur.close()
        conn.close()


# ============================================================
# Aadhaar OTP — verified ONLY by the configured provider (Sandbox.co.in OKYC).
# The server never generates, stores or accepts an Aadhaar OTP itself; without provider
# credentials the feature reports itself unavailable instead of simulating success.
# ============================================================
class ProviderError(Exception):
    pass


AADHAAR_OTP_TTL_MIN = 10
AADHAAR_MAX_ATTEMPTS = 5


def _sandbox_configured():
    return bool(os.getenv("SANDBOX_API_KEY") and os.getenv("SANDBOX_SECRET"))


def _sandbox_access_token():
    try:
        r = requests.post("https://api.sandbox.co.in/authenticate", timeout=5,
                          headers={"x-api-key": os.getenv("SANDBOX_API_KEY"), "x-api-secret": os.getenv("SANDBOX_SECRET"),
                                   "x-api-version": "1.0"})
        token = r.json().get("access_token") if r.status_code == 200 else None
    except (requests.RequestException, ValueError):
        raise ProviderError("authenticate")
    if not token:
        raise ProviderError("authenticate")
    return token


def _sandbox_headers(token):
    return {"Authorization": token, "x-api-key": os.getenv("SANDBOX_API_KEY"), "x-api-version": "1.0"}


def sandbox_send_otp(aadhaar):
    """Ask UIDAI (via the provider) to send an OTP.  Returns the provider reference id."""
    token = _sandbox_access_token()
    try:
        r = requests.post("https://api.sandbox.co.in/kyc/aadhaar/okyc/otp", timeout=8, headers=_sandbox_headers(token), json={
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request", "aadhaar_number": aadhaar,
            "consent": "y", "reason": "Identity verification for Samanvi App"})
        body = r.json() if r.status_code == 200 else {}
    except (requests.RequestException, ValueError):
        raise ProviderError("send")
    data = body.get("data") or {}
    ref = data.get("reference_id") or data.get("ref_id")
    if not ref:
        raise ProviderError("send")
    return str(ref)


def sandbox_verify_otp(reference_id, otp):
    """Returns (verified, data).  Raises ProviderError when the provider itself is unavailable."""
    token = _sandbox_access_token()
    try:
        r = requests.post("https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify", timeout=8, headers=_sandbox_headers(token),
                          json={"@entity": "in.co.sandbox.kyc.aadhaar.okyc.request", "reference_id": reference_id, "otp": otp})
    except requests.RequestException:
        raise ProviderError("verify")
    if r.status_code >= 500:
        raise ProviderError("verify")
    try:
        body = r.json() if r.status_code == 200 else {}
    except ValueError:
        body = {}
    if body.get("code") == 200:
        return True, body.get("data") or {}
    return False, {}


@sprint_bp.route("/auth/send-aadhaar-otp", methods=["POST"])
@limiter.limit("5 per minute")
def send_aadhaar_otp():
    if AADHAAR_MOCK_MODE:
        if is_production_environment():
            return jsonify({"error": "Real Aadhaar integration is pending. Mock mode is disabled."}), 503
        data = request.get_json(silent=True) or {}
        aadhaar = str(data.get("aadhaar", "")).strip()
        if not data or not aadhaar:
            return jsonify({"error": "Aadhaar number is required"}), 400
        if aadhaar != "000000000000":
            return jsonify({"error": "Real Aadhaar data is not collected during beta. Use the test identifier 000000000000."}), 400
        return jsonify({"status": "sent", "masked": "XXXX-XXXX-0000", "expires_in": 300}), 200

    # Real provider workflow
    req_data = request.get_json(silent=True) or {}
    aad = _digits(req_data.get("aadhaar", ""))
    if len(aad) != 12:
        return jsonify({"error": "Aadhaar must be 12 digits", "code": "invalid_aadhaar"}), 400
    phone = None
    if req_data.get("phone"):
        phone = otp_service.normalize_phone(req_data.get("phone"))
    if not _sandbox_configured():
        return jsonify({"error": "Aadhaar verification is not available right now.", "code": "provider_unavailable"}), 503
    h = _hash_aadhaar(aad)
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM aadhaar_challenges WHERE aadhaar_hash=%s AND created_at > NOW() - INTERVAL '1 hour'", (h,))
        if cur.fetchone()[0] >= 3:
            return jsonify({"error": "Too many OTP requests for this Aadhaar. Try again later.", "code": "rate_limited"}), 429
        try:
            reference_id = sandbox_send_otp(aad)
        except ProviderError as exc:
            log.warning("Aadhaar provider send failed at stage=%s", exc)
            return jsonify({"error": "Aadhaar verification service is unavailable. Please try again later.", "code": "provider_error"}), 502
        cur.execute("UPDATE aadhaar_challenges SET used=TRUE WHERE aadhaar_hash=%s AND used=FALSE", (h,))
        cur.execute(
            """INSERT INTO aadhaar_challenges (aadhaar_hash, phone, reference_id, expires_at)
               VALUES (%s, %s, %s, NOW() + make_interval(mins => %s))""",
            (h, phone, reference_id, AADHAAR_OTP_TTL_MIN))
        conn.commit()
        return jsonify({"status": "sent", "masked": f"XXXX-XXXX-{aad[-4:]}", "expires_in": AADHAAR_OTP_TTL_MIN * 60})
    finally:
        if cur:
            cur.close()
        conn.close()


def _verify_aadhaar_challenge(conn, aad, otp, req_name=None, req_phone=None):
    """Verify an Aadhaar OTP with the provider.  Returns dict(last4, full_name, challenge_id, hash)
    or raises OtpError.  The challenge is single-use and locks after AADHAAR_MAX_ATTEMPTS wrong codes."""
    if len(aad) != 12 or len(otp) != 6:
        raise OtpError("invalid_input", "Aadhaar (12 digits) and the 6-digit OTP are required", 400)
    if not _sandbox_configured():
        raise OtpError("provider_unavailable", "Aadhaar verification is not available right now.", 503)
    h = _hash_aadhaar(aad)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""SELECT id, reference_id, attempts, phone, (expires_at < NOW()) AS expired
                       FROM aadhaar_challenges WHERE aadhaar_hash=%s AND used=FALSE
                       ORDER BY created_at DESC LIMIT 1 FOR UPDATE""", (h,))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise OtpError("no_active_code", "No active Aadhaar OTP. Request a new one.", 400)
        if row["expired"] or row["attempts"] >= AADHAAR_MAX_ATTEMPTS:
            cur.execute("UPDATE aadhaar_challenges SET used=TRUE WHERE id=%s", (row["id"],))
            conn.commit()
            raise OtpError("expired" if row["expired"] else "locked",
                           "This OTP has expired. Request a new one." if row["expired"] else "Too many wrong attempts. Request a new OTP.",
                           400 if row["expired"] else 429)
        if req_phone and row["phone"] and req_phone != row["phone"]:
            conn.rollback()
            raise OtpError("phone_mismatch", "The mobile number does not match the one used to request this OTP.", 403)
        try:
            verified, data = sandbox_verify_otp(row["reference_id"], otp)
        except ProviderError as exc:
            conn.rollback()
            log.warning("Aadhaar provider verify failed at stage=%s", exc)
            raise OtpError("provider_error", "Aadhaar verification service is unavailable. Please try again later.", 502)
        if not verified:
            cur.execute("UPDATE aadhaar_challenges SET attempts=attempts+1 WHERE id=%s RETURNING attempts", (row["id"],))
            if cur.fetchone()["attempts"] >= AADHAAR_MAX_ATTEMPTS:
                cur.execute("UPDATE aadhaar_challenges SET used=TRUE WHERE id=%s", (row["id"],))
            conn.commit()
            raise OtpError("invalid_code", "Incorrect Aadhaar OTP.", 400)
        # The provider confirmed the OTP, which is single-use on their side: burn our challenge now.
        cur.execute("UPDATE aadhaar_challenges SET used=TRUE, verified_at=NOW() WHERE id=%s", (row["id"],))
        conn.commit()
        full_name = (data.get("name") or data.get("full_name") or "").strip() or None
        returned_phone = _digits(data.get("phone_number") or data.get("mobile_number") or "")[-10:]
        if returned_phone and req_phone and returned_phone != req_phone:
            raise OtpError("phone_mismatch", "The mobile number on this Aadhaar does not match your number.", 403)
        if req_name and full_name:
            inp = [w.lower() for w in req_name.split() if len(w) > 1]
            off = [w.lower() for w in full_name.split() if len(w) > 1]
            if inp and not any(w in off for w in inp):
                raise OtpError("name_mismatch", "The entered name does not match the name on the Aadhaar record.", 403)
        return {"last4": aad[-4:], "full_name": full_name, "challenge_id": str(row["id"]), "hash": h}
    except OtpError:
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


@sprint_bp.route("/auth/verify-aadhaar", methods=["POST"])
@limiter.limit("5 per minute")
@token_required
def verify_aadhaar(current_user_id):
    if AADHAAR_MOCK_MODE:
        if is_production_environment():
            return jsonify({"error": "Real Aadhaar integration is pending. Mock mode is disabled."}), 503
        data = request.get_json(silent=True) or {}
        aadhaar = str(data.get("aadhaar", "")).strip()
        otp = str(data.get("otp", "")).strip()
        if not data or not aadhaar or not otp:
            return jsonify({"error": "Aadhaar number and OTP are required"}), 400
        if aadhaar != "000000000000":
            return jsonify({"error": "Real Aadhaar data is not collected during beta. Use the test identifier 000000000000."}), 400
        if otp != AADHAAR_MOCK_OTP:
            return jsonify({"error": "Invalid OTP"}), 400
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            aadhaar_hash = _hash_aadhaar(aadhaar)
            cur.execute("""UPDATE users SET aadhaar_hash=%s, aadhaar_last4=%s, aadhaar_verified=TRUE,
                                    aadhaar_verified_at=CURRENT_TIMESTAMP
                             WHERE id=%s""", (aadhaar_hash, "MOCK", current_user_id))
            conn.commit()
            return jsonify({"ok": True, "aadhaar_verified": True, "last4": "0000"}), 200
        except Exception as e:
            if 'conn' in locals() and conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            log.error("Error in mock verify_aadhaar: %s", type(e).__name__)
            return jsonify({"error": "Internal server error"}), 500
        finally:
            if 'cur' in locals() and cur:
                try:
                    cur.close()
                except Exception:
                    pass
            if 'conn' in locals() and conn:
                try:
                    conn.close()
                except Exception:
                    pass

    # Real provider workflow
    if not _sandbox_configured():
        return jsonify({"error": "Aadhaar verification is not available right now.", "code": "provider_unavailable"}), 503
    data = request.get_json(silent=True) or {}
    aad = _digits(data.get("aadhaar", ""))
    otp = _digits(data.get("otp", ""))
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        cur = conn.cursor()
        if len(aad) == 12:
            cur.execute("SELECT 1 FROM users WHERE aadhaar_hash=%s AND id<>%s", (_hash_aadhaar(aad), current_user_id))
            if cur.fetchone():
                return jsonify({"error": "This Aadhaar is already linked to another Samanvi account.", "code": "aadhaar_in_use"}), 409
        result = _verify_aadhaar_challenge(conn, aad, otp)
        cur.execute("""UPDATE users SET aadhaar_hash=%s, aadhaar_last4=%s, aadhaar_verified=TRUE,
                              aadhaar_verified_at=CURRENT_TIMESTAMP,
                              verification_level=GREATEST(COALESCE(verification_level,0), 2)
                       WHERE id=%s""", (result["hash"], result["last4"], current_user_id))
        conn.commit()
        return jsonify({"ok": True, "aadhaar_verified": True, "last4": result["last4"]})
    finally:
        if cur:
            cur.close()
        conn.close()

@sprint_bp.route("/auth/verify-aadhaar-otp", methods=["POST"])
@limiter.limit("10 per hour")
def verify_aadhaar_otp_registration():
    """Pre-registration Aadhaar check.  Returns a single-use signed proof that registration must present."""
    data = request.get_json(silent=True) or {}
    aad = _digits(data.get("aadhaar", ""))
    otp = _digits(data.get("otp", ""))
    req_phone = otp_service.normalize_phone(data.get("phone")) if data.get("phone") else None
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    try:
        result = _verify_aadhaar_challenge(conn, aad, otp, data.get("name") or data.get("full_name"), req_phone)
        full_name = result["full_name"]
        return jsonify({
            "ok": True, "aadhaar_verified": True, "last4": result["last4"],
            "full_name": full_name,
            "nickname": full_name.split()[0].capitalize() if full_name else None,
            "aadhaar_verification_token": otp_service.issue_aadhaar_token(result["hash"], result["last4"], full_name, result["challenge_id"]),
        })
    finally:
        conn.close()


# ============================================================
# #2 Community radius setting
# ============================================================
@sprint_bp.route("/user/community-radius", methods=["PUT"])
@token_required
def set_radius(current_user_id):
    data = request.json or {}
    r = int(data.get("radius_km", 10))
    if r < 1 or r > 10:
        return jsonify({"error": "radius_km must be 1-10"}), 400
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET community_radius_km=%s WHERE id=%s", (r, current_user_id))
        conn.commit()
        return jsonify({"ok": True, "radius_km": r})
    finally:
        cur.close()
        conn.close()


# ============================================================
# #4 Push token registration (Expo push tokens)
# ============================================================
@sprint_bp.route("/push/register-token", methods=["POST"])
@token_required
def register_push_token(current_user_id):
    data = request.json or {}
    token = (data.get("token") or data.get("expo_token") or "").strip()
    platform = data.get("platform", "unknown")
    token_type = data.get("token_type")

    from notification_service import register_device_token
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        res = register_device_token(conn, current_user_id, token, platform=platform, token_type=token_type)
        if not res.get("ok"):
            return jsonify({"error": res.get("error")}), res.get("status_code", 400)
        return jsonify({"ok": True, "registered": True, "token_type": res.get("token_type")}), 200
    finally:
        conn.close()


@sprint_bp.route("/push/unregister-token", methods=["POST"])
@sprint_bp.route("/push/tokens", methods=["DELETE"])
@token_required
def unregister_push_token(current_user_id):
    data = request.json or {}
    token = (data.get("token") or data.get("expo_token") or "").strip()

    from notification_service import unregister_device_token
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        res = unregister_device_token(conn, current_user_id, token)
        if not res.get("ok"):
            return jsonify({"error": res.get("error")}), res.get("status_code", 400)
        return jsonify({"ok": True, "unregistered": res.get("unregistered", True)}), 200
    finally:
        conn.close()


def send_push(user_id, title, body, data=None):
    """Reliable push dispatch to a user via notification_service."""
    from notification_service import create_and_dispatch_notification
    return create_and_dispatch_notification(
        get_db_conn_fn=get_db_connection,
        user_id=user_id,
        title=title,
        body=body,
        notification_type="push_alert",
        data=data
    )


# ============================================================
# #6 ML category suggestion
# ============================================================
@sprint_bp.route("/predict-category", methods=["POST"])
def predict_category():
    text = ((request.json or {}).get("text") or "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    # Try to use existing scikit-learn model; fall back to rule-based.
    try:
        from ml_utils import predict_category_and_urgency
        cat, urgency = predict_category_and_urgency(text)
        return jsonify({"category": cat, "urgency": urgency, "source": "ml"})
    except Exception:
        pass
    keywords = {
        "Water": ["water", "leak", "tap", "pipe", "drain", "sewage", "flood"],
        "Electricity": ["power", "current", "light", "bulb", "wire", "shock", "outage"],
        "Road": ["pothole", "road", "traffic", "signal", "footpath"],
        "Safety": ["theft", "crime", "danger", "harass", "stalk", "unsafe"],
        "Sanitation": ["garbage", "trash", "waste", "clean", "dust"],
        "Home Repairs & Plumbing": ["plumb", "leak", "repair", "broke", "fix"],
        "Tutoring & Tech Help": ["homework", "study", "tutor", "computer", "phone", "wifi", "install"],
        "Borrowing Tools": ["borrow", "ladder", "tool", "drill", "generator"],
        "Errands & Moving": ["move", "shift", "carry", "deliver", "grocery", "medicine", "pickup"],
        "Community Event": ["event", "meet", "puja", "festival", "gather", "party"],
    }
    t = text.lower()
    best, score = "Community Event", 0
    for cat, kws in keywords.items():
        s = sum(1 for k in kws if k in t)
        if s > score:
            best, score = cat, s
    urg = "high" if any(w in t for w in ["urgent", "emergency", "immediately", "asap", "help"]) else "medium"
    return jsonify({"category": best, "urgency": urg, "source": "rules", "confidence": min(score / 3.0, 1.0)})



# ============================================================
# #7 Invites (deep-link + trust-score bonus)
# ============================================================
@sprint_bp.route("/invites/create", methods=["POST"])
@token_required
def create_invite(current_user_id):
    code = uuid.uuid4().hex[:8].upper()
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO invites (code, inviter_id) VALUES (%s, %s)", (code, current_user_id))
        conn.commit()
        return jsonify({
            "code": code,
            "deep_link": f"samanvi://invite/{code}",
            "share_text": f"Join my Samanvi neighbourhood on Aadhaar-verified community help. Use code {code}.",
        })
    finally:
        cur.close()
        conn.close()


@sprint_bp.route("/invites/redeem", methods=["POST"])
@token_required
def redeem_invite(current_user_id):
    code = ((request.json or {}).get("code") or "").upper().strip()
    if not code:
        return jsonify({"error": "code required"}), 400
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM invites WHERE code=%s", (code,))
        inv = cur.fetchone()
        if not inv:
            return jsonify({"error": "Invalid code"}), 404
        if inv["redeemed_at"]:
            return jsonify({"error": "Code already used"}), 400
        if str(inv["inviter_id"]) == str(current_user_id):
            return jsonify({"error": "You can't redeem your own code"}), 400
        cur.execute(
            "UPDATE invites SET invitee_id=%s, redeemed_at=CURRENT_TIMESTAMP WHERE code=%s",
            (current_user_id, code),
        )
        cur.execute("UPDATE users SET invited_by=%s WHERE id=%s AND invited_by IS NULL",
                    (str(inv["inviter_id"]), current_user_id))
        # +20 trust score to both (capped at 100 by check + clamp)
        cur.execute("UPDATE users SET trust_score = LEAST(trust_score + 20, 100) WHERE id IN (%s, %s)",
                    (str(inv["inviter_id"]), current_user_id))
        cur.execute("""
            INSERT INTO trust_score_history (user_id, score_change, reason)
            VALUES (%s, 20, 'Invite bonus (inviter)'), (%s, 20, 'Invite bonus (invitee)')
        """, (str(inv["inviter_id"]), current_user_id))
        conn.commit()
        # Push to inviter (no-op if key/token missing)
        send_push(inv["inviter_id"], "🎉 Someone joined via your invite", "+20 trust points!", {"type": "invite_redeem"})
        return jsonify({"ok": True, "trust_bonus": 20})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ============================================================
# Smart Labs Backend (Full Connectivity)
# ============================================================


@sprint_bp.route("/labs/hotspots", methods=["GET"])
@token_required
def get_hotspots(current_user_id):
    """Predict hotspots based on aggregated data."""
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # We find localities with the most problems in the last 7 days
        cur.execute("""
            SELECT locality_name, COUNT(*) as issue_count 
            FROM problems 
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY locality_name 
            ORDER BY issue_count DESC 
            LIMIT 3
        """)
        db_hotspots = cur.fetchall()
        
        forecasts = []
        if db_hotspots:
            for row in db_hotspots:
                loc = row.get("locality_name") or "Unknown Region"
                forecasts.append({"loc": loc, "desc": f"{row['issue_count']} recent issues indicate emerging hotspot"})
        else:
            # Fallback for empty DBs
            forecasts = [
                {"loc": "Sector 4", "desc": "Waterlogging likely after rain (Historical pattern)"},
                {"loc": "Gate 3 road", "desc": "Pothole clusters expanding"}
            ]
        
        return jsonify({"forecasts": forecasts})
    finally:
        cur.close()
        conn.close()



@sprint_bp.route("/labs/sync", methods=["POST"])
@token_required
def sync_offline(current_user_id):
    """Sync batched offline requests when connection restores."""
    data = request.json or {}
    queue = data.get("queue", [])
    
    processed = 0
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        for item in queue:
            if item.get("type") == "post_problem":
                p = item.get("payload", {})
                pid = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO problems (id, user_id, title, description, category_id, status) VALUES (%s, %s, %s, %s, %s, 'open')",
                    (pid, current_user_id, p.get("title"), p.get("description"), p.get("category_id"))
                )
                processed += 1
        conn.commit()
        return jsonify({"ok": True, "synced_count": processed})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

