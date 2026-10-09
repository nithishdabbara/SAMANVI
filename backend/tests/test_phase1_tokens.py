"""Phase 1: password hashing, token generation/validation/expiry/revocation, protected endpoints."""
import base64
import datetime
import json
import re
import uuid

import jwt
import pytest

from tests.conftest import TEST_JWT_SECRET, bearer

NOW = lambda: datetime.datetime.now(datetime.timezone.utc)  # noqa: E731


def make_token(user_id, secret=TEST_JWT_SECRET, **over):
    claims = {"typ": "access", "user_id": str(user_id), "jti": str(uuid.uuid4()), "iat": NOW(),
              "exp": NOW() + datetime.timedelta(hours=1)}
    claims.update(over)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, secret, algorithm="HS256")


# ------------------------------------------------------------------ hashing + login
def test_password_stored_as_bcrypt_and_login_validates_it(client, make_user, db):
    make_user()
    cur = db.cursor()
    cur.execute("SELECT password_hash FROM users")
    assert cur.fetchone()[0].startswith("$2")
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 200
    bad = client.post("/api/auth/login", json={"email": "u@example.com", "password": "wrong"})
    assert bad.status_code == 401 and "token" not in bad.get_json()
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "wrong"})
    assert unknown.status_code == 401 and unknown.get_json() == bad.get_json()  # no user enumeration


def test_legacy_werkzeug_hash_still_logs_in_and_is_upgraded_to_bcrypt(client, make_user, db):
    from werkzeug.security import generate_password_hash
    make_user()
    cur = db.cursor()
    cur.execute("UPDATE users SET password_hash=%s", (generate_password_hash("correct-horse"),))
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 200
    cur.execute("SELECT password_hash FROM users")
    assert cur.fetchone()[0].startswith("$2"), "legacy hash should have been upgraded"
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 200


def test_inactive_user_cannot_log_in(client, make_user):
    make_user(active=False)
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).status_code == 401


def test_login_is_rate_limited(client, make_user, limits_on):
    make_user()
    codes = [client.post("/api/auth/login", json={"email": "u@example.com", "password": "bad"}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10 and 429 in codes[10:]


# ------------------------------------------------------------------ token generation
def test_login_token_claims_and_expiry(client, make_user):
    uid = make_user()
    token = client.post("/api/auth/login", json={"email": "u@example.com", "password": "correct-horse"}).get_json()["token"]
    p = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])
    assert p["typ"] == "access" and p["user_id"] == uid and p["jti"]
    assert abs((p["exp"] - p["iat"]) - 7 * 24 * 3600) < 1.5
    assert jwt.get_unverified_header(token)["alg"] == "HS256"


def test_token_works_on_protected_endpoint(client, make_user, login):
    make_user()
    r = client.get("/api/user/profile", headers=bearer(login()))
    assert r.status_code == 200


# ------------------------------------------------------------------ token validation
def test_missing_and_malformed_authorization_rejected(client, make_user):
    make_user()
    assert client.get("/api/user/profile").status_code == 401
    assert client.get("/api/user/profile", headers={"Authorization": "Token abc"}).status_code == 401
    assert client.get("/api/user/profile", headers={"Authorization": "Bearer"}).status_code == 401
    assert client.get("/api/user/profile", headers=bearer("not.a.jwt")).status_code == 401


def test_forged_tokens_rejected(client, make_user):
    uid = make_user()
    old_default = make_token(uid, secret="super-secret-key-for-samanvi")          # the former public fallback secret
    wrong_key = make_token(uid, secret="x" * 48)
    no_alg = jwt.encode({"typ": "access", "user_id": uid, "jti": "j", "iat": NOW(), "exp": NOW() + datetime.timedelta(hours=1)},
                        None, algorithm="none")
    for t in (old_default, wrong_key, no_alg):
        r = client.get("/api/user/profile", headers=bearer(t))
        assert r.status_code == 401, t


def test_tampered_payload_rejected(client, make_user, login):
    uid = make_user()
    other = make_user(email="o@example.com", phone="9876500000")
    good = login()
    head, payload, sig = good.split(".")
    forged_payload = base64.urlsafe_b64encode(
        json.dumps({"typ": "access", "user_id": other, "jti": "x", "iat": 1, "exp": 4102444800}).encode()).decode().rstrip("=")
    assert client.get("/api/user/profile", headers=bearer(f"{head}.{forged_payload}.{sig}")).status_code == 401


def test_expired_token_rejected_with_specific_code(client, make_user):
    uid = make_user()
    t = make_token(uid, iat=NOW() - datetime.timedelta(days=8), exp=NOW() - datetime.timedelta(days=1))
    r = client.get("/api/user/profile", headers=bearer(t))
    assert r.status_code == 401 and r.get_json()["code"] == "token_expired"


@pytest.mark.parametrize("missing", ["exp", "iat", "jti", "user_id"])
def test_tokens_missing_required_claims_rejected(client, make_user, missing):
    uid = make_user()
    claims = {"typ": "access", "user_id": uid, "jti": str(uuid.uuid4()), "iat": NOW(), "exp": NOW() + datetime.timedelta(hours=1)}
    claims.pop(missing)
    t = jwt.encode(claims, TEST_JWT_SECRET, algorithm="HS256")
    assert client.get("/api/user/profile", headers=bearer(t)).status_code == 401


def test_other_token_types_cannot_be_used_as_access_tokens(client, make_user, appmod):
    import otp_service
    uid = make_user()
    t = otp_service.issue_verification_token("9876543210", "password_reset", str(uuid.uuid4()))
    assert client.get("/api/user/profile", headers=bearer(t)).status_code == 401
    assert client.get("/api/user/profile", headers=bearer(make_token(uid, typ="refresh"))).status_code == 401


def test_valid_signature_for_unknown_user_rejected(client):
    assert client.get("/api/user/profile", headers=bearer(make_token(uuid.uuid4()))).status_code == 401


def test_deactivated_user_token_rejected(client, make_user, login, db):
    uid = make_user()
    t = login()
    db.cursor().execute("UPDATE users SET is_active=FALSE WHERE id=%s", (uid,))
    r = client.get("/api/user/profile", headers=bearer(t))
    assert r.status_code == 401 and r.get_json()["code"] == "account_disabled"


def test_fails_closed_when_database_unreachable(client, make_user, login, appmod, monkeypatch):
    make_user()
    t = login()
    monkeypatch.setattr(appmod, "get_db_connection", lambda: None)
    r = client.get("/api/user/profile", headers=bearer(t))
    assert r.status_code == 503, "an unreachable database must not let requests through"


# ------------------------------------------------------------------ logout / revocation
def test_logout_revokes_token_server_side(client, make_user, login, db):
    make_user()
    t = login()
    assert client.get("/api/user/profile", headers=bearer(t)).status_code == 200
    assert client.post("/api/auth/logout", headers=bearer(t)).status_code == 200
    r = client.get("/api/user/profile", headers=bearer(t))
    assert r.status_code == 401 and r.get_json()["code"] == "token_revoked"
    cur = db.cursor()
    jti = jwt.decode(t, TEST_JWT_SECRET, algorithms=["HS256"])["jti"]
    cur.execute("SELECT expires_at IS NOT NULL FROM token_blacklist WHERE jti=%s", (jti,))
    assert cur.fetchone() == (True,)
    # a second login still works (revocation is per token, not per user)
    assert client.get("/api/user/profile", headers=bearer(login())).status_code == 200


def test_tokens_issued_before_password_change_are_rejected(client, make_user, login, db):
    uid = make_user()
    old = login()
    db.cursor().execute("UPDATE users SET password_changed_at = NOW() + INTERVAL '2 seconds' WHERE id=%s", (uid,))
    r = client.get("/api/user/profile", headers=bearer(old))
    assert r.status_code == 401 and r.get_json()["code"] == "token_revoked"


# ------------------------------------------------------------------ every protected endpoint
def _protected_urls(app):
    out = []
    for rule in app.url_map.iter_rules():
        view = app.view_functions[rule.endpoint]
        if rule.rule.startswith("/api") and getattr(view, "requires_auth", False):
            url = re.sub(r"<[^>]+>", lambda m: str(uuid.uuid4()), rule.rule)
            for method in rule.methods - {"HEAD", "OPTIONS"}:
                out.append((method, url))
    return sorted(set(out))


def test_every_protected_endpoint_rejects_missing_invalid_expired_and_unknown_user_tokens(app, client, make_user):
    uid = make_user()
    protected = _protected_urls(app)
    assert len(protected) >= 40, f"expected many protected endpoints, found {len(protected)}"
    expired = make_token(uid, iat=NOW() - datetime.timedelta(days=9), exp=NOW() - datetime.timedelta(days=2))
    ghost = make_token(uuid.uuid4())
    bad = []
    for method, url in protected:
        for hdr in ({}, bearer("garbage"), bearer(expired), bearer(ghost)):
            r = client.open(url, method=method, headers=hdr, json={})
            if r.status_code != 401:
                bad.append((method, url, list(hdr.values())[:1], r.status_code))
    assert not bad, bad
