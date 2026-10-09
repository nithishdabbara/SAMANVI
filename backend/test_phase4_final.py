import os
os.environ['JWT_SECRET_KEY'] = '1234567890123456789012345678901234'
os.environ['MESSAGE_ENCRYPTION_KEY'] = '7t-wW9G6T768T4d66vY9-W8b6Q1L8B9T3R5K0C2N6B8='
import unittest
from unittest.mock import patch, MagicMock
from app import app, cipher
import jwt
import datetime
import json
import base64
from cryptography.fernet import Fernet

class TestPhase4Final(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.secret_key = app.config['SECRET_KEY']
        
        # Valid Token
        self.valid_user_id = "11111111-1111-1111-1111-111111111111"
        payload = {
            'user_id': self.valid_user_id, 'iat': datetime.datetime.utcnow(), 'jti': 'test-jti', 'typ': 'access',
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }
        self.valid_token = jwt.encode(payload, self.secret_key, algorithm='HS256')
        
        # Unauthorized User Token
        self.other_user_id = "22222222-2222-2222-2222-222222222222"
        payload_other = {
            'user_id': self.other_user_id, 'iat': datetime.datetime.utcnow(), 'jti': 'test-jti', 'typ': 'access',
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }
        self.other_token = jwt.encode(payload_other, self.secret_key, algorithm='HS256')
        
        # Invalid Token
        self.invalid_token = "invalid.token.here"

    # --- 1. /api/stats Tests ---

    def test_stats_no_auth(self):
        resp = self.app.get('/api/stats')
        self.assertEqual(resp.status_code, 401)

    def test_stats_invalid_auth(self):
        resp = self.app.get('/api/stats', headers={'Authorization': f'Bearer {self.invalid_token}'})
        self.assertEqual(resp.status_code, 401)

    @patch('app.get_db_connection')
    def test_stats_valid_auth(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Mock database returns:
        # 1. locality_id
        # 2. user_count
        # 3. solved_count
        # 4. open_count
        # 5. category_counts
        mock_cur.fetchone.side_effect = [
            (True, False, None, False), # token_required user check
            ("loc-123",),  # user's locality
            (50,),         # users
            (10,),         # solved
            (5,),          # open
        ]
        mock_cur.fetchall.side_effect = [
            [("Plumbing", 2), ("Electrical", 3)]
        ]

        resp = self.app.get('/api/stats', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 200, resp.data)
        data = json.loads(resp.data)
        
        # Verify response structure and data
        self.assertEqual(data['community_members'], 50)
        self.assertEqual(data['issues_solved'], 10)
        self.assertEqual(data['open_issues'], 5)
        self.assertEqual(data['category_counts']['Plumbing'], 2)
        
        # Verify locality was queried properly
        calls = mock_cur.execute.call_args_list
        self.assertIn("SELECT locality_id FROM users WHERE id = %s", calls[1][0][0])
        self.assertEqual(calls[1][0][1], (self.valid_user_id,))
        
        # Verify all subsequent queries use the fetched locality (loc-123)
        for call in calls[2:]:
            self.assertIn("locality_id = %s", call[0][0])
            self.assertEqual(call[0][1], ("loc-123",))

    @patch('app.get_db_connection')
    def test_stats_empty_locality(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Return None for the first fetchone (locality_id)
        mock_cur.fetchone.side_effect = [(True, False, None, False), None]
        mock_cur.fetchall.return_value = []

        resp = self.app.get('/api/stats', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 200, resp.data)
        data = json.loads(resp.data)
        self.assertEqual(data['community_members'], 0)
        self.assertEqual(data['open_issues'], 0)
        self.assertEqual(data['category_counts'], {})
        
        # Ensure only the locality query was executed, no aggregations
        calls = mock_cur.execute.call_args_list
        self.assertEqual(len(calls), 2)
        self.assertIn("SELECT locality_id FROM users", calls[1][0][0])
        mock_cur.close.assert_called()
        mock_conn.close.assert_called()

    # --- 2. Message Decryption Tests ---

    from app import decrypt_message
    
    def test_decrypt_valid_ciphertext(self):
        plaintext = "Hello, world!"
        ciphertext = cipher.encrypt(plaintext.encode()).decode()
        
        # Decrypt logic in app.py
        from app import decrypt_message
        result = decrypt_message(ciphertext)
        self.assertEqual(result, plaintext)

    def test_decrypt_legacy_plaintext(self):
        legacy = "This is an old unencrypted message"
        from app import decrypt_message
        result = decrypt_message(legacy)
        self.assertEqual(result, legacy)

    def test_decrypt_invalid_ciphertext(self):
        # Starts with gAAAAA but is corrupted
        corrupted = "gAAAAABinvalidtokenhere"
        from app import decrypt_message
        result = decrypt_message(corrupted)
        self.assertEqual(result, "[Message unavailable]")

    def test_decrypt_invalid_key(self):
        plaintext = "Secret message"
        wrong_cipher = Fernet(Fernet.generate_key())
        ciphertext = wrong_cipher.encrypt(plaintext.encode()).decode()
        
        from app import decrypt_message
        result = decrypt_message(ciphertext)
        self.assertEqual(result, "[Message unavailable]")

    # --- 3. Message Authorization Tests (Mocks) ---

    @patch('app.get_db_connection')
    def test_get_chat_history_authorized(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Block check -> False (None)
        mock_cur.fetchone.side_effect = [(True, False, None, False), None, {"name": "Partner", "nickname": "Partner", "avatar_url": None}]
        
        ciphertext = cipher.encrypt(b"Secure!").decode()
        mock_cur.fetchall.return_value = [
            {"id": "msg1", "sender_id": self.other_user_id, "receiver_id": self.valid_user_id, "text": ciphertext, "created_at": None, "isMe": False}
        ]

        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 200, resp.data)
        data = json.loads(resp.data)
        
        # Check that it decrypted
        self.assertEqual(data['messages'][0]['text'], "Secure!")
        
        # Check authorization constraints in query
        calls = mock_cur.execute.call_args_list
        # The query fetching history is at index 2 (0: blocks, 1: read update, 2: history)
        history_query = calls[3][0][0]
        self.assertIn("sender_id = %s AND receiver_id::text = %s", history_query)
        self.assertEqual(calls[3][0][1], (self.valid_user_id, self.valid_user_id, self.other_user_id, self.other_user_id, self.valid_user_id))

    @patch('app.get_db_connection')
    def test_get_chat_history_unauthorized(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Simulating that the database query for messages between the requesting user and the recipient yields nothing,
        # because the conversation belongs to two other people entirely. The endpoint inherently 
        # bounds the query to the authenticated JWT ID via the WHERE clause.
        mock_cur.fetchone.side_effect = [(True, False, None, False), None, {"name": "Recipient", "nickname": "Recipient", "avatar_url": None}]
        mock_cur.fetchall.return_value = []
        
        # third_party_user trying to access conversation of valid_user_id
        third_party_token = jwt.encode({'user_id': "33333333-3333-3333-3333-333333333333", 'iat': datetime.datetime.utcnow(), 'jti': 'test-jti2', 'typ': 'access', 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)}, self.secret_key, algorithm='HS256')
        
        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {third_party_token}'})
        self.assertEqual(resp.status_code, 200, resp.data)
        data = json.loads(resp.data)
        
        # Should be empty because the SQL WHERE clause forces one of the IDs to be "33333333..."
        self.assertEqual(len(data['messages']), 0)
        
        calls = mock_cur.execute.call_args_list
        history_query = calls[3][0][0]
        # Verify the bound parameter for the current_user is the third party ID, isolating the query
        self.assertEqual(calls[3][0][1], ("33333333-3333-3333-3333-333333333333", "33333333-3333-3333-3333-333333333333", self.other_user_id, self.other_user_id, "33333333-3333-3333-3333-333333333333"))

    @patch('app.get_db_connection')
    def test_get_chat_history_blocked_by_me(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        db_blocks = [{"blocker": self.valid_user_id, "blocked": self.other_user_id}]
        self.direction_matched = None
        
        def execute_side_effect(query, params=None):
            if "SELECT 1 FROM user_blocks" in query:
                b1, bld1, b2, bld2 = params
                match1 = any((b['blocker'] == b1 and b['blocked'] == bld1) for b in db_blocks)
                match2 = any((b['blocker'] == b2 and b['blocked'] == bld2) for b in db_blocks)
                if match1: self.direction_matched = "blocker_is_current_user"
                elif match2: self.direction_matched = "blocker_is_recipient"
                mock_cur.fetchone.return_value = {"1": 1} if (match1 or match2) else None
            else:
                mock_cur.fetchone.return_value = (True, False, None, False)
                
        mock_cur.execute.side_effect = execute_side_effect
        
        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 403)
        self.assertIn(b"Conversation unavailable due to block settings", resp.data)
        
        calls = mock_cur.execute.call_args_list
        self.assertEqual(len(calls), 2)
        self.assertIn("SELECT 1 FROM user_blocks", calls[1][0][0])
        self.assertFalse(any("UPDATE messages SET is_read = TRUE" in str(call) for call in calls))
        self.assertEqual(self.direction_matched, "blocker_is_current_user")
        
        mock_cur.close.assert_called()
        mock_conn.close.assert_called()

    @patch('app.get_db_connection')
    def test_get_chat_history_blocked_by_recipient(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        db_blocks = [{"blocker": self.other_user_id, "blocked": self.valid_user_id}]
        self.direction_matched = None
        
        def execute_side_effect(query, params=None):
            if "SELECT 1 FROM user_blocks" in query:
                b1, bld1, b2, bld2 = params
                match1 = any((b['blocker'] == b1 and b['blocked'] == bld1) for b in db_blocks)
                match2 = any((b['blocker'] == b2 and b['blocked'] == bld2) for b in db_blocks)
                if match1: self.direction_matched = "blocker_is_current_user"
                elif match2: self.direction_matched = "blocker_is_recipient"
                mock_cur.fetchone.return_value = {"1": 1} if (match1 or match2) else None
            else:
                mock_cur.fetchone.return_value = (True, False, None, False)
                
        mock_cur.execute.side_effect = execute_side_effect
        
        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 403)
        self.assertIn(b"Conversation unavailable due to block settings", resp.data)

        calls = mock_cur.execute.call_args_list
        self.assertEqual(len(calls), 2)
        self.assertIn("SELECT 1 FROM user_blocks", calls[1][0][0])
        self.assertFalse(any("UPDATE messages SET is_read = TRUE" in str(call) for call in calls))
        self.assertEqual(self.direction_matched, "blocker_is_recipient")
        
        mock_cur.close.assert_called()
        mock_conn.close.assert_called()
    # --- 4. Database Cleanup Path Tests ---

    @patch('app.get_db_connection')
    def test_chat_db_exception_cleanup(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Token check executes first (SELECT * FROM users). We must let it succeed.
        # Then the block check (SELECT 1 FROM user_blocks) happens inside the handler.
        def execute_side_effect(query, params=None):
            if "SELECT 1 FROM user_blocks" in query:
                raise Exception("Simulated DB Failure inside handler")
            else:
                pass # Token check succeeds
        
        mock_cur.execute.side_effect = execute_side_effect
        mock_cur.fetchone.return_value = (True, False, None, False)
        
        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 500)
        
        mock_cur.close.assert_called()
        mock_conn.close.assert_called()

    @patch('app.get_db_connection')
    def test_chat_cursor_close_exception_cleanup(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.side_effect = [(True, False, None, False), {"1": 1}]
        
        # Simulate cursor close failing only on the second call (inside get_chat_history)
        mock_cur.close.side_effect = [None, Exception("Cursor already closed or failed")]
        
        resp = self.app.get(f'/api/chat/{self.other_user_id}', headers={'Authorization': f'Bearer {self.valid_token}'})
        self.assertEqual(resp.status_code, 403)
        
        mock_cur.close.assert_called()
        # Connection close must still happen!
        mock_conn.close.assert_called()


        # --- Review Validation Tests ---
    @patch('app.get_db_connection')
    def test_submit_review_invalid_json(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = (True, False, None, False)
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, data="not json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Invalid JSON payload', resp.data)

    @patch('app.get_db_connection')
    def test_submit_review_invalid_ratings(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = (True, False, None, False)
        
        # Test 1: Missing rating fields
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Missing rating fields', resp.data)

        # Test 2: Float ratings (e.g. 1.5)
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 1.5, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Ratings must be integers', resp.data)

        # Test 3: String ratings (e.g. "4")
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5, 'quality_rating': "4", 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Ratings must be integers', resp.data)

        # Test 4: Boolean ratings (e.g. true)
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5, 'quality_rating': 5, 'comm_rating': True
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Ratings must be integers', resp.data)

        # Test 5: null ratings
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': None, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Missing rating fields', resp.data)

        # Test 6: Out of bounds (>5)
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 6, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Ratings must be between 1 and 5', resp.data)


    @patch('app.get_db_connection')
    def test_submit_review_missing_helper(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchone.return_value = (True, False, None, False)
        
        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'speed_rating': 5, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'helper_id is required', resp.data)

    @patch('app.get_db_connection')
    def test_submit_review_invalid_helper(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.side_effect = [(True, False, None, False), None]

        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 404)
        self.assertIn(b'Referenced helper does not exist', resp.data)

    @patch('app.get_db_connection')
    def test_submit_review_unauthorized_problem(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.side_effect = [
            (True, False, None, False), 
            {"id": self.other_user_id},
            {"user_id": "someone_else", "assigned_helper_id": self.other_user_id}
        ]

        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 403)
        self.assertIn(b'Unauthorized to review this problem', resp.data)

    @patch('app.get_db_connection')
    def test_submit_review_unassigned_helper(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.side_effect = [
            (True, False, None, False), 
            {"id": self.other_user_id},
            {"user_id": self.valid_user_id, "assigned_helper_id": "someone_else"}
        ]

        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5, 'quality_rating': 5, 'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b'Referenced helper is not assigned to this problem', resp.data)

    @patch('app.get_db_connection')
    def test_submit_review_valid(self, mock_db):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.side_effect = [
            (True, False, None, False), 
            {"id": self.other_user_id},
            {"user_id": self.valid_user_id, "assigned_helper_id": self.other_user_id}
        ]

        resp = self.app.post(f'/api/problems/{"44444444-4444-4444-4444-444444444444"}/reviews', headers={'Authorization': f'Bearer {self.valid_token}'}, json={
            'helper_id': self.other_user_id,
            'speed_rating': 5,
            'quality_rating': 4,
            'comm_rating': 5
        })
        self.assertEqual(resp.status_code, 201)
        self.assertIn(b'Review submitted successfully', resp.data)

if __name__ == "__main__":
    unittest.main()
    unittest.main()










