"""Phase 1: backend imports, entry points, configuration failures, no hard-coded secrets."""
import os
import re
import subprocess
import sys
from collections import Counter

import pytest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_backend_imports_and_sprint_registered_once(appmod):
    assert appmod.app.blueprints.keys() >= {"sprint"}
    assert list(appmod.app.blueprints).count("sprint") == 1


def test_no_duplicate_endpoints_or_url_rules(app):
    endpoints = Counter(r.endpoint for r in app.url_map.iter_rules())
    pairs = Counter((r.rule, m) for r in app.url_map.iter_rules() for m in r.methods - {"HEAD", "OPTIONS"})
    dup_pairs = [k for k, v in pairs.items() if v > 1]
    assert not dup_pairs, f"duplicate (url, method) registrations: {dup_pairs}"
    assert endpoints  # sanity


def test_sos_single_handler_on_both_urls(app):
    sos = [r for r in app.url_map.iter_rules() if "sos" in r.rule and "POST" in r.methods]
    assert {r.rule for r in sos} == {"/api/safety/sos", "/api/emergency/sos"}
    assert len({r.endpoint for r in sos}) == 1, "both SOS URLs must be served by the same handler"


def test_server_entrypoint_wraps_same_app(appmod):
    import importlib
    sys.modules.pop("server", None)
    server = importlib.import_module("server")  # must not raise duplicate blueprint registration
    assert callable(server.app)
    assert [b for b in appmod.app.blueprints].count("sprint") == 1


def _boot(env_overrides):
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONPATH": BACKEND, "DATABASE_URL": "postgresql://127.0.0.1:1/z"}
    for sys_var in ("SYSTEMROOT", "SystemRoot", "SYSTEMDRIVE", "WINDIR", "TEMP", "TMP"):
        if sys_var in os.environ:
            env[sys_var] = os.environ[sys_var]
    env.update(env_overrides)
    return subprocess.run([sys.executable, "-c", "import app"], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=60)


from cryptography.fernet import Fernet

GOOD_FERNET = Fernet.generate_key().decode()
GOOD_JWT = "unit-test-secret-" + "k" * 40


@pytest.mark.parametrize("jwt_value,expected", [
    (None, "JWT_SECRET_KEY is required and cannot be empty"),
    ("", "JWT_SECRET_KEY is required and cannot be empty"),
    ("   ", "JWT_SECRET_KEY is required and cannot be empty"),
    ("super-secret-key-for-samanvi", "using an insecure default"),
    ("short", "too short for production"),
])
def test_missing_or_weak_jwt_secret_fails_startup(jwt_value, expected):
    env = {"MESSAGE_ENCRYPTION_KEY": GOOD_FERNET}
    env["JWT_SECRET_KEY"] = "" if jwt_value is None else jwt_value  # '' beats any local .env file
    r = _boot(env)
    assert r.returncode != 0
    assert "RuntimeError" in r.stderr and expected in r.stderr, r.stderr[-400:]


def test_old_env_var_name_no_longer_accepted():
    r = _boot({"JWT_SECRET_KEY": "", "JWT_SECRET": GOOD_JWT, "MESSAGE_ENCRYPTION_KEY": GOOD_FERNET})
    assert r.returncode != 0 and "JWT_SECRET_KEY is required and cannot be empty" in r.stderr


def test_missing_or_invalid_encryption_key_fails_startup():
    r = _boot({"JWT_SECRET_KEY": GOOD_JWT, "MESSAGE_ENCRYPTION_KEY": ""})
    assert r.returncode != 0 and "MESSAGE_ENCRYPTION_KEY is required and cannot be empty" in r.stderr
    r = _boot({"JWT_SECRET_KEY": GOOD_JWT, "MESSAGE_ENCRYPTION_KEY": "x" * 44})
    assert r.returncode != 0 and "Fernet key" in r.stderr


def _source_files():
    for name in os.listdir(BACKEND):
        if name.endswith(".py"):
            yield name, open(os.path.join(BACKEND, name), encoding="utf-8").read()


def test_no_hardcoded_secret_fallbacks_or_otp_bypass_in_source():
    forbidden = {
        "old default JWT secret": r"super-secret-key-for-samanvi",
        "old default Fernet key": r"K3d4d3M4",
        "legacy JWT_SECRET env name": r"getenv\(\s*['\"]JWT_SECRET['\"]",
        "master OTP 123456": r"123456",
        "hard-coded personal name": r"NITHISH BARGAV",
        "plaintext twilio dev print": r"OTP Code:",
    }
    offenders = []
    for name, src in _source_files():
        if name.startswith("test_"):
            continue
        for label, rx in forbidden.items():
            for line in src.splitlines():
                if re.search(rx, line):
                    # the one allowed mention: the blocklist that REJECTS the old default secret
                    if label == "old default JWT secret" and (line.lstrip().startswith("_WEAK_SECRETS") or name == "config_validator.py"):
                        continue
                    if label == "master OTP 123456" and name == "verify_postgres_migration.py":
                        continue
                    if label == "master OTP 123456" and name == "config_validator.py":
                        continue
                    offenders.append((name, label, line.strip()[:60]))
    assert not offenders, offenders


def test_old_default_secret_appears_only_in_the_rejection_blocklist():
    src = open(os.path.join(BACKEND, "app.py"), encoding="utf-8").read()
    hits = [l for l in src.splitlines() if "super-secret-key-for-samanvi" in l]
    assert len(hits) == 1 and hits[0].lstrip().startswith("_WEAK_SECRETS")


def test_dev_otp_only_referenced_in_guarded_places():
    for name, src in _source_files():
        if "dev_otp" in src and not name.startswith("test_"):
            assert name in ("otp_service.py", "sprint.py", "config_validator.py"), name
    sprint = open(os.path.join(BACKEND, "sprint.py"), encoding="utf-8").read().splitlines()
    lines = [l.strip() for l in sprint if "dev_otp" in l]
    assert lines == ['if "dev_otp" in result:  # only ever present in explicit local-development mode',
                     'resp["dev_otp"] = result["dev_otp"]'], lines
