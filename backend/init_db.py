import os
import sys
import psycopg2
from dotenv import load_dotenv
import migrate

load_dotenv()

def create_tables():
    force_reset = "--destructive-reset" in sys.argv
    conn = None
    cur = None

    if not os.getenv('DATABASE_URL'):
        print("Error: DATABASE_URL environment variable is missing.")
        sys.exit(1)
        
    if not force_reset:
        print("Safety check: Database initialization is running in safe upgrade mode.")
        print("To destructively reset all tables and lose existing data, pass the --destructive-reset flag.")
    # 1. Drop existing tables safely to rebuild the clean architecture
    drop_commands = (
        "DROP TABLE IF EXISTS messages CASCADE;",
        "DROP TABLE IF EXISTS reports CASCADE;",
        "DROP TABLE IF EXISTS trust_score_history CASCADE;",
        "DROP TABLE IF EXISTS help_offers CASCADE;",
        "DROP TABLE IF EXISTS push_tokens CASCADE;",
        "DROP TABLE IF EXISTS notifications CASCADE;",
        "DROP TABLE IF EXISTS problem_upvotes CASCADE;",
        "DROP TABLE IF EXISTS user_skills CASCADE;",
        "DROP TABLE IF EXISTS reviews CASCADE;",
        "DROP TABLE IF EXISTS helper_ratings CASCADE;",
        "DROP TABLE IF EXISTS problem_photos CASCADE;",
        "DROP TABLE IF EXISTS problems CASCADE;",
        "DROP TABLE IF EXISTS categories CASCADE;",
        "DROP TABLE IF EXISTS emergency_contacts CASCADE;",
        "DROP TABLE IF EXISTS user_blocks CASCADE;",
        "DROP TABLE IF EXISTS users CASCADE;",
        "DROP TABLE IF EXISTS localities CASCADE;"
    )

    # 2. Rebuild the 14-table optimized enterprise schema
    commands = (
        """
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        """,
        """
        CREATE TABLE IF NOT EXISTS localities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            pincode VARCHAR(10) NOT NULL,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            radius_km DOUBLE PRECISION DEFAULT 5.0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) UNIQUE NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            role VARCHAR(50) DEFAULT 'user',
            locality_id UUID REFERENCES localities(id) ON DELETE SET NULL,
            trust_score DOUBLE PRECISION DEFAULT 0.0,
            availability_status VARCHAR(50) DEFAULT 'available',
            is_verified BOOLEAN DEFAULT FALSE,
            community_radius_km INT DEFAULT 1,
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS problems (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
            status VARCHAR(50) DEFAULT 'open',
            priority VARCHAR(50) DEFAULT 'medium',
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            assigned_helper_id UUID REFERENCES users(id) ON DELETE SET NULL,
            locality_id UUID REFERENCES localities(id) ON DELETE CASCADE NOT NULL,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS problem_photos (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
            photo_url TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
            reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            helper_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS user_skills (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            skill_name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, skill_name)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS problem_upvotes (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, problem_id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            type VARCHAR(50) NOT NULL,
            related_id UUID,
            idempotency_key VARCHAR(128) UNIQUE,
            push_status VARCHAR(20) DEFAULT 'pending',
            push_attempts INT DEFAULT 0,
            pushed_at TIMESTAMP WITH TIME ZONE,
            is_read BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS push_tokens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            token TEXT UNIQUE NOT NULL,
            token_type VARCHAR(20) NOT NULL DEFAULT 'expo',
            platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS help_offers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
            helper_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            proposed_price DOUBLE PRECISION DEFAULT 0.0,
            message TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(problem_id, helper_id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS trust_score_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            score_change DOUBLE PRECISION NOT NULL,
            reason TEXT NOT NULL,
            related_problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS reports (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
            reason TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'open',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS emergency_contacts (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS user_blocks (
            blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
            blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (blocker_id, blocked_id)
        );
        """
    )

    try:
        conn = psycopg2.connect(
            os.getenv('DATABASE_URL'),
            sslmode='require'
        )
        cur = conn.cursor()
        
        if force_reset:
            print("WARNING: Executing DESTRUCTIVE schema reset! Dropping all tables...")
            for drop in drop_commands:
                cur.execute(drop)
        else:
            print("Executing safe schema verification (will not drop existing tables)...")
            
        print("Deploying Samanvi Master Architecture to Supabase...")
        for count, command in enumerate(commands, 1):
            cur.execute(command)
            print(f"[{count}/{len(commands)-1}] Table verified and created.")
            
        cur.close()
        conn.commit()
        print("Successfully deployed 100% optimized project schema!")
        
        # Apply numbered migrations
        import migrate
        migrate.apply_migrations(conn, verbose=False)
        
        # Verify schema post-migration
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='problems' AND column_name='resolved_at'")
        if not cur.fetchone():
            raise Exception("Critical Failure: public.problems.resolved_at does not exist after migration.")
        print("Schema verified: public.problems.resolved_at is present.")
        cur.close()

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error executing schema script: {error}")
        raise
    finally:
        if conn is not None:
            conn.close()

if __name__ == '__main__':
    create_tables()

