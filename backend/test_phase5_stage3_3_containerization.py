"""Automated Test Suite for SAMANVI Phase 5 — Stage 3.3.

Covers:
1. Startup configuration validation and security constraints.
2. Strict production mock-mode rejection (PUSH_MOCK_MODE, AADHAAR_MOCK_MODE, ALLOW_DEV_OTP, FLASK_DEBUG).
3. Non-leakage of secrets and credentials in error messages and summaries.
4. Health (liveness) vs. Readiness probe separation and error masking.
5. Non-destructive database preflight and schema verification.
6. Graceful shutdown signal handling and background worker lifecycle controls.
7. Dockerfile and .dockerignore structural security verification.
"""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from cryptography.fernet import Fernet

# Ensure testing environment for base imports
os.environ["APP_ENV"] = "testing"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-sufficiently-long-for-testing-123456"
os.environ["MESSAGE_ENCRYPTION_KEY"] = Fernet.generate_key().decode()

import config_validator
import db_preflight
from app import app, _handle_shutdown_signal
import notification_service


class TestStartupConfigValidation(unittest.TestCase):
    """Test suite for config_validator.py."""

    def setUp(self):
        self.valid_fernet = Fernet.generate_key().decode()
        self.valid_prod_env = {
            "APP_ENV": "production",
            "JWT_SECRET_KEY": "a-very-strong-production-jwt-secret-key-32-chars!!",
            "MESSAGE_ENCRYPTION_KEY": self.valid_fernet,
            "DATABASE_URL": "postgresql://user:pass@db.example.com:5432/samanvidb",
            "DB_SSLMODE": "require",
            "PUSH_MOCK_MODE": "false",
            "AADHAAR_MOCK_MODE": "false",
            "ALLOW_DEV_OTP": "false",
            "FLASK_DEBUG": "0",
            "ENABLE_PUSH_WORKER": "false",
        }

    def test_valid_production_config_passes(self):
        """A properly configured production environment passes validation with 0 errors."""
        ok, errors = config_validator.validate_config(self.valid_prod_env)
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_missing_jwt_secret_rejected(self):
        """Missing or empty JWT_SECRET_KEY is rejected."""
        env = dict(self.valid_prod_env, JWT_SECRET_KEY="")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("JWT_SECRET_KEY is required" in e for e in errors))

    def test_weak_jwt_secret_rejected(self):
        """Placeholder or weak JWT secrets are rejected."""
        env = dict(self.valid_prod_env, JWT_SECRET_KEY="super-secret-key-for-samanvi")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("insecure default or placeholder" in e for e in errors))

    def test_short_jwt_secret_rejected_in_production(self):
        """JWT_SECRET_KEY with fewer than 32 characters is rejected in production."""
        env = dict(self.valid_prod_env, JWT_SECRET_KEY="short-secret-key-under-32-chars")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("too short for production" in e for e in errors))

    def test_invalid_message_encryption_key_rejected(self):
        """Invalid Fernet key format is rejected with actionable error."""
        env = dict(self.valid_prod_env, MESSAGE_ENCRYPTION_KEY="not-a-valid-fernet-key")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("valid 32-byte URL-safe base64-encoded Fernet key" in e for e in errors))

    def test_missing_database_url_rejected(self):
        """Missing DATABASE_URL is rejected."""
        env = dict(self.valid_prod_env, DATABASE_URL="")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("DATABASE_URL is required" in e for e in errors))

    def test_invalid_database_url_scheme_rejected(self):
        """Non-PostgreSQL DATABASE_URL scheme is rejected."""
        env = dict(self.valid_prod_env, DATABASE_URL="mysql://root:pass@localhost/db")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("must be a valid PostgreSQL connection URI" in e for e in errors))

    def test_production_rejects_push_mock_mode(self):
        """PUSH_MOCK_MODE=true in production raises security violation."""
        env = dict(self.valid_prod_env, PUSH_MOCK_MODE="true")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("PUSH_MOCK_MODE is strictly forbidden in production" in e for e in errors))

    def test_production_rejects_aadhaar_mock_mode(self):
        """AADHAAR_MOCK_MODE=true in production raises security violation."""
        env = dict(self.valid_prod_env, AADHAAR_MOCK_MODE="true")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("AADHAAR_MOCK_MODE is strictly forbidden in production" in e for e in errors))

    def test_production_rejects_allow_dev_otp(self):
        """ALLOW_DEV_OTP=true in production raises security violation."""
        env = dict(self.valid_prod_env, ALLOW_DEV_OTP="true")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("ALLOW_DEV_OTP is strictly forbidden in production" in e for e in errors))

    def test_production_rejects_flask_debug(self):
        """FLASK_DEBUG=1 in production raises security violation."""
        env = dict(self.valid_prod_env, FLASK_DEBUG="1")
        ok, errors = config_validator.validate_config(env)
        self.assertFalse(ok)
        self.assertTrue(any("FLASK_DEBUG must be 0/disabled in production" in e for e in errors))

    def test_dev_mode_permits_mock_modes(self):
        """Development mode (APP_ENV=development) allows mock modes without errors."""
        dev_env = {
            "APP_ENV": "development",
            "JWT_SECRET_KEY": "dev-jwt-secret-at-least-16-chars",
            "MESSAGE_ENCRYPTION_KEY": self.valid_fernet,
            "DATABASE_URL": "postgresql://localhost:5432/devdb",
            "PUSH_MOCK_MODE": "true",
            "AADHAAR_MOCK_MODE": "true",
            "ALLOW_DEV_OTP": "true",
            "FLASK_DEBUG": "1",
        }
        ok, errors = config_validator.validate_config(dev_env)
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_zero_secret_leakage_in_error_messages(self):
        """Error messages never echo back the secret or password values."""
        secret_value = "SensitiveRawPassword12345"
        env = dict(self.valid_prod_env, JWT_SECRET_KEY=secret_value, PUSH_MOCK_MODE="true")
        ok, errors = config_validator.validate_config(env)
        for err in errors:
            self.assertNotIn(secret_value, err)

    def test_sanitized_summary_hides_secrets(self):
        """get_sanitized_summary returns only boolean presence flags, never secret strings."""
        summary = config_validator.get_sanitized_summary(self.valid_prod_env)
        self.assertIsInstance(summary["jwt_secret_configured"], bool)
        self.assertIsInstance(summary["message_encryption_configured"], bool)
        self.assertTrue(summary["jwt_secret_configured"])
        self.assertTrue(summary["message_encryption_configured"])
        # Ensure no actual key content is present
        summary_str = str(summary)
        self.assertNotIn(self.valid_prod_env["JWT_SECRET_KEY"], summary_str)
        self.assertNotIn(self.valid_prod_env["MESSAGE_ENCRYPTION_KEY"], summary_str)

    def test_validate_or_exit_raises_runtime_error(self):
        """validate_or_exit raises RuntimeError when configuration is invalid."""
        invalid_env = dict(self.valid_prod_env, JWT_SECRET_KEY="")
        with self.assertRaises(RuntimeError) as ctx:
            config_validator.validate_or_exit(invalid_env)
        self.assertIn("Startup configuration validation failed", str(ctx.exception))


class TestHealthAndReadinessEndpoints(unittest.TestCase):
    """Test suite for /health (liveness) and /ready (readiness) endpoints."""

    def setUp(self):
        self.client = app.test_client()

    def test_liveness_returns_200_without_db(self):
        """GET /health (liveness) returns 200 OK even if database connection fails."""
        with patch('app.get_db_connection', return_value=None):
            resp = self.client.get('/health')
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["status"], "healthy")
            self.assertEqual(data["service"], "samanvi-api")

    def test_liveness_alias_returns_200(self):
        """GET /api/health/live alias returns 200 OK."""
        resp = self.client.get('/api/health/live')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["status"], "healthy")

    def test_readiness_returns_200_when_database_connected(self):
        """GET /ready returns 200 OK when database is reachable."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = (1,)

        with patch('app.get_db_connection', return_value=mock_conn):
            resp = self.client.get('/ready')
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["status"], "ready")
            self.assertEqual(data["database"], "connected")
            mock_conn.close.assert_called_once()

    def test_readiness_returns_503_when_database_unavailable(self):
        """GET /ready returns 503 Service Unavailable when database connection is None."""
        with patch('app.get_db_connection', return_value=None):
            resp = self.client.get('/ready')
            self.assertEqual(resp.status_code, 503)
            data = resp.get_json()
            self.assertEqual(data["status"], "not_ready")
            self.assertEqual(data["database"], "unavailable")

    def test_readiness_returns_503_on_database_exception(self):
        """GET /ready returns 503 when query execution throws an exception."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.execute.side_effect = Exception("FATAL: connection timeout to db.internal.net:5432")
        mock_conn.cursor.return_value = mock_cur

        with patch('app.get_db_connection', return_value=mock_conn):
            resp = self.client.get('/ready')
            self.assertEqual(resp.status_code, 503)
            data = resp.get_json()
            self.assertEqual(data["status"], "not_ready")
            self.assertEqual(data["database"], "unavailable")
            # Ensure internal connection details / hostnames are NOT leaked in response
            self.assertNotIn("db.internal.net", str(data))
            self.assertNotIn("FATAL", str(data))

    def test_backwards_compatible_api_health(self):
        """GET /api/health maintains backward compatibility (200 on connect, 500 on fail)."""
        mock_conn = MagicMock()
        with patch('app.get_db_connection', return_value=mock_conn):
            resp = self.client.get('/api/health')
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.get_json()["status"], "healthy")

        with patch('app.get_db_connection', return_value=None):
            resp = self.client.get('/api/health')
            self.assertEqual(resp.status_code, 500)
            self.assertEqual(resp.get_json()["status"], "unhealthy")


class TestDatabasePreflightSafeguards(unittest.TestCase):
    """Test suite for db_preflight.py."""

    def test_sanitize_db_url_masks_password(self):
        """sanitize_db_url masks cleartext password in PostgreSQL URI."""
        url = "postgresql://samanvi_user:MySuperSecretPass123@db-host.com:5432/samanvi"
        clean = db_preflight.sanitize_db_url(url)
        self.assertNotIn("MySuperSecretPass123", clean)
        self.assertIn("samanvi_user:***@db-host.com", clean)

    def test_preflight_fails_safely_when_unreachable(self):
        """run_preflight_check returns failure without raising uncaught exceptions when DB is unreachable."""
        with patch('psycopg2.connect', side_effect=Exception("could not connect to server at 10.0.0.1:5432")):
            res = db_preflight.run_preflight_check("postgresql://user:pass@10.0.0.1:5432/db")
            self.assertFalse(res["ok"])
            self.assertFalse(res["connected"])
            self.assertIn("connectivity failed", res["error"])

    def test_preflight_detects_missing_required_tables(self):
        """check_schema_state flags missing required tables cleanly."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        # Simulate DB having only users and problems, missing notifications, push_tokens, reviews, categories
        mock_cur.fetchall.side_effect = [
            [{"table_name": "users"}, {"table_name": "problems"}],  # tables
        ]

        state = db_preflight.check_schema_state(mock_conn)
        self.assertFalse(state["ok"])
        self.assertFalse(state["schema_ready"])
        self.assertIn("notifications", state["missing_tables"])
        self.assertIn("push_tokens", state["missing_tables"])
        self.assertIn("reviews", state["missing_tables"])
        self.assertIn("categories", state["missing_tables"])

    def test_preflight_succeeds_when_all_tables_present(self):
        """check_schema_state confirms schema readiness when all tables exist."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchall.side_effect = [
            # tables
            [{"table_name": t} for t in db_preflight.REQUIRED_TABLES + ["schema_migrations"]],
            # schema_migrations versions
            [{"version": "002_security_hardening.sql"}, {"version": "003_push_tokens.sql"}],
            # notifications columns
            [{"column_name": "idempotency_key"}, {"column_name": "push_status"}, {"column_name": "push_attempts"}],
            # push_tokens columns
            [{"column_name": "user_id"}, {"column_name": "token"}, {"column_name": "is_active"}],
        ]

        state = db_preflight.check_schema_state(mock_conn)
        self.assertTrue(state["ok"])
        self.assertEqual(len(state["missing_tables"]), 0)
        self.assertTrue(state["has_migration_table"])


class TestGracefulShutdownAndWorkerLifecycle(unittest.TestCase):
    """Test suite for shutdown signals, Gunicorn worker compatibility, and background worker lifecycle."""

    def test_shutdown_cleanup_calls_stop_worker(self):
        """Invoking shutdown cleanup calls notification_service.stop_background_recovery_worker cleanly."""
        from app import _stop_worker_gracefully
        with patch('notification_service.stop_background_recovery_worker') as mock_stop:
            _stop_worker_gracefully()
            mock_stop.assert_called_once()

    def test_recovery_worker_stops_when_event_set(self):
        """start_background_recovery_worker and stop_background_recovery_worker manage thread state cleanly."""
        mock_conn_fn = MagicMock()
        worker = notification_service.start_background_recovery_worker(mock_conn_fn, interval_seconds=100)
        self.assertIsNotNone(worker)
        self.assertTrue(worker.is_alive())

        notification_service.stop_background_recovery_worker()
        self.assertFalse(worker.is_alive())
        self.assertIsNone(notification_service._recovery_worker_thread)

    def test_reset_scoped_to_worker_owned_notification_ids(self):
        """reset_stuck_processing_pushes scopes reset strictly to worker-owned IDs when provided."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.rowcount = 2

        worker_ids = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"]
        count = notification_service.reset_stuck_processing_pushes(lambda: mock_conn, notification_ids=worker_ids)
        self.assertEqual(count, 2)
        mock_conn.commit.assert_called_once()
        sql = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]
        self.assertIn("id = ANY(%s::uuid[])", sql)
        self.assertIn("push_status = 'processing'", sql)
        self.assertEqual(params[0], worker_ids)

    def test_reset_without_ids_enforces_stale_age_timeout(self):
        """reset_stuck_processing_pushes without IDs requires stale timeout and never globally resets all processing rows."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.rowcount = 1

        count = notification_service.reset_stuck_processing_pushes(lambda: mock_conn, stale_after_seconds=300)
        self.assertEqual(count, 1)
        mock_conn.commit.assert_called_once()
        sql = mock_cur.execute.call_args[0][0]
        self.assertIn("updated_at < NOW() - (%s * INTERVAL '1 second')", sql)
        self.assertNotIn("WHERE push_status = 'processing';", sql)  # NEVER an un-scoped global reset

    def test_concurrent_worker_active_notification_protected_from_shutdown_reset(self):
        """Worker A's shutdown does not reset or interfere with Worker B's active in-flight notification."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # Worker A owns notif_A; Worker B owns notif_B
        notif_a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        notif_b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

        # Simulate Worker A tracking only its owned ID in _in_flight_notification_ids
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.clear()
            notification_service._in_flight_notification_ids.add(notif_a_id)

        # Worker A shuts down
        notification_service.stop_background_recovery_worker(lambda: mock_conn)

        # Verify SQL executed by Worker A's shutdown:
        self.assertTrue(mock_cur.execute.called)
        executed_params = mock_cur.execute.call_args[0][1]
        # Only Worker A's ID was passed to the reset query; Worker B's ID was NEVER included
        self.assertIn(notif_a_id, executed_params[0])
        self.assertNotIn(notif_b_id, executed_params[0])
        # In-flight set for Worker A is now cleaned up
        with notification_service._in_flight_lock:
            self.assertEqual(len(notification_service._in_flight_notification_ids), 0)

    def test_should_start_push_worker_logic(self):
        """_should_start_push_worker returns False in testing or prod, and respects explicit flags."""
        from app import _should_start_push_worker

        # In testing environment
        with patch.dict(os.environ, {"APP_ENV": "testing"}):
            self.assertFalse(_should_start_push_worker())

        # In production without explicit flag -> False (prevents duplicate Gunicorn workers)
        with patch.dict(os.environ, {"APP_ENV": "production"}, clear=False):
            os.environ.pop("ENABLE_PUSH_WORKER", None)
            self.assertFalse(_should_start_push_worker())

        # With explicit ENABLE_PUSH_WORKER=true in dev
        with patch.dict(os.environ, {"APP_ENV": "development", "ENABLE_PUSH_WORKER": "true"}):
            self.assertTrue(_should_start_push_worker())

        # With explicit ENABLE_PUSH_WORKER=false in dev
        with patch.dict(os.environ, {"APP_ENV": "development", "ENABLE_PUSH_WORKER": "false"}):
            self.assertFalse(_should_start_push_worker())


class TestContainerStructureSmoke(unittest.TestCase):
    """Static inspection of Dockerfile and .dockerignore for security and compliance."""

    def test_dockerfile_exists_and_contains_best_practices(self):
        """Backend Dockerfile specifies non-root user, slim python, and healthcheck."""
        dockerfile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Dockerfile")
        self.assertTrue(os.path.exists(dockerfile_path), "backend/Dockerfile must exist")
        with open(dockerfile_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("python:3.11-slim", content)
        self.assertIn("USER samanvi", content)
        self.assertIn("EXPOSE 5000", content)
        self.assertIn("HEALTHCHECK", content)
        self.assertIn("/health", content)
        self.assertIn("gunicorn", content)

    def test_dockerignore_excludes_credentials(self):
        """backend/.dockerignore excludes .env and credential patterns."""
        ignore_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dockerignore")
        self.assertTrue(os.path.exists(ignore_path), "backend/.dockerignore must exist")
        with open(ignore_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn(".env", content)
        self.assertIn("*.key", content)
        self.assertIn("*.pem", content)
        self.assertIn("*credentials*.json", content)
        self.assertIn("venv", content)


class TestNotificationRecoveryConcurrencyAndFencing(unittest.TestCase):
    """Mocked unit tests for notification ownership, stale recovery, lease fencing, and overwrite prevention."""

    def setUp(self):
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.clear()
            notification_service._in_flight_claimed_times.clear()

    def test_notification_legitimately_in_progress_lease_refresh(self):
        """Notification in progress beyond stale timeout can refresh its lease (updated_at = NOW())."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        t0 = datetime(2026, 10, 10, 0, 56, 0, tzinfo=timezone.utc)
        new_timestamp = datetime(2026, 10, 10, 1, 0, 0, tzinfo=timezone.utc)
        mock_cur.fetchone.return_value = (new_timestamp,)

        notif_id = "11111111-1111-1111-1111-111111111111"
        # Worker has registered initial claim timestamp
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.add(notif_id)
            notification_service._in_flight_claimed_times[notif_id] = t0

        res = notification_service.refresh_notification_lease(lambda: mock_conn, notif_id)

        self.assertTrue(res.get("ok"))
        self.assertTrue(res.get("renewed"))
        self.assertEqual(res.get("updated_at"), new_timestamp)
        mock_cur.execute.assert_called_once()
        sql = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]
        self.assertIn("UPDATE notifications", sql)
        self.assertIn("SET updated_at = NOW()", sql)
        self.assertIn("push_status = 'processing' AND updated_at = %s", sql)
        self.assertEqual(params[1], t0)

        # In-memory tracking updated with renewed lease
        with notification_service._in_flight_lock:
            self.assertEqual(notification_service._in_flight_claimed_times.get(notif_id), new_timestamp)

    def test_unregistered_worker_cannot_refresh_lease_without_claim_timestamp(self):
        """Caller with no registered ownership token and no claim timestamp is rejected immediately."""
        mock_conn = MagicMock()
        notif_id = "99999999-9999-9999-9999-999999999999"
        res = notification_service.refresh_notification_lease(lambda: mock_conn, notif_id)
        self.assertFalse(res.get("ok"))
        self.assertFalse(res.get("renewed"))
        self.assertIn("no registered ownership token", res.get("error", ""))

    def test_worker_a_cannot_refresh_worker_b_reclaimed_lease(self):
        """Worker A attempting to refresh a lease already reclaimed by Worker B is rejected via timestamp check."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = None  # 0 rows returned because updated_at was bumped by Worker B

        notif_id = "22222222-2222-2222-2222-222222222222"
        t0 = datetime(2026, 10, 10, 1, 0, 0, tzinfo=timezone.utc)

        # Worker A registers claim in tracking
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.add(notif_id)
            notification_service._in_flight_claimed_times[notif_id] = t0

        res = notification_service.refresh_notification_lease(lambda: mock_conn, notif_id, expected_claim_timestamp=t0)

        # Refresh must fail
        self.assertFalse(res.get("ok"))
        self.assertFalse(res.get("renewed"))
        self.assertIn("reclaimed by another worker", res.get("message", ""))

        # Verified SQL checked both id AND caller's expected_claim_timestamp
        sql = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]
        self.assertIn("WHERE id = %s AND push_status = 'processing' AND updated_at = %s", sql)
        self.assertEqual(params[0], notif_id)
        self.assertEqual(params[1], t0)

        # Local tracking cleared so Worker A cannot interfere further
        with notification_service._in_flight_lock:
            self.assertNotIn(notif_id, notification_service._in_flight_notification_ids)
            self.assertNotIn(notif_id, notification_service._in_flight_claimed_times)

    def test_lease_refresh_followed_by_valid_final_dispatch_update(self):
        """Legitimate lease refresh synchronizes in-flight timestamp so final dispatch update succeeds."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        notif_id = "33333333-3333-3333-3333-333333333333"
        t0 = datetime(2026, 10, 10, 1, 0, 0, tzinfo=timezone.utc)
        t_renewed = datetime(2026, 10, 10, 1, 4, 30, tzinfo=timezone.utc)

        # 1. Worker registers initial claim
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.add(notif_id)
            notification_service._in_flight_claimed_times[notif_id] = t0

        # 2. Worker refreshes lease mid-flight
        mock_cur.fetchone.return_value = (t_renewed,)
        res_refresh = notification_service.refresh_notification_lease(lambda: mock_conn, notif_id, expected_claim_timestamp=t0)
        self.assertTrue(res_refresh.get("renewed"))
        self.assertEqual(res_refresh.get("updated_at"), t_renewed)

        # 3. Worker executes final dispatch update
        # fetchone for existing record lookup (idempotency conflict check)
        mock_cur.fetchone.side_effect = [
            None,  # INSERT returns None (conflict)
            {'id': notif_id, 'push_status': 'processing', 'push_attempts': 0}
        ]
        mock_cur.fetchall.return_value = [{'token': 'ExponentPushToken[dev]', 'token_type': 'expo'}]
        mock_cur.rowcount = 1  # Successfully matched updated_at = t_renewed

        with patch('notification_service.is_mock_mode', return_value=False), \
             patch('notification_service._dispatch_expo_push', return_value={'status': 'delivered_to_provider'}):
            res_dispatch = notification_service.create_and_dispatch_notification(
                lambda: mock_conn,
                user_id='u1',
                title='Sync Test',
                body='Body',
                notification_type='test',
                idempotency_key='key-sync-1',
                expected_claim_timestamp=t0  # Initial timestamp passed at start
            )

            # Verified dispatch status succeeded and was NOT suppressed
            self.assertTrue(res_dispatch.get("ok"))
            self.assertTrue(res_dispatch.get("pushed"))
            self.assertFalse(res_dispatch.get("stale_update_suppressed"))

            # Check that final UPDATE query used the synchronized t_renewed timestamp!
            update_calls = [c for c in mock_cur.execute.call_args_list if "UPDATE notifications" in c[0][0]]
            final_update = update_calls[-1]
            sql = final_update[0][0]
            params = final_update[0][1]
            self.assertIn("updated_at = %s", sql)
            self.assertEqual(params[3], t_renewed, "Final update must use the synchronized refreshed timestamp")

    def test_stale_record_reclaimed_safely(self):
        """Stale records in 'processing' status (> 5 mins) are reclaimed with fresh lease timestamp."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        stale_id = "stale-1111-1111-1111-111111111111"
        fresh_time = datetime(2026, 10, 10, 1, 5, 0, tzinfo=timezone.utc)
        items = [{
            'id': stale_id,
            'user_id': 'u1',
            'title': 'Stale Task',
            'body': 'Content',
            'type': 'test',
            'related_id': None,
            'idempotency_key': 'key-stale-1',
            'push_attempts': 1,
            'updated_at': fresh_time
        }]
        mock_cur.fetchall.return_value = items

        with patch('notification_service.create_and_dispatch_notification', return_value={'ok': True, 'mocked': True}) as mock_dispatch:
            recovered = notification_service.process_pending_pushes(lambda: mock_conn)
            self.assertEqual(recovered, 1)

            # Verified query claims processing rows with updated_at < NOW() - 5 mins
            sql = mock_cur.execute.call_args[0][0]
            self.assertIn("push_status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'", sql)
            self.assertIn("FOR UPDATE SKIP LOCKED", sql)

            # Verified fresh claim timestamp was passed to dispatch
            mock_dispatch.assert_called_once()
            call_kwargs = mock_dispatch.call_args[1]
            self.assertEqual(call_kwargs.get('expected_claim_timestamp'), fresh_time)

    def test_original_worker_cannot_overwrite_newer_worker_after_ownership_change(self):
        """Late worker attempting update after ownership changed has update suppressed via conditional timestamp."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # Scenario: Worker A holds old timestamp T0. Row was reclaimed by Worker B (bumping timestamp).
        # When Worker A runs its UPDATE query, cur.rowcount is 0 (mismatch on updated_at = %s).
        mock_cur.fetchone.side_effect = [
            None,  # INSERT returns None (conflict)
            {'id': 'notif-late-1', 'push_status': 'processing', 'push_attempts': 1}  # SELECT existing
        ]
        mock_cur.fetchall.return_value = [{'token': 'ExponentPushToken[test]', 'token_type': 'expo'}]
        mock_cur.rowcount = 0  # 0 rows updated because updated_at was bumped by Worker B

        t0 = datetime(2026, 10, 10, 0, 0, 0, tzinfo=timezone.utc)
        with patch('notification_service.is_mock_mode', return_value=False), \
             patch('notification_service._dispatch_expo_push', return_value={'status': 'delivered_to_provider'}):
            res = notification_service.create_and_dispatch_notification(
                lambda: mock_conn,
                user_id='u1',
                title='Late Msg',
                body='Body',
                notification_type='test',
                idempotency_key='key-late-1',
                expected_claim_timestamp=t0
            )

            self.assertTrue(res.get("ok"))
            self.assertTrue(res.get("stale_update_suppressed"), "Stale update must be detected and suppressed")

            # Check that executed UPDATE checked updated_at = %s
            update_calls = [c for c in mock_cur.execute.call_args_list if "UPDATE notifications" in c[0][0]]
            self.assertTrue(len(update_calls) > 0)
            sql = update_calls[0][0][0]
            params = update_calls[0][0][1]
            self.assertIn("updated_at = %s", sql)
            self.assertIn(t0, params)

    def test_shutdown_cleanup_racing_with_notification_completion(self):
        """Shutdown cleanup respects lease fencing and does not reset completed or reclaimed work."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_cur.rowcount = 0

        # Worker A held notif_a with claim time T0
        notif_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        t0 = datetime(2026, 10, 10, 0, 0, 0, tzinfo=timezone.utc)

        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.add(notif_a)
            notification_service._in_flight_claimed_times[notif_a] = t0

        # Shutdown runs
        notification_service.stop_background_recovery_worker(lambda: mock_conn)

        # Verify that reset was scoped to the exact ID AND claim timestamp
        self.assertTrue(mock_cur.execute.called)
        sql = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]
        self.assertIn("WHERE id = %s AND push_status = 'processing' AND updated_at = %s", sql)
        self.assertEqual(params[0], notif_a)
        self.assertEqual(params[1], t0)

        # In-flight tracking cleared
        with notification_service._in_flight_lock:
            self.assertEqual(len(notification_service._in_flight_notification_ids), 0)
            self.assertEqual(len(notification_service._in_flight_claimed_times), 0)

    def test_retry_behavior_when_provider_succeeds_but_db_fails(self):
        """When push provider succeeds but DB commit fails, transaction rolls back and notification is retried."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        mock_cur.fetchone.side_effect = [
            {'id': 'notif-retry-1'},  # INSERT RETURNING id
            [{'token': 'ExponentPushToken[device-1]', 'token_type': 'expo'}]  # active tokens
        ]
        # Simulate DB error during final status update/commit
        mock_conn.commit.side_effect = [None, Exception("DB Connection Lost during status commit")]

        with patch('notification_service.is_mock_mode', return_value=False), \
             patch('notification_service._dispatch_expo_push', return_value={'status': 'delivered_to_provider'}):
            res = notification_service.create_and_dispatch_notification(
                lambda: mock_conn,
                user_id='u1',
                title='Test Retry',
                body='Body',
                notification_type='test',
                idempotency_key='key-retry-1'
            )

            # Handler catches DB failure safely and rolls back
            self.assertFalse(res.get("ok"))
            self.assertIn("DB Connection Lost", res.get("error", ""))
            mock_conn.rollback.assert_called()


class TestPostgresNotificationConcurrencyIntegration(unittest.TestCase):
    """Isolated PostgreSQL 16.2 database integration tests verifying real concurrency, SKIP LOCKED, and lease fencing."""

    @classmethod
    def setUpClass(cls):
        try:
            import pgserver
            import tempfile
            import psycopg2
            from psycopg2.extras import RealDictCursor
            cls.temp_dir = tempfile.mkdtemp(prefix="samanvi-concurrency-test-")
            cls.server = pgserver.get_server(cls.temp_dir, cleanup_mode="delete")
            cls.uri = cls.server.get_uri()
            cls.available = True

            # Initialize schema
            conn = psycopg2.connect(cls.uri)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone_number VARCHAR(15) UNIQUE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    body TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    related_id UUID,
                    idempotency_key VARCHAR(128) UNIQUE,
                    push_status VARCHAR(30) DEFAULT 'pending',
                    push_attempts INTEGER DEFAULT 0,
                    pushed_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS push_tokens (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    token_type VARCHAR(20) NOT NULL DEFAULT 'fcm',
                    platform VARCHAR(20) NOT NULL DEFAULT 'android',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            cur.close()
            conn.close()
        except Exception:
            cls.available = False

    def get_conn(self):
        import psycopg2
        return psycopg2.connect(self.uri)

    def test_postgres_real_skip_locked_and_lease_renewal(self):
        """Native PostgreSQL 16.2: FOR UPDATE SKIP LOCKED claims exclusively and renews lease."""
        if not getattr(self, 'available', False):
            self.skipTest("pgserver PostgreSQL instance unavailable on host")

        conn = self.get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM notifications;")
        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key, push_status, push_attempts, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Test PG', 'Body', 'test', 'pg-conc-1', 'pending', 0, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute')
            RETURNING id, updated_at;
        """)
        row = cur.fetchone()
        nid = str(row[0])
        conn.commit()

        # Run process_pending_pushes against real PostgreSQL
        with patch('notification_service.create_and_dispatch_notification', return_value={'ok': True, 'mocked': True}):
            recovered = notification_service.process_pending_pushes(self.get_conn)
            self.assertEqual(recovered, 1)

        # Verify that record was claimed and its updated_at was bumped to NOW()
        cur.execute("SELECT push_status, updated_at FROM notifications WHERE id = %s", (nid,))
        res = cur.fetchone()
        self.assertEqual(res[0], 'processing')
        # updated_at was refreshed from the initial 1 minute ago
        cur.execute("SELECT (updated_at > NOW() - INTERVAL '5 seconds') FROM notifications WHERE id = %s", (nid,))
        self.assertTrue(cur.fetchone()[0], "Claiming must establish a fresh lease timestamp in PostgreSQL")
        cur.close()
        conn.close()

    def test_postgres_late_worker_fenced_by_claim_timestamp(self):
        """Native PostgreSQL 16.2: Late worker cannot overwrite row whose claim timestamp was bumped."""
        if not getattr(self, 'available', False):
            self.skipTest("pgserver PostgreSQL instance unavailable on host")

        conn = self.get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM notifications;")
        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key, push_status, push_attempts, updated_at)
            VALUES (gen_random_uuid(), 'PG Fence', 'Body', 'test', 'pg-fence-1', 'processing', 0, NOW() - INTERVAL '6 minutes')
            RETURNING id, updated_at;
        """)
        row = cur.fetchone()
        nid = str(row[0])
        old_time = row[1]
        conn.commit()

        # Newer worker reclaims and bumps updated_at
        cur.execute("""
            UPDATE notifications
            SET push_status = 'sent', updated_at = NOW()
            WHERE id = %s
            RETURNING updated_at;
        """, (nid,))
        new_time = cur.fetchone()[0]
        conn.commit()

        # Stale worker attempts late conditional update with old_time
        cur.execute("""
            UPDATE notifications
            SET push_status = 'failed', push_attempts = push_attempts + 1, updated_at = NOW()
            WHERE id = %s
              AND updated_at = %s
              AND (push_status IN ('processing', 'pending'));
        """, (nid, old_time))
        stale_rows_updated = cur.rowcount
        conn.commit()

        # The stale update matches 0 rows!
        self.assertEqual(stale_rows_updated, 0, "PostgreSQL engine must reject update with stale claim timestamp")

        # Record remains 'sent'
        cur.execute("SELECT push_status FROM notifications WHERE id = %s", (nid,))
        self.assertEqual(cur.fetchone()[0], 'sent')
        cur.close()
        conn.close()

    def test_postgres_worker_a_cannot_refresh_worker_b_reclaimed_lease(self):
        """Native PostgreSQL 16.2: Worker A cannot refresh a lease reclaimed by Worker B."""
        if not getattr(self, 'available', False):
            self.skipTest("pgserver PostgreSQL instance unavailable on host")

        conn = self.get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM notifications;")
        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key, push_status, push_attempts, updated_at)
            VALUES (gen_random_uuid(), 'PG Reclaim', 'Body', 'test', 'pg-reclaim-1', 'processing', 0, NOW() - INTERVAL '6 minutes')
            RETURNING id, updated_at;
        """)
        row = cur.fetchone()
        nid = str(row[0])
        old_time = row[1]
        conn.commit()

        # Worker B reclaims it
        cur.execute("""
            UPDATE notifications
            SET push_status = 'processing', updated_at = NOW()
            WHERE id = %s
            RETURNING updated_at;
        """, (nid,))
        worker_b_time = cur.fetchone()[0]
        conn.commit()

        # Worker A attempts to refresh lease with old_time
        res = notification_service.refresh_notification_lease(self.get_conn, nid, expected_claim_timestamp=old_time)
        self.assertFalse(res.get("ok"))
        self.assertFalse(res.get("renewed"))

        # In PostgreSQL database, updated_at remains Worker B's time
        cur.execute("SELECT updated_at FROM notifications WHERE id = %s", (nid,))
        current_db_time = cur.fetchone()[0]
        self.assertEqual(current_db_time, worker_b_time, "Worker B's lease timestamp must be completely untouched")
        cur.close()
        conn.close()

    def test_postgres_lease_refresh_followed_by_valid_final_dispatch_update(self):
        """Native PostgreSQL 16.2: Legitimate lease refresh followed by dispatch update succeeds end-to-end."""
        if not getattr(self, 'available', False):
            self.skipTest("pgserver PostgreSQL instance unavailable on host")

        conn = self.get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM notifications;")
        cur.execute("DELETE FROM push_tokens;")

        user_id = "44444444-4444-4444-4444-444444444444"
        cur.execute("""
            INSERT INTO users (id, phone_number)
            VALUES (%s, '+919999988888')
            ON CONFLICT DO NOTHING;
        """, (user_id,))
        cur.execute("""
            INSERT INTO push_tokens (user_id, token, token_type, platform, is_active)
            VALUES (%s, 'ExponentPushToken[pg-real-device]', 'expo', 'android', TRUE)
            ON CONFLICT DO NOTHING;
        """, (user_id,))

        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key, push_status, push_attempts, updated_at)
            VALUES (%s, 'PG Sync', 'Body', 'test', 'pg-sync-1', 'processing', 0, NOW())
            RETURNING id, updated_at;
        """, (user_id,))
        row = cur.fetchone()
        nid = str(row[0])
        initial_time = row[1]
        conn.commit()

        # Set up in-flight tracking for worker
        with notification_service._in_flight_lock:
            notification_service._in_flight_notification_ids.add(nid)
            notification_service._in_flight_claimed_times[nid] = initial_time

        # Worker refreshes lease
        res_refresh = notification_service.refresh_notification_lease(self.get_conn, nid, expected_claim_timestamp=initial_time)
        self.assertTrue(res_refresh.get("ok"))
        self.assertTrue(res_refresh.get("renewed"))
        renewed_time = res_refresh.get("updated_at")

        # Worker finishes dispatch
        with patch('notification_service.is_mock_mode', return_value=False), \
             patch('notification_service._dispatch_expo_push', return_value={'status': 'delivered_to_provider'}):
            res_dispatch = notification_service.create_and_dispatch_notification(
                self.get_conn,
                user_id=user_id,
                title='PG Sync',
                body='Body',
                notification_type='test',
                idempotency_key='pg-sync-1',
                expected_claim_timestamp=initial_time
            )

            self.assertTrue(res_dispatch.get("ok"))
            self.assertTrue(res_dispatch.get("pushed"))
            self.assertFalse(res_dispatch.get("stale_update_suppressed"))

        # Verify in PostgreSQL database that push_status is 'sent'
        cur.execute("SELECT push_status, push_attempts FROM notifications WHERE id = %s", (nid,))
        db_row = cur.fetchone()
        self.assertEqual(db_row[0], 'sent')
        self.assertEqual(db_row[1], 1)
        cur.close()
        conn.close()


if __name__ == "__main__":
    unittest.main()

