"""Phase 1: phone OTP — server-side, hashed, expiring, single-use, attempt-limited, rate-limited, no bypass."""
import re

import pytest

from tests.conftest import bearer

PHONE = "9876543210"
PHONE2 = "9123456780"
SIX = re.compile(r"(?<!\d)\d{6}(?!\d)")


@pytest.fixture()
def sms(monkeypatch):
    """Live-SMS mode with ONLY the Twilio HTTP transport replaced by a recorder."""
    import otp_service
    sent = []
    monkeypatch.setenv("ENABLE_LIVE_SMS", "true")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACunittest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "unittest")
    monkeypatch.setenv("TWILIO_PHONE_NUMBER", "+15550000000")
    monkeypatch.setattr(otp_service, "send_text", lambda phone, body, channel="sms": sent.append((phone, body, channel)) or True)
    return sent


def last_code(sent):
    return SIX.search(sent[-1][1]).group(0)


def send(client, phone=PHONE, purpose="register", path="/api/auth/send-phone-otp"):
    return client.post(path, json={"phone": phone, "purpose": purpose})


def verify(client, otp, phone=PHONE, purpose="register"):
    return client.post("/api/auth/verify-phone-otp", json={"phone": phone, "otp": otp, "purpose": purpose})


def rows(db, where="TRUE"):
    cur = db.cursor()
    cur.execute(f"SELECT phone, purpose, otp_hash, attempts, used, verified_at IS NOT NULL, expires_at > NOW() FROM otp_challenges WHERE {where} ORDER BY created_at")
    return cur.fetchall()


# ------------------------------------------------------------------ production behaviour
def test_production_without_sms_provider_refuses_instead_of_faking(client, db):
    r = send(client)
    body = r.get_data(as_text=True)
    assert r.status_code == 503 and r.get_json()["code"] == "provider_unavailable"
    assert "dev_otp" not in body and not SIX.search(body)
    assert rows(db) == [], "an undelivered code must leave no challenge behind"


def test_dev_flag_is_ignored_in_production(client, monkeypatch):
    monkeypatch.setenv("ALLOW_DEV_OTP", "true")           # APP_ENV stays 'production'
    r = send(client)
    assert r.status_code == 503 and "dev_otp" not in r.get_data(as_text=True)


def test_dev_otp_only_in_explicit_development_mode_and_still_verified_server_side(client, db, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ALLOW_DEV_OTP", "true")
    r = send(client)
    assert r.status_code == 200
    code = r.get_json()["dev_otp"]
    assert SIX.fullmatch(code)
    assert verify(client, "000000" if code != "000000" else "111111").status_code == 400   # real verification, not a bypass
    assert verify(client, code).status_code == 200


def test_dev_flag_cannot_be_combined_with_live_sms(client, sms, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ALLOW_DEV_OTP", "true")
    r = send(client)
    assert r.status_code == 200 and "dev_otp" not in r.get_json() and sms


def test_live_mode_never_returns_the_code_and_stores_only_a_hash(client, db, sms):
    r = send(client)
    assert r.status_code == 200
    body = r.get_data(as_text=True)
    code = last_code(sms)
    assert code not in body and "dev_otp" not in body
    ((phone, purpose, otp_hash, attempts, used, verified, active),) = rows(db)
    assert phone == PHONE and purpose == "register" and len(otp_hash) == 64 and otp_hash != code
    assert (attempts, used, verified, active) == (0, False, False, True)
    cur = db.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='otp_challenges'")
    assert "otp" not in {c[0] for c in cur.fetchall()}, "no plaintext OTP column"


def test_sms_provider_failure_returns_502_and_voids_challenge(client, db, sms, monkeypatch):
    import otp_service
    monkeypatch.setattr(otp_service, "send_text", lambda *a, **k: False)
    r = send(client)
    assert r.status_code == 502 and not SIX.search(r.get_data(as_text=True))
    assert rows(db) == []


def test_live_flag_without_credentials_is_503(client, monkeypatch):
    monkeypatch.setenv("ENABLE_LIVE_SMS", "true")
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"):
        monkeypatch.delenv(k, raising=False)
    assert send(client).status_code == 503


def test_whatsapp_not_configured_is_501_and_leaks_no_code(client, sms, db):
    r = send(client, path="/api/auth/send-whatsapp-otp")
    assert r.status_code == 501 and not SIX.search(r.get_data(as_text=True)) and "whatsapp_url" not in r.get_data(as_text=True)
    assert not sms and rows(db) == []


def test_whatsapp_when_configured_sends_through_provider(client, sms, monkeypatch):
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155238886")
    r = send(client, path="/api/auth/send-whatsapp-otp")
    assert r.status_code == 200 and sms[-1][2] == "whatsapp" and last_code(sms) not in r.get_data(as_text=True)


# ------------------------------------------------------------------ verification rules
def test_correct_code_verifies_once_and_returns_single_use_proof(client, db, sms):
    send(client)
    code = last_code(sms)
    r = verify(client, code)
    j = r.get_json()
    assert r.status_code == 200 and j["ok"] and j["verification_token"]
    ((_, _, _, attempts, used, verified, _),) = rows(db)
    assert used and verified
    again = verify(client, code)                       # reuse of a consumed code
    assert again.status_code == 400 and again.get_json()["code"] == "no_active_code"


def test_wrong_codes_rejected_counted_and_lock_the_challenge(client, db, sms, monkeypatch):
    import otp_service
    monkeypatch.setattr(otp_service, "generate_otp", lambda: "654321")
    send(client)
    for i in range(1, 6):
        r = verify(client, "111111")
        assert r.status_code == 400 and r.get_json()["code"] == "invalid_code"
        assert rows(db)[0][3] == i
    assert rows(db)[0][4] is True and rows(db)[0][5] is False        # locked, never verified
    late = verify(client, "654321")                    # the right code is useless once locked
    assert late.status_code == 400 and late.get_json()["code"] == "no_active_code"
    assert rows(db)[0][5] is False


def test_expired_code_rejected(client, db, sms):
    send(client)
    code = last_code(sms)
    db.cursor().execute("UPDATE otp_challenges SET expires_at = NOW() - INTERVAL '1 second'")
    r = verify(client, code)
    assert r.status_code == 400 and r.get_json()["code"] == "expired"
    assert rows(db)[0][4] is True and rows(db)[0][5] is False


def test_hardcoded_master_code_is_never_accepted(client, db, sms, monkeypatch):
    import otp_service
    monkeypatch.setattr(otp_service, "generate_otp", lambda: "654321")
    send(client)
    r = verify(client, "123456")
    assert r.status_code == 400 and r.get_json()["code"] == "invalid_code"
    assert rows(db)[0][5] is False


def test_code_is_bound_to_phone_and_purpose(client, db, sms, monkeypatch, make_user):
    import otp_service
    monkeypatch.setattr(otp_service, "generate_otp", lambda: "654321")
    send(client)
    assert verify(client, "654321", phone=PHONE2).status_code == 400              # other number: no challenge
    make_user(phone=PHONE2, email="b@example.com")
    r = verify(client, "654321", purpose="password_reset")                        # wrong purpose
    assert r.status_code == 400
    assert verify(client, "654321").status_code == 200                            # right phone + purpose still works


def test_new_code_supersedes_old_one(client, db, sms, monkeypatch):
    import otp_service
    codes = iter(["111222", "333444"])
    monkeypatch.setattr(otp_service, "generate_otp", lambda: next(codes))
    send(client)
    db.cursor().execute("UPDATE otp_challenges SET created_at = NOW() - INTERVAL '1 minute'")   # clear cooldown
    send(client)
    assert verify(client, "111222").status_code == 400
    assert verify(client, "333444").status_code == 200


@pytest.mark.parametrize("bad", ["", "12345", "1234567", "abcdef", None])
def test_malformed_codes_rejected(client, sms, bad):
    send(client)
    assert verify(client, bad).status_code == 400


@pytest.mark.parametrize("bad", ["", "123", "1234567890", "5876543210", "abcdefghij"])
def test_invalid_phone_numbers_rejected(client, bad):
    assert send(client, phone=bad).status_code == 400


def test_registered_phone_cannot_be_registered_again(client, sms, make_user):
    make_user(phone=PHONE)
    r = send(client)
    assert r.status_code == 409 and not sms


# ------------------------------------------------------------------ throttling
def test_resend_cooldown_enforced(client, sms):
    assert send(client).status_code == 200
    r = send(client)
    assert r.status_code == 429 and r.get_json()["code"] == "cooldown" and len(sms) == 1


def test_daily_cap_per_phone(client, db, sms):
    for _ in range(5):
        assert send(client).status_code == 200
        db.cursor().execute("UPDATE otp_challenges SET created_at = NOW() - INTERVAL '1 hour'")
    r = send(client)
    assert r.status_code == 429 and r.get_json()["code"] == "daily_limit" and len(sms) == 5


def test_send_endpoint_ip_rate_limit(client, sms, limits_on):
    phones = [f"98765{n:05d}" for n in range(12)]
    codes = [send(client, phone=p).status_code for p in phones]
    assert codes[:10] == [200] * 10 and set(codes[10:]) == {429}


def test_verify_endpoint_ip_rate_limit(client, sms, limits_on):
    send(client)
    codes = [verify(client, "000001").status_code for _ in range(7)]
    assert codes[:5] == [400] * 5 and 429 in codes[5:]


# ------------------------------------------------------------------ login with OTP
def test_login_with_otp_full_flow(client, db, sms, make_user):
    make_user(phone=PHONE)
    assert send(client, purpose="login").status_code == 200
    code = last_code(sms)
    r = client.post("/api/auth/login-with-otp", json={"phone": PHONE, "otp": code})
    assert r.status_code == 200
    token = r.get_json()["token"]
    assert client.get("/api/user/profile", headers=bearer(token)).status_code == 200
    reuse = client.post("/api/auth/login-with-otp", json={"phone": PHONE, "otp": code})
    assert reuse.status_code == 400


def test_login_with_otp_master_code_account_takeover_is_closed(client, db, sms, make_user, monkeypatch):
    import otp_service
    monkeypatch.setattr(otp_service, "generate_otp", lambda: "654321")
    make_user(phone=PHONE)
    # (a) no challenge at all
    r = client.post("/api/auth/login-with-otp", json={"phone": PHONE, "otp": "123456"})
    assert r.status_code == 400 and "token" not in r.get_json()
    # (b) with an open challenge for the real user
    send(client, purpose="login")
    r = client.post("/api/auth/login-with-otp", json={"phone": PHONE, "otp": "123456"})
    assert r.status_code == 400 and "token" not in r.get_json()


def test_login_otp_for_unknown_number_is_indistinguishable_and_sends_nothing(client, db, sms, make_user):
    make_user(phone=PHONE)
    known, unknown = send(client, purpose="login"), send(client, phone=PHONE2, purpose="login")
    assert known.status_code == unknown.status_code == 200
    assert set(known.get_json()) - {"session_id", "gateway"} == set(unknown.get_json())
    assert len(sms) == 1 and rows(db, f"phone='{PHONE2}'") == []


def test_register_purpose_code_cannot_log_in(client, sms, make_user, monkeypatch):
    import otp_service
    monkeypatch.setattr(otp_service, "generate_otp", lambda: "654321")
    make_user(phone=PHONE2, email="b@example.com")
    send(client, phone="9000000001", purpose="register")
    r = client.post("/api/auth/login-with-otp", json={"phone": PHONE2, "otp": "654321"})
    assert r.status_code == 400


# ------------------------------------------------------------------ password reset
def _reset_flow(client, sms, phone=PHONE):
    assert send(client, phone=phone, purpose="password_reset").status_code == 200
    r = verify(client, last_code(sms), phone=phone, purpose="password_reset")
    assert r.status_code == 200
    return r.get_json()["verification_token"]


def test_reset_password_requires_proof_of_phone_ownership(client, make_user, sms):
    make_user(phone=PHONE)
    attempts = [
        {"phone": PHONE, "new_password": "hacked-pass"},                                           # old unauthenticated form
        {"email": "u@example.com", "new_password": "hacked-pass"},
        {"phone": PHONE, "new_password": "hacked-pass", "verification_token": "garbage"},
    ]
    for body in attempts:
        r = client.post("/api/auth/reset-password", json=body)
        assert r.status_code in (400, 401), body
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "hacked-pass"}).status_code == 401


def test_reset_password_happy_path_revokes_old_sessions_and_token_is_single_use(client, make_user, sms, login, db):
    make_user(phone=PHONE)
    old_session = login()
    proof = _reset_flow(client, sms)
    r = client.post("/api/auth/reset-password", json={"phone": PHONE, "verification_token": proof, "new_password": "brand-new-pass"})
    assert r.status_code == 200
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "brand-new-pass"}).status_code == 200
    cur = db.cursor()
    cur.execute("SELECT password_changed_at IS NOT NULL, password_hash LIKE '$2%' FROM users")
    assert cur.fetchone() == (True, True)
    assert client.get("/api/user/profile", headers=bearer(old_session)).status_code == 401
    replay = client.post("/api/auth/reset-password", json={"phone": PHONE, "verification_token": proof, "new_password": "another-pass"})
    assert replay.status_code == 401


def test_reset_proof_is_bound_to_phone_and_purpose(client, make_user, sms, monkeypatch):
    make_user(phone=PHONE)
    make_user(phone=PHONE2, email="b@example.com")
    proof = _reset_flow(client, sms)
    r = client.post("/api/auth/reset-password", json={"phone": PHONE2, "verification_token": proof, "new_password": "brand-new-pass"})
    assert r.status_code == 401
    # a registration proof is not a reset proof
    send(client, phone="9000000002", purpose="register")
    reg_proof = verify(client, last_code(sms), phone="9000000002").get_json()["verification_token"]
    r = client.post("/api/auth/reset-password", json={"phone": PHONE, "verification_token": reg_proof, "new_password": "brand-new-pass"})
    assert r.status_code == 401


@pytest.mark.parametrize("pw", ["", "123", "x" * 73, None])
def test_reset_rejects_weak_or_unusable_passwords(client, make_user, sms, pw):
    make_user(phone=PHONE)
    proof = _reset_flow(client, sms)
    r = client.post("/api/auth/reset-password", json={"phone": PHONE, "verification_token": proof, "new_password": pw})
    assert r.status_code == 400


def test_reset_for_unknown_number_sends_nothing(client, sms):
    r = send(client, phone=PHONE2, purpose="password_reset")
    assert r.status_code == 200 and not sms


def test_provider_outage_does_not_consume_cooldown_or_daily_quota(client, db, sms, monkeypatch):
    import otp_service
    real = otp_service.send_text
    monkeypatch.setattr(otp_service, "send_text", lambda *a, **k: False)
    for _ in range(7):                                              # more failures than the daily cap
        assert send(client).status_code == 502
    monkeypatch.setattr(otp_service, "send_text", real)
    assert send(client).status_code == 200, "user must be able to retry immediately once the provider recovers"
    assert len(rows(db)) == 1
