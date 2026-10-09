import os
os.environ['JWT_SECRET_KEY'] = '1234567890123456789012345678901234'
os.environ['MESSAGE_ENCRYPTION_KEY'] = '7t-wW9G6T768T4d66vY9-W8b6Q1L8B9T3R5K0C2N6B8='

import unittest
from unittest.mock import patch, MagicMock
import subprocess
import sys
import jwt
import datetime
from datetime import timezone

import sprint
from app import app
from extensions import limiter

class TestPhase5Aadhaar(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.secret_key = app.config['SECRET_KEY']
        
        # Reset rate limiter before each test
        limiter.reset()
        
        self.valid_user_id = "11111111-1111-1111-1111-111111111111"
        now = datetime.datetime.now(timezone.utc)
        payload = {
            'user_id': self.valid_user_id,
            'iat': now,
            'jti': 'test-jti',
            'typ': 'access',
            'exp': now + datetime.timedelta(days=1)
        }
        self.valid_token = jwt.encode(payload, self.secret_key, algorithm='HS256')
        
        self.orig_mock_mode = sprint.AADHAAR_MOCK_MODE

        # Mock app.get_db_connection so @token_required works in all tests
        self.db_patcher = patch('app.get_db_connection')
        self.mock_db = self.db_patcher.start()
        self.mock_conn = MagicMock()
        self.mock_cur = MagicMock()
        self.mock_db.return_value = self.mock_conn
        self.mock_conn.cursor.return_value = self.mock_cur
        # (active=True, is_deleted=False, token_changed_at=None, blacklisted=False)
        self.mock_cur.fetchone.return_value = (True, False, None, False)

    def tearDown(self):
        self.db_patcher.stop()
        sprint.AADHAAR_MOCK_MODE = self.orig_mock_mode
        app.config['RATELIMIT_ENABLED'] = False
        limiter.reset()

    def test_mock_mode_disabled_rejects_requests(self):
        """When AADHAAR_MOCK_MODE is False, requests fail closed with 503."""
        sprint.AADHAAR_MOCK_MODE = False
        resp = self.app.post('/api/auth/send-aadhaar-otp', json={"aadhaar": "000000000000"})
        self.assertEqual(resp.status_code, 503)
        err = resp.get_json()['error'].lower()
        self.assertTrue("not available" in err or "disabled" in err)
        
        resp2 = self.app.post('/api/auth/verify-aadhaar', 
                              headers={'Authorization': f'Bearer {self.valid_token}'},
                              json={"aadhaar": "000000000000", "otp": "123456"})
        self.assertEqual(resp2.status_code, 503)
        err2 = resp2.get_json()['error'].lower()
        self.assertTrue("not available" in err2 or "disabled" in err2)

    def test_production_environment_blocks_requests_even_if_flag_is_true(self):
        """Even if AADHAAR_MOCK_MODE is True, detecting a production environment returns 503."""
        sprint.AADHAAR_MOCK_MODE = True
        with patch.object(sprint, 'is_production_environment', return_value=True):
            resp = self.app.post('/api/auth/send-aadhaar-otp', json={"aadhaar": "000000000000"})
            self.assertEqual(resp.status_code, 503)
            self.assertIn("Mock mode is disabled", resp.get_json()['error'])
            
            resp2 = self.app.post('/api/auth/verify-aadhaar', 
                                  headers={'Authorization': f'Bearer {self.valid_token}'},
                                  json={"aadhaar": "000000000000", "otp": "123456"})
            self.assertEqual(resp2.status_code, 503)
            self.assertIn("Mock mode is disabled", resp2.get_json()['error'])

    def test_production_indicators_detected(self):
        """Verify is_production_environment recognizes various deployment signals."""
        test_cases = [
            ({"FLASK_ENV": "production"}, True),
            ({"APP_ENV": "production"}, True),
            ({"ENVIRONMENT": "production"}, True),
            ({"ENV": "prod"}, True),
            ({"NODE_ENV": "production"}, True),
            ({"DEPLOYMENT_ENV": "live"}, True),
            ({"PRODUCTION": "true"}, True),
            ({"RENDER": "true"}, True),
            ({"DYNO": "web.1"}, True),
            ({"AWS_EXECUTION_ENV": "AWS_ECS_FARGATE"}, True),
            ({"FLY_APP_NAME": "samanvi-prod"}, True),
            ({"KUBERNETES_SERVICE_HOST": "10.0.0.1"}, True),
            ({"RAILWAY_ENVIRONMENT_NAME": "production"}, True),
            ({"HEROKU_APP_ID": "app-123"}, True),
            ({}, False),
            ({"FLASK_ENV": "development"}, False),
        ]
        for env_dict, expected in test_cases:
            with patch.dict(os.environ, env_dict, clear=True):
                self.assertEqual(sprint.is_production_environment(), expected, f"Failed for {env_dict}")

    def test_startup_fails_closed_in_production_when_mock_mode_enabled(self):
        """Subprocess startup fails with RuntimeError if AADHAAR_MOCK_MODE is enabled in production."""
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONPATH": backend_dir,
            "AADHAAR_MOCK_MODE": "true",
            "FLASK_ENV": "production",
            "JWT_SECRET_KEY": "1234567890123456789012345678901234",
            "MESSAGE_ENCRYPTION_KEY": "7t-wW9G6T768T4d66vY9-W8b6Q1L8B9T3R5K0C2N6B8=",
        }
        for k in ("SYSTEMROOT", "SystemRoot", "SYSTEMDRIVE", "WINDIR", "TEMP", "TMP"):
            if k in os.environ:
                env[k] = os.environ[k]
                
        cmd = [sys.executable, "-c", "import sprint"]
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, cwd=backend_dir)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("CRITICAL SECURITY CONFIGURATION ERROR", proc.stderr)
        self.assertIn("Synthetic Aadhaar identity verification is strictly forbidden", proc.stderr)

    def test_malformed_identifier_rejected_without_db_mutation(self):
        """Non-synthetic IDs are rejected with 400 and never query/mutate the database."""
        sprint.AADHAAR_MOCK_MODE = True
        
        # Test send OTP with non-zero ID
        resp = self.app.post('/api/auth/send-aadhaar-otp', json={"aadhaar": "123412341234"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("test identifier 000000000000", resp.get_json()['error'])
        self.assertNotIn("123412341234", resp.get_data(as_text=True))
        
        # Test verify with non-zero ID
        self.mock_cur.execute.reset_mock()
        resp2 = self.app.post('/api/auth/verify-aadhaar', 
                               headers={'Authorization': f'Bearer {self.valid_token}'},
                               json={"aadhaar": "999988887777", "otp": "123456"})
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("test identifier 000000000000", resp2.get_json()['error'])
        self.assertNotIn("999988887777", resp2.get_data(as_text=True))
        # execute may have been called once by @token_required to check user; assert users table update was never executed
        for call_item in self.mock_cur.execute.call_args_list:
            sql = call_item[0][0]
            self.assertNotIn("UPDATE users", sql)

    def test_missing_fields_rejected_without_db_mutation(self):
        """Missing or empty fields return 400 without mutating the database."""
        sprint.AADHAAR_MOCK_MODE = True
        
        # Missing aadhaar on send
        resp = self.app.post('/api/auth/send-aadhaar-otp', json={})
        self.assertEqual(resp.status_code, 400)
        
        # Missing otp on verify
        self.mock_cur.execute.reset_mock()
        resp2 = self.app.post('/api/auth/verify-aadhaar',
                               headers={'Authorization': f'Bearer {self.valid_token}'},
                               json={"aadhaar": "000000000000"})
        self.assertEqual(resp2.status_code, 400)
        for call_item in self.mock_cur.execute.call_args_list:
            sql = call_item[0][0]
            self.assertNotIn("UPDATE users", sql)

    def test_no_jwt_cannot_update(self):
        """Requests without JWT authentication return 401."""
        sprint.AADHAAR_MOCK_MODE = True
        resp = self.app.post('/api/auth/verify-aadhaar', json={"aadhaar": "000000000000", "otp": "123456"})
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Authentication required", resp.get_json()['error'])

    def test_wrong_otp_rejected_without_db_mutation(self):
        """Wrong OTP returns 400 and does NOT execute user verification update."""
        sprint.AADHAAR_MOCK_MODE = True
        self.mock_cur.execute.reset_mock()
        
        resp = self.app.post('/api/auth/verify-aadhaar', 
                             headers={'Authorization': f'Bearer {self.valid_token}'},
                             json={"aadhaar": "000000000000", "otp": "000000"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json()['error'], "Invalid OTP")
        for call_item in self.mock_cur.execute.call_args_list:
            sql = call_item[0][0]
            self.assertNotIn("UPDATE users", sql)

    def test_successful_verification_mock(self):
        """Single valid verification updates aadhaar_last4='MOCK' and ignores trust_score."""
        sprint.AADHAAR_MOCK_MODE = True
        self.mock_cur.execute.reset_mock()
        self.mock_conn.commit.reset_mock()
        
        resp = self.app.post('/api/auth/verify-aadhaar', 
                             headers={'Authorization': f'Bearer {self.valid_token}'},
                             json={"aadhaar": "000000000000", "otp": "123456"})
                             
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['last4'], "0000")
        self.assertTrue(resp.get_json()['aadhaar_verified'])
        
        # Verify executed UPDATE users statement
        update_calls = [c for c in self.mock_cur.execute.call_args_list if "UPDATE users" in c[0][0]]
        self.assertEqual(len(update_calls), 1)
        executed_query = update_calls[0][0][0]
        executed_args = update_calls[0][0][1]
        
        self.assertNotIn("trust_score", executed_query)
        self.assertEqual(executed_args[1], "MOCK")
        self.assertEqual(executed_args[2], self.valid_user_id)
        self.mock_conn.commit.assert_called_once()

    def test_repeated_verification_idempotent(self):
        """Repeated verification calls succeed idempotently without corrupting state or trust score."""
        sprint.AADHAAR_MOCK_MODE = True
        
        for _ in range(3):
            resp = self.app.post('/api/auth/verify-aadhaar', 
                                 headers={'Authorization': f'Bearer {self.valid_token}'},
                                 json={"aadhaar": "000000000000", "otp": "123456"})
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.get_json()['last4'], "0000")
            
        update_calls = [c for c in self.mock_cur.execute.call_args_list if "UPDATE users" in c[0][0]]
        self.assertEqual(len(update_calls), 3)
        for c in update_calls:
            self.assertNotIn("trust_score", c[0][0])

    def test_database_error_handled_and_rolled_back(self):
        """Unexpected database exception triggers rollback, returns 500, and hides internal details."""
        sprint.AADHAAR_MOCK_MODE = True
        # First call is token verification (fetchone), second is the UPDATE users query which fails
        self.mock_cur.execute.side_effect = [None, Exception("Secret internal database connection failed: table corrupt")]
        
        resp = self.app.post('/api/auth/verify-aadhaar', 
                             headers={'Authorization': f'Bearer {self.valid_token}'},
                             json={"aadhaar": "000000000000", "otp": "123456"})
                             
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(resp.get_json()['error'], "Internal server error")
        self.assertNotIn("table corrupt", resp.get_data(as_text=True))
        self.mock_conn.rollback.assert_called_once()

    def test_rate_limiting_enforced(self):
        """Rate limiting (5 per minute) is enforced and returns 429 when exceeded."""
        sprint.AADHAAR_MOCK_MODE = True
        app.config['RATELIMIT_ENABLED'] = True
        limiter.reset()
        
        # Send 5 requests within limit
        for _ in range(5):
            resp = self.app.post('/api/auth/send-aadhaar-otp', 
                                 headers={'X-Forwarded-For': '192.0.2.99'},
                                 json={"aadhaar": "000000000000"})
            self.assertEqual(resp.status_code, 200)
            
        # 6th request should be rate-limited
        resp6 = self.app.post('/api/auth/send-aadhaar-otp', 
                              headers={'X-Forwarded-For': '192.0.2.99'},
                              json={"aadhaar": "000000000000"})
        self.assertEqual(resp6.status_code, 429)

if __name__ == '__main__':
    unittest.main()
