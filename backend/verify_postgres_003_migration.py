"""Verification of 003_push_tokens.sql against isolated PostgreSQL 16.2."""
import os
import sys
import tempfile
import psycopg2
from psycopg2.extras import RealDictCursor
import pgserver

def run_isolated_test():
    print("======================================================================")
    print("STAGE 3.2: ISOLATED POSTGRESQL 16.2 MIGRATION VERIFICATION (003_push_tokens.sql)")
    print("======================================================================")

    import shutil
    tmpdir = tempfile.mkdtemp()
    srv = None
    conn = None
    try:
        srv = pgserver.get_server(tmpdir)
        conn_uri = srv.get_uri()
        conn = psycopg2.connect(conn_uri)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Print PostgreSQL version
        cur.execute("SELECT version();")
        v = cur.fetchone()['version']
        print(f"[ENVIRONMENT] Native Engine: {v}\n")

        # 1. Initialize base tables + uuid
        print("--- SCENARIO 1: Initialize Baseline & Pre-seed Legacy Notifications ---")
        cur.execute("CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS 'select gen_random_uuid()' LANGUAGE sql;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                related_id UUID,
                is_read BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        # Seed user and legacy notifications (without idempotency_key)
        cur.execute("INSERT INTO users (email, name) VALUES ('u1@test.in', 'User 1'), ('u2@test.in', 'User 2') RETURNING id;")
        u1_id = cur.fetchone()['id']
        u2_id = cur.fetchone()['id']

        cur.execute("INSERT INTO notifications (user_id, title, body, type) VALUES (%s, 'Legacy 1', 'Old notif 1', 'test');", (u1_id,))
        cur.execute("INSERT INTO notifications (user_id, title, body, type) VALUES (%s, 'Legacy 2', 'Old notif 2', 'test');", (u1_id,))
        conn.commit()
        print("[PASS] Baseline initialized. 2 legacy notifications seeded.\n")

        # 2. Execute 003_push_tokens.sql
        print("--- SCENARIO 2: Execute 003_push_tokens.sql ---")
        mig_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations", "003_push_tokens.sql")
        with open(mig_path, "r", encoding="utf-8") as f:
            sql = f.read()
        cur.execute(sql)
        conn.commit()
        print("[PASS] 003_push_tokens.sql executed cleanly.\n")

        # 3. Verify columns, types, indexes, and legacy row preservation
        print("--- SCENARIO 3: Schema & Data Integrity Checks ---")
        cur.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name IN ('idempotency_key', 'push_status', 'push_attempts', 'pushed_at');
        """)
        notif_cols = {r['column_name']: r for r in cur.fetchall()}
        assert 'idempotency_key' in notif_cols, "idempotency_key column missing"
        assert 'push_status' in notif_cols, "push_status column missing"
        assert 'push_attempts' in notif_cols, "push_attempts column missing"
        assert 'pushed_at' in notif_cols, "pushed_at column missing"

        # Check legacy rows preserved with NULL idempotency_key AND explicit 'legacy' status
        cur.execute("SELECT id, push_status, idempotency_key FROM notifications WHERE idempotency_key IS NULL;")
        legacy_rows = cur.fetchall()
        assert len(legacy_rows) == 2, f"Expected 2 legacy rows with NULL key, got {len(legacy_rows)}"
        for leg in legacy_rows:
            assert leg['push_status'] == 'legacy', f"Expected legacy notification to have push_status='legacy', got {leg['push_status']}"

        # Insert a NEW notification without explicit push_status to verify default 'pending'
        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key)
            VALUES (%s, 'New Event', 'Body', 'offer', 'new_event_key_100')
            RETURNING push_status, push_attempts;
        """, (u1_id,))
        new_row = cur.fetchone()
        conn.commit()
        assert new_row['push_status'] == 'pending', f"New notification should default to 'pending', got {new_row['push_status']}"
        assert new_row['push_attempts'] == 0, f"New notification should default to attempts=0, got {new_row['push_attempts']}"

        # Verify recovery queue query picks up new pending row but ignores legacy rows
        cur.execute("""
            SELECT id, title, push_status FROM notifications
            WHERE push_status IN ('pending', 'failed') AND idempotency_key IS NOT NULL AND push_attempts < 3;
        """)
        queue_items = cur.fetchall()
        assert len(queue_items) == 1, f"Expected exactly 1 queue item, got {len(queue_items)}"
        assert queue_items[0]['title'] == 'New Event', "Wrong item in recovery queue"
        print("[PASS] Schema verified. Legacy rows marked 'legacy'. New rows default to 'pending'. Queue ignores legacy.\n")

        # 4. Verify push_tokens table & constraints
        print("--- SCENARIO 4: push_tokens Constraints, Upsert & Cascade Deletion ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'push_tokens';
        """)
        pt_cols = [r['column_name'] for r in cur.fetchall()]
        for expected in ['id', 'user_id', 'token', 'token_type', 'platform', 'is_active', 'created_at', 'updated_at']:
            assert expected in pt_cols, f"push_tokens column {expected} missing"

        # Insert token for User 1
        test_token = "ExponentPushToken[device-xyz-12345]"
        cur.execute("""
            INSERT INTO push_tokens (user_id, token, token_type, platform)
            VALUES (%s, %s, 'expo', 'android') RETURNING id;
        """, (u1_id, test_token))
        conn.commit()

        # Reassign token to User 2 via ON CONFLICT (token) DO UPDATE
        cur.execute("""
            INSERT INTO push_tokens (user_id, token, token_type, platform)
            VALUES (%s, %s, 'expo', 'android')
            ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id
            RETURNING user_id;
        """, (u2_id, test_token))
        reassigned_uid = cur.fetchone()['user_id']
        conn.commit()
        assert str(reassigned_uid) == str(u2_id), "Token was not reassigned to User 2"

        # Verify CASCADE on user deletion
        cur.execute("DELETE FROM users WHERE id = %s;", (u2_id,))
        conn.commit()
        cur.execute("SELECT COUNT(*) as count FROM push_tokens WHERE token = %s;", (test_token,))
        c = cur.fetchone()['count']
        assert c == 0, "Token was not deleted via ON DELETE CASCADE"
        print("[PASS] push_tokens upsert reassignment and foreign key CASCADE verified.\n")

        # 5. Verify Idempotency (re-executing 003_push_tokens.sql)
        print("--- SCENARIO 5: Migration Idempotency (Second Execution) ---")
        cur.execute(sql)
        conn.commit()

        # Re-check legacy rows still have 'legacy' and new row still has 'pending'
        cur.execute("SELECT push_status FROM notifications WHERE idempotency_key IS NULL;")
        for r in cur.fetchall():
            assert r['push_status'] == 'legacy', "Rerun altered legacy row status"
        cur.execute("SELECT push_status FROM notifications WHERE idempotency_key = 'new_event_key_100';")
        assert cur.fetchone()['push_status'] == 'pending', "Rerun altered new row status"
        print("[PASS] Re-execution of 003_push_tokens.sql succeeded with 0 errors. Preserved legacy and new statuses.\n")

        # 6. Verify atomic ON CONFLICT DO NOTHING on idempotency_key
        print("--- SCENARIO 6: Atomic Duplicate Event Prevention ---")
        key = "test_event_key_456"
        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key)
            VALUES (%s, 'Event', 'Body', 'test', %s)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id;
        """, (u1_id, key))
        first_res = cur.fetchone()
        assert first_res is not None, "First insert should return id"

        cur.execute("""
            INSERT INTO notifications (user_id, title, body, type, idempotency_key)
            VALUES (%s, 'Event', 'Body', 'test', %s)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id;
        """, (u1_id, key))
        second_res = cur.fetchone()
        assert second_res is None, "Concurrent duplicate insert should return None"
        conn.commit()
        print("[PASS] Atomic duplicate event prevention confirmed by PostgreSQL engine.\n")

        cur.close()
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        if srv:
            try:
                srv.cleanup()
            except Exception:
                pass
        shutil.rmtree(tmpdir, ignore_errors=True)

    print("======================================================================")
    print("ALL 6 ISOLATED POSTGRESQL 16.2 MIGRATION TESTS PASSED (0 FAILURES)")
    print("======================================================================")

if __name__ == '__main__':
    run_isolated_test()
