"""Phase 1: the two SOS handlers were merged; behaviour and database effects are verified."""
import pytest

from tests.conftest import bearer

ME = (22.3072, 73.1812)
NEAR = (22.3080, 73.1812)      # ~90 m
FAR = (22.5072, 73.1812)       # ~22 km


@pytest.fixture()
def world(make_user, db):
    ids = {
        "me": make_user(email="me@example.com", phone="9000000001", home=ME, name="Me Sender"),
        "near": make_user(email="near@example.com", phone="9000000002", home=NEAR, name="Near Neighbour"),
        "far": make_user(email="far@example.com", phone="9000000003", home=FAR, name="Far Away"),
        "blocked": make_user(email="blocked@example.com", phone="9000000004", home=NEAR, name="Blocked Near"),
        "inactive": make_user(email="gone@example.com", phone="9000000005", home=NEAR, name="Inactive Near", active=False),
    }
    db.cursor().execute("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (%s, %s)", (ids["blocked"], ids["me"]))
    return ids


def notif_users(db):
    cur = db.cursor()
    cur.execute("SELECT user_id::text, type FROM notifications")
    return {r[0] for r in cur.fetchall()}


@pytest.mark.parametrize("url", ["/api/safety/sos", "/api/emergency/sos"])
def test_both_urls_work_and_record_a_critical_sos_report(client, login, world, db, url):
    token = login("me@example.com")
    r = client.post(url, headers=bearer(token), json={"latitude": 22.31, "longitude": 73.18, "reason": "help"})
    j = r.get_json()
    assert r.status_code == 201 and j["report_id"]
    cur = db.cursor()
    cur.execute("SELECT reporter_id::text, status, report_type, live_location_lat, live_location_lon, reason FROM reports WHERE id=%s", (j["report_id"],))
    assert cur.fetchone() == (world["me"], "critical", "SOS", 22.31, 73.18, "help")


def test_works_without_a_request_body_like_the_sos_screen_sends(client, login, world, db):
    r = client.post("/api/emergency/sos", headers=bearer(login("me@example.com")))     # no JSON, no content-type
    assert r.status_code == 201
    cur = db.cursor()
    cur.execute("SELECT live_location_lat FROM reports WHERE id=%s", (r.get_json()["report_id"],))
    assert cur.fetchone()[0] is not None, "falls back to the sender's stored location"


def test_only_neighbours_inside_the_radius_are_notified(client, login, world, db):
    r = client.post("/api/emergency/sos", headers=bearer(login("me@example.com")), json={})
    assert r.get_json()["neighbors_alerted"] == 1
    assert notif_users(db) == {world["near"]}      # not far-away, blocked, inactive users, nor the sender


def test_invalid_coordinates_are_ignored_not_trusted(client, login, world, db):
    r = client.post("/api/safety/sos", headers=bearer(login("me@example.com")), json={"latitude": 999, "longitude": "abc"})
    assert r.status_code == 201
    cur = db.cursor()
    cur.execute("SELECT live_location_lat <= 90 FROM reports WHERE id=%s", (r.get_json()["report_id"],))
    assert cur.fetchone() == (True,)


def test_sos_requires_authentication(client, world, db):
    for url in ("/api/safety/sos", "/api/emergency/sos"):
        assert client.post(url, json={}).status_code == 401
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM reports")
    assert cur.fetchone() == (0,)


def test_contacts_are_not_claimed_alerted_without_an_sms_provider(client, login, world, db):
    db.cursor().execute("INSERT INTO emergency_contacts (user_id, name, phone) VALUES (%s,'Mom','9111111111')", (world["me"],))
    j = client.post("/api/emergency/sos", headers=bearer(login("me@example.com")), json={}).get_json()
    assert j["contacts_total"] == 1 and j["contacts_alerted"] == 0 and j["sms_status"] == "not_configured"


def test_contacts_texted_when_provider_accepts(client, login, world, db, monkeypatch):
    import otp_service
    sent = []
    monkeypatch.setenv("ENABLE_LIVE_SMS", "true")
    monkeypatch.setattr(otp_service, "send_text", lambda phone, body, channel="sms": sent.append((phone, body)) or True)
    db.cursor().execute("INSERT INTO emergency_contacts (user_id, name, phone) VALUES (%s,'Mom','9111111111'),(%s,'Dad','9222222222')",
                        (world["me"], world["me"]))
    j = client.post("/api/emergency/sos", headers=bearer(login("me@example.com")), json={"latitude": 22.31, "longitude": 73.18}).get_json()
    assert j["contacts_alerted"] == 2 and j["sms_status"] == "sent"
    assert {p for p, _ in sent} == {"9111111111", "9222222222"} and "Me Sender" in sent[0][1]


def test_sms_failure_is_reported_but_sos_is_still_recorded(client, login, world, db, monkeypatch):
    import otp_service
    monkeypatch.setenv("ENABLE_LIVE_SMS", "true")
    monkeypatch.setattr(otp_service, "send_text", lambda *a, **k: False)
    db.cursor().execute("INSERT INTO emergency_contacts (user_id, name, phone) VALUES (%s,'Mom','9111111111')", (world["me"],))
    j = client.post("/api/emergency/sos", headers=bearer(login("me@example.com")), json={}).get_json()
    assert j["sms_status"] == "failed" and j["contacts_alerted"] == 0
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM reports WHERE report_type='SOS'")
    assert cur.fetchone() == (1,)


def test_sos_rate_limited(client, login, world, limits_on):
    token = login("me@example.com")
    codes = [client.post("/api/emergency/sos", headers=bearer(token), json={}).status_code for _ in range(12)]
    assert codes[:10] == [201] * 10 and 429 in codes[10:]
