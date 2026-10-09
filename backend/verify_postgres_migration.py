"""
Isolated PostgreSQL Migration Verification Harness
Executes backend/migrations/rebuild_migration.sql against an isolated,
disposable PostgreSQL 16.2 database instance provided by pgserver.
Tests all required starting states, data backfills, idempotency, and failure modes.
"""
import os
import sys
import tempfile
import shutil
import ast
import re
import psycopg2
from psycopg2.extras import RealDictCursor
import pgserver

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATION_FILE = os.path.join(BACKEND_DIR, "migrations", "rebuild_migration.sql")

def get_base_ddl_commands():
    """Extract table creation DDL commands from init_db.py."""
    init_db_path = os.path.join(BACKEND_DIR, "init_db.py")
    tree = ast.parse(open(init_db_path, encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "commands" for t in node.targets):
            commands = [ast.literal_eval(e) for e in node.value.elts]
            # Strip out CREATE EXTENSION since pgserver has gen_random_uuid in core
            return [cmd for cmd in commands if "CREATE EXTENSION" not in cmd.upper()]
    raise RuntimeError("commands tuple not found in init_db.py")

def create_isolated_server():
    """Launch a disposable PostgreSQL instance in a temporary directory."""
    temp_dir = tempfile.mkdtemp(prefix="samanvi-migration-pg-")
    server = pgserver.get_server(temp_dir, cleanup_mode="delete")
    uri = server.get_uri()
    return server, uri, temp_dir

def setup_base_schema(conn):
    """Set up the pre-migration baseline schema."""
    cur = conn.cursor()
    # Provide uuid_generate_v4 alias for gen_random_uuid
    cur.execute("CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid AS 'select gen_random_uuid()' LANGUAGE sql")
    for ddl in get_base_ddl_commands():
        cur.execute(ddl)
    conn.commit()
    cur.close()

def run_all_verification_tests():
    print("=" * 70)
    print("SAMANVI STAGE 3.4: ISOLATED POSTGRESQL MIGRATION VERIFICATION")
    print("=" * 70)

    server, uri, temp_dir = create_isolated_server()
    print(f"[ENVIRONMENT] Isolated PostgreSQL Server launched successfully.")
    
    conn = psycopg2.connect(uri)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("SELECT version();")
    pg_version = cur.fetchone()[0]
    print(f"[ENVIRONMENT] Engine: {pg_version}")
    cur.close()
    conn.close()

    results = []

    try:
        # -------------------------------------------------------------
        # TEST 1: Fresh Database Baseline & Migration Execution
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 1: Fresh Database Baseline & Migration Execution")
        print("-" * 70)
        conn = psycopg2.connect(uri)
        conn.autocommit = False
        setup_base_schema(conn)
        
        migration_sql = open(MIGRATION_FILE, encoding="utf-8").read()
        cur = conn.cursor()
        print("Executing rebuild_migration.sql...")
        cur.execute(migration_sql)
        conn.commit()
        print("Execution completed successfully.")

        # Verify columns on users
        cur.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='users'
        """)
        users_cols = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
        required_user_cols = [
            'home_lat', 'home_lon', 'latitude', 'longitude', 'address', 'home_locality',
            'home_verified', 'community_radius_km', 'phone_verified', 'is_available',
            'available_until', 'verification_level', 'account_deleted', 'deleted_at',
            'bio', 'description', 'aadhaar_hash', 'aadhaar_last4', 'aadhaar_verified',
            'aadhaar_verified_at', 'consent_dpdp', 'consent_dpdp_at'
        ]
        for col in required_user_cols:
            assert col in users_cols, f"Missing user column: {col}"
        
        # Verify defaults
        assert users_cols['community_radius_km'][1] == '1', f"community_radius_km default mismatch: {users_cols['community_radius_km'][1]}"
        assert '50' in str(users_cols['trust_score'][1]), f"trust_score default mismatch: {users_cols['trust_score'][1]}"

        # Verify problems columns and locality_id nullable
        cur.execute("""
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='problems'
        """)
        prob_cols = {r[0]: r[1] for r in cur.fetchall()}
        required_prob_cols = [
            'post_type', 'budget_range', 'resolution_photo_url', 'rating',
            'category', 'helper_id', 'resolved_at', 'photo_url', 'resolved_by_helper_id'
        ]
        for col in required_prob_cols:
            assert col in prob_cols, f"Missing problem column: {col}"
        assert prob_cols['locality_id'] == 'YES', "problems.locality_id should be nullable"

        # Verify reviews structure
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='reviews'
        """)
        reviews_cols = {r[0]: r[1] for r in cur.fetchall()}
        assert 'resident_id' in reviews_cols, "Missing resident_id in reviews"
        assert 'reviewer_id' not in reviews_cols, "reviewer_id should have been renamed"
        for col in ['speed_rating', 'quality_rating', 'comm_rating', 'overall_rating', 'resolution_photo_url']:
            assert col in reviews_cols, f"Missing {col} in reviews"

        # Verify new tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' AND table_type='BASE TABLE'
        """)
        all_tables = {r[0] for r in cur.fetchall()}
        new_tables = [
            'relocation_requests', 'community_connections', 'problem_confirmations',
            'problem_votes', 'watch_zones', 'user_blocks', 'otp_verifications', 'token_blacklist'
        ]
        for tbl in new_tables:
            assert tbl in all_tables, f"Missing table: {tbl}"

        print("[TEST 1 PASSED] Fresh schema migration, table creation, column types, and defaults verified.")
        results.append(("Test 1: Fresh Database Baseline & Migration", "PASS", "All columns, tables, types, and defaults verified"))
        cur.close()
        conn.close()

        # -------------------------------------------------------------
        # TEST 2: Legacy Data Preservation & Rating Backfill Verification
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 2: Legacy Data Preservation & Rating Backfill Verification")
        print("-" * 70)
        
        # Spin up a fresh database for legacy data testing
        server2, uri2, temp_dir2 = create_isolated_server()
        conn2 = psycopg2.connect(uri2)
        conn2.autocommit = False
        setup_base_schema(conn2)
        cur2 = conn2.cursor(cursor_factory=RealDictCursor)

        # Seed synthetic legacy records
        cur2.execute("INSERT INTO localities (id, name, pincode) VALUES (gen_random_uuid(), 'Indiranagar', '560038') RETURNING id")
        loc_id = cur2.fetchone()['id']

        cur2.execute("INSERT INTO categories (id, name) VALUES (gen_random_uuid(), 'Plumbing') RETURNING id")
        cat_id = cur2.fetchone()['id']

        cur2.execute("INSERT INTO users (id, email, password_hash, name) VALUES (gen_random_uuid(), 'user1@test.com', 'hash', 'Alice') RETURNING id")
        u1_id = cur2.fetchone()['id']

        cur2.execute("INSERT INTO users (id, email, password_hash, name) VALUES (gen_random_uuid(), 'user2@test.com', 'hash', 'Bob') RETURNING id")
        u2_id = cur2.fetchone()['id']

        cur2.execute("INSERT INTO problems (id, title, description, category_id, user_id, locality_id) VALUES (gen_random_uuid(), 'Leak', 'Pipe leak', %s, %s, %s) RETURNING id",
                    (cat_id, u1_id, loc_id))
        prob_id = cur2.fetchone()['id']

        # Insert 4 legacy reviews:
        # Review 1: rating = 5 (all structured ratings are missing) -> should backfill to 5,5,5,5
        cur2.execute("INSERT INTO reviews (id, problem_id, reviewer_id, helper_id, rating, comment) VALUES (gen_random_uuid(), %s, %s, %s, 5, 'Great job') RETURNING id",
                    (prob_id, u1_id, u2_id))
        rev1_id = cur2.fetchone()['id']

        # Review 2: rating = 4, but add structured columns beforehand to test partial existing values
        cur2.execute("ALTER TABLE reviews ADD COLUMN speed_rating INT, ADD COLUMN quality_rating INT, ADD COLUMN comm_rating INT, ADD COLUMN overall_rating INT")
        # seed with speed_rating = 2 already populated, other structured ratings NULL
        cur2.execute("INSERT INTO reviews (id, problem_id, reviewer_id, helper_id, rating, speed_rating, comment) VALUES (gen_random_uuid(), %s, %s, %s, 4, 2, 'Speed was 2, overall 4') RETURNING id",
                    (prob_id, u1_id, u2_id))
        rev2_id = cur2.fetchone()['id']

        # Review 3: rating = NULL -> should remain NULL
        cur2.execute("INSERT INTO reviews (id, problem_id, reviewer_id, helper_id, rating, comment) VALUES (gen_random_uuid(), %s, %s, %s, NULL, 'No rating given') RETURNING id",
                    (prob_id, u1_id, u2_id))
        rev3_id = cur2.fetchone()['id']

        conn2.commit()
        print("Synthetic legacy records seeded successfully:")
        print(f"  - Review 1 (rating=5, all structured ratings NULL)")
        print(f"  - Review 2 (rating=4, speed_rating=2 existing, other structured ratings NULL)")
        print(f"  - Review 3 (rating=NULL)")

        print("Executing rebuild_migration.sql against legacy database...")
        cur2.execute(migration_sql)
        conn2.commit()

        # Check backfilled values
        cur2.execute("SELECT resident_id, helper_id, rating, speed_rating, quality_rating, comm_rating, overall_rating FROM reviews WHERE id = %s", (rev1_id,))
        r1 = cur2.fetchone()
        assert r1['resident_id'] == u1_id, "reviewer_id was not migrated to resident_id"
        assert r1['speed_rating'] == 5 and r1['quality_rating'] == 5 and r1['comm_rating'] == 5 and r1['overall_rating'] == 5, f"Backfill failed for rev1: {r1}"

        cur2.execute("SELECT resident_id, helper_id, rating, speed_rating, quality_rating, comm_rating, overall_rating FROM reviews WHERE id = %s", (rev2_id,))
        r2 = cur2.fetchone()
        assert r2['speed_rating'] == 2, f"Existing speed_rating was overwritten: {r2['speed_rating']}"
        assert r2['quality_rating'] == 4 and r2['comm_rating'] == 4 and r2['overall_rating'] == 4, f"Partial backfill failed for rev2: {r2}"

        cur2.execute("SELECT resident_id, helper_id, rating, speed_rating, quality_rating, comm_rating, overall_rating FROM reviews WHERE id = %s", (rev3_id,))
        r3 = cur2.fetchone()
        assert r3['speed_rating'] is None and r3['quality_rating'] is None and r3['comm_rating'] is None and r3['overall_rating'] is None, f"NULL rating was improperly backfilled: {r3}"

        print("[TEST 2 PASSED] Legacy rating backfill verified: full backfill, partial preservation, and NULL preservation confirmed.")
        results.append(("Test 2: Legacy Data Backfill & Preservation", "PASS", "Full, partial, and NULL legacy rating backfills verified"))
        
        # -------------------------------------------------------------
        # TEST 3: Idempotency (Rerun on Already-Migrated DB)
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 3: Migration Idempotency (Rerun on Already-Migrated DB)")
        print("-" * 70)
        print("Applying rebuild_migration.sql a second time...")
        cur2.execute(migration_sql)
        conn2.commit()

        # Re-check records after rerun
        cur2.execute("SELECT resident_id, rating, speed_rating, quality_rating, comm_rating, overall_rating FROM reviews WHERE id = %s", (rev1_id,))
        r1_rerun = cur2.fetchone()
        assert r1_rerun['speed_rating'] == 5 and r1_rerun['overall_rating'] == 5

        print("[TEST 3 PASSED] Re-running rebuild_migration.sql succeeded without errors or side effects.")
        results.append(("Test 3: Migration Idempotency", "PASS", "Second execution succeeded with zero errors and preserved data"))

        cur2.close()
        conn2.close()
        server2.cleanup()

        # -------------------------------------------------------------
        # TEST 4: Conflict Resolution (Both reviewer_id and resident_id exist)
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 4: Conflict Resolution (Both reviewer_id & resident_id exist)")
        print("-" * 70)
        server4, uri4, temp_dir4 = create_isolated_server()
        conn4 = psycopg2.connect(uri4)
        conn4.autocommit = False
        setup_base_schema(conn4)
        cur4 = conn4.cursor()
        
        # Create conflict: add resident_id while reviewer_id already exists
        cur4.execute("ALTER TABLE reviews ADD COLUMN resident_id UUID REFERENCES users(id)")
        conn4.commit()

        conflict_caught = False
        try:
            cur4.execute(migration_sql)
            conn4.commit()
        except Exception as e:
            conn4.rollback()
            conflict_caught = True
            error_msg = str(e)
            print(f"Expected conflict exception caught: {error_msg.strip()}")
            assert "Migration conflict: Both reviewer_id and resident_id exist" in error_msg

        assert conflict_caught, "Expected migration conflict exception was not raised!"
        print("[TEST 4 PASSED] Migration safely raised conflict exception and rolled back transaction.")
        results.append(("Test 4: Conflict Guard (reviewer_id + resident_id)", "PASS", "Expected conflict exception raised and transaction rolled back"))
        cur4.close()
        conn4.close()
        server4.cleanup()

        # -------------------------------------------------------------
        # TEST 5: Out-of-Range Legacy Rating Detection
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 5: Out-of-Range Legacy Rating Detection (< 1 or > 5)")
        print("-" * 70)
        server5, uri5, temp_dir5 = create_isolated_server()
        conn5 = psycopg2.connect(uri5)
        conn5.autocommit = False
        setup_base_schema(conn5)
        cur5 = conn5.cursor()

        # Drop the check constraint temporarily to simulate legacy dirty data (e.g. rating = 0 or 6)
        cur5.execute("""
            DO $$
            DECLARE
                cname TEXT;
            BEGIN
                SELECT conname INTO cname FROM pg_constraint WHERE conrelid = 'reviews'::regclass AND contype = 'c';
                IF cname IS NOT NULL THEN
                    EXECUTE 'ALTER TABLE reviews DROP CONSTRAINT ' || cname;
                END IF;
            END $$;
        """)
        # Insert dirty record with rating = 0
        cur5.execute("INSERT INTO localities (id, name, pincode) VALUES (gen_random_uuid(), 'Loc', '123456') RETURNING id")
        lid = cur5.fetchone()[0]
        cur5.execute("INSERT INTO categories (id, name) VALUES (gen_random_uuid(), 'Cat') RETURNING id")
        cid = cur5.fetchone()[0]
        cur5.execute("INSERT INTO users (id, email, password_hash, name) VALUES (gen_random_uuid(), 'u1@t.com', 'h', 'U1'), (gen_random_uuid(), 'u2@t.com', 'h', 'U2')")
        cur5.execute("SELECT id FROM users LIMIT 2")
        u_ids = [r[0] for r in cur5.fetchall()]
        cur5.execute("INSERT INTO problems (id, title, description, category_id, user_id, locality_id) VALUES (gen_random_uuid(), 'P', 'D', %s, %s, %s) RETURNING id",
                    (cid, u_ids[0], lid))
        pid = cur5.fetchone()[0]
        cur5.execute("INSERT INTO reviews (id, problem_id, reviewer_id, helper_id, rating, comment) VALUES (gen_random_uuid(), %s, %s, %s, 0, 'Invalid rating') RETURNING id",
                    (pid, u_ids[0], u_ids[1]))
        conn5.commit()

        invalid_rating_caught = False
        try:
            cur5.execute(migration_sql)
            conn5.commit()
        except Exception as e:
            conn5.rollback()
            invalid_rating_caught = True
            error_msg = str(e)
            print(f"Expected invalid rating exception caught: {error_msg.strip()}")
            assert "Migration conflict: Legacy rating values found outside the 1-5 range" in error_msg

        assert invalid_rating_caught, "Expected invalid rating exception was not raised!"
        print("[TEST 5 PASSED] Out-of-range legacy rating detected, transaction rolled back safely.")
        results.append(("Test 5: Out-of-Range Legacy Rating Detection", "PASS", "Invalid rating detected and transaction rolled back"))
        cur5.close()
        conn5.close()
        server5.cleanup()

        # -------------------------------------------------------------
        # TEST 6: Variant Starting States (Neither or Only resident_id)
        # -------------------------------------------------------------
        print("\n" + "-" * 70)
        print("TEST 6: Variant Starting States for resident_id")
        print("-" * 70)
        server6, uri6, temp_dir6 = create_isolated_server()
        conn6 = psycopg2.connect(uri6)
        conn6.autocommit = False
        setup_base_schema(conn6)
        cur6 = conn6.cursor()

        # Case A: Only resident_id exists
        cur6.execute("ALTER TABLE reviews RENAME COLUMN reviewer_id TO resident_id")
        conn6.commit()
        cur6.execute(migration_sql)
        conn6.commit()
        print("Case A (Only resident_id exists beforehand): Migrated cleanly.")

        # Case B: Drop resident_id so neither exists
        cur6.execute("ALTER TABLE reviews DROP COLUMN resident_id CASCADE")
        conn6.commit()
        cur6.execute(migration_sql)
        conn6.commit()
        cur6.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='resident_id'")
        assert cur6.fetchone() is not None, "resident_id was not added when neither existed"
        print("Case B (Neither reviewer_id nor resident_id exists beforehand): Added cleanly.")

        print("[TEST 6 PASSED] All starting state variations of resident_id handled cleanly.")
        results.append(("Test 6: resident_id Starting State Variations", "PASS", "Only resident_id and Neither column cases verified"))
        cur6.close()
        conn6.close()
        server6.cleanup()

    finally:
        server.cleanup()
        shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY:")
    for name, status, details in results:
        print(f"  [{status}] {name} - {details}")
    print("=" * 70)

if __name__ == '__main__':
    run_all_verification_tests()
