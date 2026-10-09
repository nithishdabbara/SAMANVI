"""Phase 1: Aadhaar OTP is verified ONLY by the provider.  The provider's HTTP API is replaced by a
fake so the server-side logic can be exercised; real provider behaviour needs credentials (see report)."""
import pytest
import requests

from tests.conftest import bearer

AADHAAR = "234567890123"
GOOD_OTP = "246810"


class Resp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


class FakeProvider:
    def __init__(self, name="ASHA RAO"):
        self.otp, self.name, self.down, self.calls = GOOD_OTP, name, False, []

    def __call__(self, url, **kw):
        self.calls.append(url)
        if url.endswith("/authenticate"):
            return Resp(200, {"access_token": "tok"})
        if url.endswith("/okyc/otp"):
            return Resp(200, {"data": {"reference_id": "REF-1"}})
        if url.endswith("/otp/verify"):
            if self.down:
                raise requests.ConnectionError("provider down")
            ok = kw["json"]["otp"] == self.otp
            return Resp(200, {"code": 200 if ok else 400, "data": ({"name": self.name} if (ok and self.name) else {})})
        raise AssertionError(url)


@pytest.fixture()
def provider(monkeypatch):
    import sprint
    fake = FakeProvider()
    monkeypatch.setenv("SANDBOX_API_KEY", "unit")
    monkeypatch.setenv("SANDBOX_SECRET", "unit")
    monkeypatch.setattr(sprint.requests, "post", fake)
    return fake


def send(client, aadhaar=AADHAAR, **extra):
    return client.post("/api/auth/send-aadhaar-otp", json={"aadhaar": aadhaar, **extra})


def verify_reg(client, otp, aadhaar=AADHAAR, **extra):
    return client.post("/api/auth/verify-aadhaar-otp", json={"aadhaar": aadhaar, "otp": otp, **extra})


def challenges(db):
    cur = db.cursor()
    cur.execute("SELECT aadhaar_hash, reference_id, attempts, used, verified_at IS NOT NULL FROM aadhaar_challenges ORDER BY created_at")
    return cur.fetchall()


# ------------------------------------------------------------------ provider unavailable => honest failure
def test_without_provider_credentials_feature_is_unavailable_not_simulated(client, db):
    r = send(client)
    assert r.status_code == 503 and r.get_json()["code"] == "provider_unavailable"
    assert "dev_otp" not in r.get_data(as_text=True) and challenges(db) == []
    for otp in ("123456", GOOD_OTP, "000000"):
        v = verify_reg(client, otp)
        assert v.status_code == 503 and "aadhaar_verified" not in v.get_json()


def test_master_code_never_verifies_even_with_provider_configured(client, provider, db):
    send(client)
    v = verify_reg(client, "123456")
    assert v.status_code == 400 and v.get_json()["code"] == "invalid_code"
    assert challenges(db)[0][4] is False


# ------------------------------------------------------------------ happy path + storage
def test_send_stores_only_hash_and_provider_reference(client, provider, db):
    r = send(client, phone="9876543210")
    j = r.get_json()
    assert r.status_code == 200 and j["masked"] == "XXXX-XXXX-0123" and "dev_otp" not in j and "reference_id" not in j
    ((h, ref, attempts, used, verified),) = challenges(db)
    assert AADHAAR not in h and len(h) == 64 and ref == "REF-1" and (attempts, used, verified) == (0, False, False)
    cur = db.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='aadhaar_challenges'")
    assert "otp" not in {c[0] for c in cur.fetchall()}


def test_provider_verified_otp_succeeds_once_and_issues_single_use_proof(client, provider, db, appmod):
    import otp_service
    send(client)
    v = verify_reg(client, GOOD_OTP, name="Asha Rao")
    j = v.get_json()
    assert v.status_code == 200 and j["aadhaar_verified"] and j["last4"] == "0123" and j["full_name"] == "ASHA RAO"
    assert challenges(db)[0][3:] == (True, True)
    proof = otp_service.consume_aadhaar_token(appmod.get_db_connection(), j["aadhaar_verification_token"])
    assert proof["last4"] == "0123"
    with pytest.raises(otp_service.OtpError):
        otp_service.consume_aadhaar_token(appmod.get_db_connection(), j["aadhaar_verification_token"])   # replay
    again = verify_reg(client, GOOD_OTP)                                  # the OTP itself is single use
    assert again.status_code == 400 and again.get_json()["code"] == "no_active_code"


def test_no_invented_identity_when_provider_returns_no_name(client, provider):
    provider.name = None
    send(client)
    j = verify_reg(client, GOOD_OTP).get_json()
    assert j["aadhaar_verified"] is True and j["full_name"] is None and j["nickname"] is None


def test_name_mismatch_is_rejected(client, provider):
    send(client)
    v = verify_reg(client, GOOD_OTP, name="Completely Different")
    assert v.status_code == 403 and v.get_json()["code"] == "name_mismatch"


# ------------------------------------------------------------------ rejection paths
def test_wrong_otps_counted_and_lock(client, provider, db):
    send(client)
    for i in range(1, 6):
        r = verify_reg(client, "111111")
        assert r.status_code == 400 and challenges(db)[0][2] == i
    assert challenges(db)[0][3] is True
    late = verify_reg(client, GOOD_OTP)
    assert late.status_code == 400 and challenges(db)[0][4] is False


def test_expired_challenge_rejected(client, provider, db):
    send(client)
    db.cursor().execute("UPDATE aadhaar_challenges SET expires_at = NOW() - INTERVAL '1 second'")
    r = verify_reg(client, GOOD_OTP)
    assert r.status_code == 400 and r.get_json()["code"] == "expired" and challenges(db)[0][4] is False


def test_provider_outage_is_502_and_does_not_burn_attempts(client, provider, db):
    send(client)
    provider.down = True
    r = verify_reg(client, GOOD_OTP)
    assert r.status_code == 502 and "aadhaar_verified" not in r.get_json()
    assert challenges(db)[0][2:] == (0, False, False)
    provider.down = False
    assert verify_reg(client, GOOD_OTP).status_code == 200


def test_verify_without_requesting_otp_rejected(client, provider):
    r = verify_reg(client, GOOD_OTP)
    assert r.status_code == 400 and r.get_json()["code"] == "no_active_code"


@pytest.mark.parametrize("bad", ["", "123", "23456789012a", "2345678901234"])
def test_invalid_aadhaar_numbers_rejected(client, provider, bad):
    assert send(client, aadhaar=bad).status_code == 400


def test_phone_must_match_the_one_used_to_request(client, provider):
    send(client, phone="9876543210")
    r = verify_reg(client, GOOD_OTP, phone="9123456780")
    assert r.status_code == 403 and r.get_json()["code"] == "phone_mismatch"


def test_send_rate_limited_per_aadhaar_and_per_ip(client, provider, db, limits_on):
    codes = [send(client).status_code for _ in range(5)]
    assert codes[:3] == [200] * 3 and set(codes[3:]) == {429}


# ------------------------------------------------------------------ authenticated variant marks the user
def test_authenticated_verification_marks_user_only_after_provider_success(client, provider, make_user, login, db):
    uid = make_user()
    token = login()
    cur = db.cursor()
    cur.execute("SELECT aadhaar_verified, aadhaar_hash FROM users WHERE id=%s", (uid,))
    assert cur.fetchone() == (False, None)
    send(client)
    bad = client.post("/api/auth/verify-aadhaar", headers=bearer(token), json={"aadhaar": AADHAAR, "otp": "123456"})
    assert bad.status_code == 400
    cur.execute("SELECT aadhaar_verified FROM users WHERE id=%s", (uid,))
    assert cur.fetchone() == (False,)
    ok = client.post("/api/auth/verify-aadhaar", headers=bearer(token), json={"aadhaar": AADHAAR, "otp": GOOD_OTP})
    assert ok.status_code == 200 and ok.get_json()["aadhaar_verified"] is True
    cur.execute("SELECT aadhaar_verified, aadhaar_last4, aadhaar_hash IS NOT NULL, aadhaar_verified_at IS NOT NULL FROM users WHERE id=%s", (uid,))
    assert cur.fetchone() == (True, "0123", True, True)


def test_authenticated_verification_requires_login(client, provider):
    r = client.post("/api/auth/verify-aadhaar", json={"aadhaar": AADHAAR, "otp": GOOD_OTP})
    assert r.status_code == 401


def test_aadhaar_already_linked_to_another_account_is_rejected(client, provider, make_user, login, db):
    import sprint
    other = make_user(email="o@example.com", phone="9123456780")
    db.cursor().execute("UPDATE users SET aadhaar_hash=%s, aadhaar_verified=TRUE WHERE id=%s", (sprint._hash_aadhaar(AADHAAR), other))
    make_user()
    token = login()
    send(client)
    r = client.post("/api/auth/verify-aadhaar", headers=bearer(token), json={"aadhaar": AADHAAR, "otp": GOOD_OTP})
    assert r.status_code == 409
    cur = db.cursor()
    cur.execute("SELECT aadhaar_verified FROM users WHERE email='u@example.com'")
    assert cur.fetchone() == (False,)
