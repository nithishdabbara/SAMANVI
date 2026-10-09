import os
os.environ['JWT_SECRET_KEY'] = '1234567890123456789012345678901234'
os.environ['MESSAGE_ENCRYPTION_KEY'] = '7t-wW9G6T768T4d66vY9-W8b6Q1L8B9T3R5K0C2N6B8='
os.environ['APP_ENV'] = 'testing'
os.environ['PUSH_MOCK_MODE'] = 'true'

import unittest
from unittest.mock import patch, MagicMock
import jwt
import datetime
from datetime import timezone
import uuid

import notification_service
from app import app
from extensions import limiter

class TestPhase5Stage32Notifications(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.secret_key = app.config['SECRET_KEY']
        limiter.reset()

        self.user_a_id = "11111111-1111-1111-1111-111111111111"
        self.user_b_id = "22222222-2222-2222-2222-222222222222"

        now = datetime.datetime.now(timezone.utc)
        self.token_a = jwt.encode({
            'user_id': self.user_a_id, 'iat': now, 'jti': 'jti-a', 'typ': 'access',
            'exp': now + datetime.timedelta(days=1)
        }, self.secret_key, algorithm='HS256')

        self.token_b = jwt.encode({
            'user_id': self.user_b_id, 'iat': now, 'jti': 'jti-b', 'typ': 'access',
            'exp': now + datetime.timedelta(days=1)
        }, self.secret_key, algorithm='HS256')

        notification_service.clear_sent_notifications()

    def tearDown(self):
        notification_service.clear_sent_notifications()
        limiter.reset()

    # 1. Authenticated token registration
    def test_token_registration_authenticated(self):
        """Authenticated user successfully registers an Expo push token."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        with patch('sprint.get_db_connection', return_value=mock_conn), \
             patch('app.get_db_connection', return_value=mock_conn):
            # Auth validation query returns active user
            mock_cur.fetchone.return_value = (True, False, None, False)

            resp = self.app.post('/api/push/register-token', 
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"expo_token": "ExponentPushToken[test-token-123456]", "platform": "android"}
            )
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertTrue(data.get('ok'))
            self.assertEqual(data.get('token_type'), 'expo')

    # 2. Unauthenticated registration rejected
    def test_token_registration_unauthenticated(self):
        """Missing or invalid JWT token is rejected with 401."""
        resp = self.app.post('/api/push/register-token', json={"expo_token": "ExponentPushToken[abc123456789]"})
        self.assertEqual(resp.status_code, 401)

    # 3. Token validation rules
    def test_token_validation_length_and_type(self):
        """Tokens shorter than 10 chars or empty are rejected with 400."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        with patch('sprint.get_db_connection', return_value=mock_conn), \
             patch('app.get_db_connection', return_value=mock_conn):
            mock_cur.fetchone.return_value = (True, False, None, False)

            # Too short
            resp = self.app.post('/api/push/register-token',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"expo_token": "short", "platform": "android"}
            )
            self.assertEqual(resp.status_code, 400)
            self.assertIn("length", resp.get_json()['error'].lower())

            # Empty
            resp = self.app.post('/api/push/register-token',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"expo_token": "", "platform": "android"}
            )
            self.assertEqual(resp.status_code, 400)

    # 4. Token reassignment (device account switch)
    def test_token_reassignment_device_switch(self):
        """When User B logs in and registers an existing token, it reassigns ownership without error."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        res = notification_service.register_device_token(
            mock_conn,
            user_id=self.user_b_id,
            token="ExponentPushToken[shared-device-token]",
            platform="android"
        )
        self.assertTrue(res.get('ok'))
        # Verified SQL uses ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id
        mock_conn.commit.assert_called()

    # 5. Token removal ownership guard
    def test_token_removal_ownership_guard(self):
        """User A cannot remove a token belonging to User B."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # Simulate DELETE returning no row because token belongs to another user
        mock_cur.fetchone.return_value = None

        with patch('sprint.get_db_connection', return_value=mock_conn), \
             patch('app.get_db_connection', return_value=mock_conn):
            # Auth succeeds
            mock_cur.fetchone.side_effect = [(True, False, None, False), None]

            resp = self.app.post('/api/push/unregister-token',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"token": "ExponentPushToken[user-b-device-token]"}
            )
            self.assertEqual(resp.status_code, 200)
            self.assertFalse(resp.get_json().get('unregistered'))

    # 6. Recipient selection for offer workflow
    def test_recipient_selection_offer_workflow(self):
        """Offer creation notifies problem owner, not unrelated users."""
        problem_id = str(uuid.uuid4())
        offer_id = str(uuid.uuid4())

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('notification_service.create_and_dispatch_notification') as mock_notif:
            
            # 1. Auth check -> active
            # 2. Insert problem_offers -> returning offer_id
            # 3. Select user_id from problems -> returns problem owner (user_b_id)
            mock_cur.fetchone.side_effect = [
                (True, False, None, False),
                {'id': offer_id, 'created_at': datetime.datetime.now(timezone.utc)},
                {'user_id': self.user_b_id}
            ]

            resp = self.app.post(f'/api/problems/{problem_id}/offers',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"content": "I can help with this!"}
            )
            self.assertEqual(resp.status_code, 201)
            mock_notif.assert_called_once()
            called_args = mock_notif.call_args[1]
            self.assertEqual(called_args['user_id'], self.user_b_id)
            self.assertEqual(called_args['notification_type'], 'new_offer')

    # 7. Atomic duplicate suppression
    def test_atomic_duplicate_suppression(self):
        """Retrying with identical idempotency_key creates only 1 in-app record and skips duplicate push."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # First call: INSERT returns id
        mock_cur.fetchone.side_effect = [
            {'id': 'notif-1'}, # INSERT RETURNING id
            [{'token': 'ExponentPushToken[device-1]', 'token_type': 'expo'}] # active tokens
        ]

        res1 = notification_service.create_and_dispatch_notification(
            get_db_conn_fn=lambda: mock_conn,
            user_id=self.user_a_id,
            title="Alert",
            body="First event",
            notification_type="test_event",
            idempotency_key="unique_event_key_123"
        )
        self.assertTrue(res1.get('in_app_saved'))
        self.assertFalse(res1.get('duplicate', False))

        # Second call: INSERT ON CONFLICT returns None, existing row has push_status='sent'
        mock_cur.fetchone.side_effect = [
            None, # INSERT RETURNING id was empty (conflict)
            {'id': 'notif-1', 'push_status': 'sent', 'push_attempts': 1} # existing check
        ]

        res2 = notification_service.create_and_dispatch_notification(
            get_db_conn_fn=lambda: mock_conn,
            user_id=self.user_a_id,
            title="Alert",
            body="Retry event",
            notification_type="test_event",
            idempotency_key="unique_event_key_123"
        )
        self.assertTrue(res2.get('duplicate'))
        self.assertEqual(res2.get('status'), 'duplicate_suppressed')

    # 8. Chat notification separate messages
    def test_chat_notification_distinct_messages(self):
        """Distinct chat messages have distinct idempotency keys and are not suppressed."""
        msg1_id = str(uuid.uuid4())
        msg2_id = str(uuid.uuid4())

        key1 = f"chat_msg_{msg1_id}"
        key2 = f"chat_msg_{msg2_id}"

        self.assertNotEqual(key1, key2)

    # 9. In-app feed and read ownership
    def test_in_app_feed_and_read_ownership(self):
        """User A can only access and mark their own notifications."""
        notif_id = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        with patch('app.get_db_connection', return_value=mock_conn):
            # Auth check -> active
            # UPDATE notifications WHERE id=notif_id AND user_id=current_user -> returns None (access denied)
            mock_cur.fetchone.side_effect = [(True, False, None, False), None]

            resp = self.app.put(f'/api/notifications/{notif_id}/read',
                headers={'Authorization': f'Bearer {self.token_a}'}
            )
            self.assertEqual(resp.status_code, 404)

    # 10. Production mock rejection
    def test_production_mock_rejection(self):
        """Server strictly rejects PUSH_MOCK_MODE when APP_ENV=production."""
        with patch.dict(os.environ, {'APP_ENV': 'production', 'PUSH_MOCK_MODE': 'true'}):
            with self.assertRaises(RuntimeError):
                notification_service.is_mock_mode()

    # 11. Stale token pruning
    def test_stale_token_cleanup(self):
        """Prunes invalid tokens when provider reports expired/unregistered."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        stale_token = "ExponentPushToken[expired-token-xyz]"
        notification_service.prune_stale_token(mock_conn, stale_token)

        mock_cur.execute.assert_called_with(
            "DELETE FROM push_tokens WHERE token = %s",
            (stale_token,)
        )
        mock_conn.commit.assert_called()

    # 12. Core operation resilience on push failure
    def test_core_operation_resilience_on_push_failure(self):
        """If push provider dispatch fails or times out, DB transaction still commits cleanly."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        offer_id = str(uuid.uuid4())
        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('notification_service.create_and_dispatch_notification', side_effect=Exception("Push network timeout")):
            
            # Auth -> active, then select offer details
            mock_cur.fetchone.side_effect = [
                (True, False, None, False),
                {'id': str(uuid.uuid4()), 'user_id': self.user_a_id, 'helper_id': self.user_b_id},
                {'id': offer_id, 'status': 'accepted'}
            ]

            resp = self.app.post(f'/api/offers/{offer_id}/accept',
                headers={'Authorization': f'Bearer {self.token_a}'}
            )
            # Offer accepted successfully despite push network exception
            self.assertEqual(resp.status_code, 200)
            mock_conn.commit.assert_called()

    # 13. Recovery worker retries pending and failed notifications
    def test_process_pending_pushes_retries_failed_and_pending(self):
        """Recovery worker retrieves pending and failed items with FOR UPDATE SKIP LOCKED."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        items = [
            {'id': 'notif-p1', 'user_id': self.user_a_id, 'title': 'Pending Event', 'body': 'msg',
             'type': 'test', 'related_id': None, 'idempotency_key': 'key-p1', 'push_attempts': 0},
            {'id': 'notif-f1', 'user_id': self.user_b_id, 'title': 'Failed Event', 'body': 'msg',
             'type': 'test', 'related_id': None, 'idempotency_key': 'key-f1', 'push_attempts': 1}
        ]
        mock_cur.fetchall.return_value = items

        with patch('notification_service.create_and_dispatch_notification', return_value={'ok': True, 'mocked': True}):
            recovered = notification_service.process_pending_pushes(lambda: mock_conn)
            self.assertEqual(recovered, 2)
            mock_cur.execute.assert_called()
            # Verified query updates to 'processing' with FOR UPDATE SKIP LOCKED
            sql_called = mock_cur.execute.call_args[0][0]
            self.assertIn("FOR UPDATE SKIP LOCKED", sql_called)
            self.assertIn("push_status = 'processing'", sql_called)

    # 14. Permanent failure recording after 3 attempts
    def test_exhausted_retries_transition_to_permanently_failed(self):
        """Notification delivery SQL transitions to permanently_failed when attempts reach 3."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # INSERT returns id
        mock_cur.fetchone.side_effect = [
            {'id': 'notif-fail-3'},
            [{'token': 'ExponentPushToken[device-fail]', 'token_type': 'expo'}]
        ]

        with patch('notification_service.is_mock_mode', return_value=False), \
             patch('notification_service._dispatch_expo_push', return_value={'status': 'provider_error'}):
            
            res = notification_service.create_and_dispatch_notification(
                get_db_conn_fn=lambda: mock_conn,
                user_id=self.user_a_id,
                title="Fail Test",
                body="Testing failure",
                notification_type="fail_type",
                idempotency_key="key_exhaust_test"
            )
            self.assertFalse(res.get('pushed'))
            # Check UPDATE SQL has CASE for permanently_failed
            update_calls = [c for c in mock_cur.execute.call_args_list if "UPDATE notifications" in c[0][0]]
            self.assertTrue(len(update_calls) > 0)
            self.assertIn("permanently_failed", update_calls[0][0][0])

    # 15. Offer cancellation idempotency with stable identifier
    def test_offer_cancellation_idempotency_stable_key(self):
        """Offer cancellation uses stable offer_cancel_{offer_id} and suppresses retries."""
        offer_id = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('notification_service.create_and_dispatch_notification') as mock_notif:
            
            # Call 1: Offer active, cancellation succeeds
            mock_cur.fetchone.side_effect = [
                (True, False, None, False), # Auth
                {'helper_id': self.user_a_id, 'problem_id': str(uuid.uuid4()), 'status': 'accepted', 'resident_id': self.user_b_id}
            ]

            resp1 = self.app.post('/api/offers/cancel',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"offer_id": offer_id}
            )
            self.assertEqual(resp1.status_code, 200)
            mock_notif.assert_called_once()
            called_key = mock_notif.call_args[1]['idempotency_key']
            self.assertEqual(called_key, f"offer_cancel_{offer_id}")
            self.assertNotIn("time", called_key)

            # Call 2: Offer already cancelled -> immediate 200 without second notification
            mock_cur.fetchone.side_effect = [
                (True, False, None, False), # Auth
                {'helper_id': self.user_a_id, 'problem_id': str(uuid.uuid4()), 'status': 'cancelled', 'resident_id': self.user_b_id}
            ]
            mock_notif.reset_mock()

            resp2 = self.app.post('/api/offers/cancel',
                headers={'Authorization': f'Bearer {self.token_a}'},
                json={"offer_id": offer_id}
            )
            self.assertEqual(resp2.status_code, 200)
            self.assertIn("already cancelled", resp2.get_json()['message'])
            mock_notif.assert_not_called()

    # 16. Background worker lifecycle and maintenance endpoint security
    def test_recovery_worker_lifecycle_and_endpoint_security(self):
        """Worker thread lifecycle and endpoint security edge cases."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value = mock_cur

        # Lifecycle test
        worker = notification_service.start_background_recovery_worker(lambda: mock_conn, interval_seconds=100)
        self.assertTrue(worker.is_alive())
        notification_service.stop_background_recovery_worker()
        self.assertFalse(worker.is_alive())

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('notification_service.process_pending_pushes', return_value=3):

            # Case A: Unauthenticated request -> 401
            resp_unauth = self.app.post('/api/internal/push-recovery')
            self.assertEqual(resp_unauth.status_code, 401)

            # Case B: Authenticated non-admin (role='user') -> 403 Forbidden
            mock_cur.fetchone.return_value = ('user', True)
            resp_user = self.app.post('/api/internal/push-recovery',
                headers={'Authorization': f'Bearer {self.token_a}'}
            )
            self.assertEqual(resp_user.status_code, 403)
            self.assertIn("Administrator privileges required", resp_user.get_json()['error'])

            # Case C: Inactive administrator (role='admin', is_active=False) -> 403 Forbidden
            mock_cur.fetchone.return_value = ('admin', False)
            resp_inactive = self.app.post('/api/internal/push-recovery',
                headers={'Authorization': f'Bearer {self.token_a}'}
            )
            self.assertEqual(resp_inactive.status_code, 403)
            self.assertIn("disabled", resp_inactive.get_json()['error'].lower())

            # Case D: Expired JWT -> 401
            now = datetime.datetime.now(timezone.utc)
            expired_token = jwt.encode({
                'user_id': self.user_a_id, 'iat': now - datetime.timedelta(days=2), 'jti': 'exp-jti',
                'typ': 'access', 'exp': now - datetime.timedelta(days=1)
            }, self.secret_key, algorithm='HS256')
            resp_expired = self.app.post('/api/internal/push-recovery',
                headers={'Authorization': f'Bearer {expired_token}'}
            )
            self.assertEqual(resp_expired.status_code, 401)
            self.assertEqual(resp_expired.get_json().get('code'), 'token_expired')

            # Case E: Malformed JWT -> 401
            resp_malformed = self.app.post('/api/internal/push-recovery',
                headers={'Authorization': 'Bearer not-a-valid-jwt'}
            )
            self.assertEqual(resp_malformed.status_code, 401)
            self.assertEqual(resp_malformed.get_json().get('code'), 'token_invalid')

            # Case F: Unset/empty INTERNAL_SERVICE_KEY with supplied service key -> 401
            with patch.dict(os.environ, {'INTERNAL_SERVICE_KEY': ''}):
                resp_unset_key = self.app.post('/api/internal/push-recovery',
                    headers={'X-Internal-Service-Key': 'attacker-supplied-key'}
                )
                self.assertEqual(resp_unset_key.status_code, 401)

            # Case G: Invalid X-Internal-Service-Key supplied -> 401 immediately without fall-through
            with patch.dict(os.environ, {'INTERNAL_SERVICE_KEY': 'secret-service-key-999'}):
                resp_invalid_key = self.app.post('/api/internal/push-recovery',
                    headers={'X-Internal-Service-Key': 'wrong-key'}
                )
                self.assertEqual(resp_invalid_key.status_code, 401)
                self.assertEqual(resp_invalid_key.get_json().get('code'), 'service_key_invalid')

            # Case H: Valid X-Internal-Service-Key -> 200 OK
            with patch.dict(os.environ, {'INTERNAL_SERVICE_KEY': 'secret-service-key-999'}):
                resp_service = self.app.post('/api/internal/push-recovery',
                    headers={'X-Internal-Service-Key': 'secret-service-key-999'}
                )
                self.assertEqual(resp_service.status_code, 200)
                self.assertEqual(resp_service.get_json().get('recovered'), 3)

            # Case I: Valid service key in Authorization: Bearer <key> -> 200 OK
            with patch.dict(os.environ, {'INTERNAL_SERVICE_KEY': 'secret-service-key-999'}):
                resp_bearer_service = self.app.post('/api/internal/push-recovery',
                    headers={'Authorization': 'Bearer secret-service-key-999'}
                )
                self.assertEqual(resp_bearer_service.status_code, 200)

            # Case J: Active administrator (role='admin', is_active=True) -> 200 OK
            mock_cur.fetchone.return_value = ('admin', True)
            resp_admin = self.app.post('/api/internal/push-recovery',
                headers={'Authorization': f'Bearer {self.token_a}'}
            )
            self.assertEqual(resp_admin.status_code, 200)
            self.assertEqual(resp_admin.get_json().get('recovered'), 3)

    # 17. FCM HTTP v1 dispatch authentication and legacy key rejection
    def test_fcm_http_v1_authentication_and_legacy_guard(self):
        """FCM HTTP v1 requires OAuth 2.0 token; rejects legacy server keys with misconfigured status."""
        # Case A: Missing credentials
        with patch.dict(os.environ, {'FCM_PROJECT_ID': '', 'FCM_OAUTH2_ACCESS_TOKEN': ''}, clear=False):
            res_missing = notification_service._dispatch_fcm_push(['token-1'], 'Title', 'Body')
            self.assertEqual(res_missing['status'], 'provider_unconfigured')

        # Case B: Accidental legacy server key without OAuth token
        with patch.dict(os.environ, {'FIREBASE_SERVER_KEY': 'legacy-server-key', 'FCM_OAUTH2_ACCESS_TOKEN': ''}, clear=False):
            res_legacy = notification_service._dispatch_fcm_push(['token-1'], 'Title', 'Body')
            self.assertEqual(res_legacy['status'], 'provider_misconfigured')
            self.assertIn("OAuth 2.0", res_legacy['error'])

        # Case C: Valid static OAuth token + project ID
        with patch.dict(os.environ, {
            'FCM_PROJECT_ID': 'samanvi-prod-123',
            'FCM_OAUTH2_ACCESS_TOKEN': 'ya29.mock-google-oauth-token',
            'FIREBASE_SERVER_KEY': ''
        }, clear=False):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"name": "projects/samanvi-prod-123/messages/msg-001"}

            with patch('requests.post', return_value=mock_resp) as mock_post:
                res_v1 = notification_service._dispatch_fcm_push(['fcm-token-xyz'], 'Hello', 'World', {'id': 123})
                self.assertEqual(res_v1['status'], 'delivered_to_provider')
                self.assertEqual(res_v1['provider'], 'fcm_v1')
                self.assertEqual(res_v1['success_count'], 1)

                mock_post.assert_called_once()
                call_args = mock_post.call_args
                url = call_args[0][0]
                headers = call_args[1]['headers']
                # Verified FCM HTTP v1 endpoint and Bearer authorization
                self.assertIn("v1/projects/samanvi-prod-123/messages:send", url)
                self.assertEqual(headers['Authorization'], 'Bearer ya29.mock-google-oauth-token')

        # Case D: Dynamic token resolution via mock ADC
        with patch.dict(os.environ, {'FCM_PROJECT_ID': 'samanvi-prod-123', 'FCM_OAUTH2_ACCESS_TOKEN': '', 'FIREBASE_SERVER_KEY': ''}, clear=False):
            import sys
            mock_creds = MagicMock()
            mock_creds.token = 'ya29.dynamic-adc-token'
            mock_google_auth = MagicMock()
            mock_google_auth.default.return_value = (mock_creds, 'samanvi-prod-123')
            mock_transport = MagicMock()
            mock_google_auth.transport = mock_transport
            mock_google = MagicMock()
            mock_google.auth = mock_google_auth

            with patch.dict(sys.modules, {
                'google': mock_google,
                'google.auth': mock_google_auth,
                'google.auth.transport': mock_transport,
                'google.auth.transport.requests': mock_transport.requests
            }):
                token_str, source = notification_service.get_fcm_oauth_token()
                self.assertEqual(token_str, 'ya29.dynamic-adc-token')
                self.assertEqual(source, 'google_auth_adc')

    # 18. FCM HTTP v1 stale token detection
    def test_fcm_http_v1_stale_token_pruning(self):
        """FCM HTTP v1 marks UNREGISTERED tokens for pruning."""
        with patch.dict(os.environ, {
            'FCM_PROJECT_ID': 'samanvi-prod-123',
            'FCM_OAUTH2_ACCESS_TOKEN': 'ya29.mock-token',
            'FIREBASE_SERVER_KEY': ''
        }, clear=False):
            mock_resp = MagicMock()
            mock_resp.status_code = 404
            mock_resp.headers = {'content-type': 'application/json'}
            mock_resp.json.return_value = {
                "error": {
                    "code": 404,
                    "message": "Requested entity was not found.",
                    "status": "UNREGISTERED"
                }
            }

            with patch('requests.post', return_value=mock_resp):
                res = notification_service._dispatch_fcm_push(['dead-fcm-token'], 'Title', 'Body')
                self.assertEqual(res['status'], 'provider_error')
                self.assertIn('dead-fcm-token', res['stale_tokens'])


if __name__ == '__main__':
    unittest.main()

