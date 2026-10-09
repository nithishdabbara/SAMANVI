"""Test harness: real PostgreSQL (embedded), real schema, real Flask app.  No product code is mocked
except the *transport* to external services (Twilio / Aadhaar provider) in the tests that need it."""
import ast
import importlib
import os
import re
import sys
import tempfile
import shutil

import psycopg2
import pytest
from cryptography.fernet import Fernet

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

TEST_JWT_SECRET = "test-only-" + "x" * 48
TEST_FERNET = Fernet.generate_key().decode()


def _extract_init_db_commands():
    """Pull the DDL strings out of init_db.create_tables() without running its DROP statements."""
    tree = ast.parse(open(os.path.join(BACKEND, "init_db.py"), encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "commands" for t in node.targets):
            return [ast.literal_eval(e) for e in node.value.elts]
    raise RuntimeError("commands tuple not found in init_db.py")


def _ddl_from_script(filename):
    src = open(os.path.join(BACKEND, filename), encoding="utf-8").read()
    return [m for m in re.findall(r"(?:'''|\"\"\")(.*?)(?:'''|\"\"\")", src, re.S) if "CREATE TABLE" in m.upper()]


@pytest.fixture(scope="session")
def pg():
    import pgserver
    d = tempfile.mkdtemp(prefix="samanvi-pg-")
    server = pgserver.get_server(d, cleanup_mode="delete")
    uri = server.get_uri()
    conn = psycopg2.connect(uri)
    conn.autocommit = True
    cur = conn.cursor()
    # the embedded server has no uuid-ossp extension; PostgreSQL 13+ ships gen_random_uuid() in core
    cur.execute("CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS 'select gen_random_uuid()' LANGUAGE sql")
    for ddl in _extract_init_db_commands():
        if "CREATE EXTENSION" in ddl.upper():
            continue
        cur.execute(ddl)
    for fname in ("rebuild_migration.sql", "safety_migration.sql"):
        cur.execute(open(os.path.join(BACKEND, "migrations", fname), encoding="utf-8").read())
    # NOTE: migrate_problem_offers.py is skipped on purpose: it declares problem_id INTEGER referencing a UUID
    # key, so it cannot run (audit Phase 5 item: needs a proper numbered migration).
    import migrate  # the new numbered-migration runner
    conn.autocommit = False
    migrate.apply_migrations(conn, verbose=False)
    conn.close()
    yield uri
    server.cleanup()
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture(scope="session")
def appmod(pg):
    os.environ.update({
        "DATABASE_URL": pg, "DB_SSLMODE": "disable", "JWT_SECRET_KEY": TEST_JWT_SECRET,
        "MESSAGE_ENCRYPTION_KEY": TEST_FERNET, "APP_ENV": "production", "ENABLE_LIVE_SMS": "false",
        "ALLOW_DEV_OTP": "false", "ALLOW_INSECURE_DB": "true",
    })
    for k in ("SANDBOX_API_KEY", "SANDBOX_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"):
        os.environ.pop(k, None)
    for m in ("app", "sprint", "otp_service", "extensions", "server"):
        sys.modules.pop(m, None)
    mod = importlib.import_module("app")
    mod.app.config["TESTING"] = True
    mod.limiter.enabled = False  # rate-limit tests switch it on explicitly
    return mod


@pytest.fixture()
def app(appmod):
    return appmod.app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def db(pg):
    conn = psycopg2.connect(pg, sslmode="disable")
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(autouse=True)
def clean_db(db, appmod):
    cur = db.cursor()
    cur.execute("TRUNCATE users, otp_challenges, aadhaar_challenges, token_blacklist, reports, notifications, "
                "emergency_contacts, user_blocks RESTART IDENTITY CASCADE")
    appmod.limiter.reset()
    appmod.limiter.enabled = False
    yield


@pytest.fixture()
def limits_on(appmod):
    appmod.limiter.reset()
    appmod.limiter.enabled = True
    yield
    appmod.limiter.enabled = False
    appmod.limiter.reset()


@pytest.fixture()
def make_user(db, appmod):
    def _make(email="u@example.com", phone="9876543210", password="correct-horse", home=(22.3072, 73.1812),
              radius=1, name="Test User", active=True):
        h = appmod.bcrypt.generate_password_hash(password).decode()
        cur = db.cursor()
        cur.execute(
            """INSERT INTO users (email, password_hash, name, full_name, nickname, phone, latitude, longitude, address, role,
                                  home_lat, home_lon, home_locality, home_verified, community_radius_km, trust_score, is_active)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'resident',%s,%s,'Testville',FALSE,%s,50.0,%s) RETURNING id""",
            (email, h, name, name, name.split()[0], phone, home[0], home[1], "Testville", home[0], home[1], radius, active))
        return str(cur.fetchone()[0])
    return _make


@pytest.fixture()
def login(client):
    def _login(email="u@example.com", password="correct-horse"):
        r = client.post("/api/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.get_json()
        return r.get_json()["token"]
    return _login


def bearer(token):
    return {"Authorization": f"Bearer {token}"}
