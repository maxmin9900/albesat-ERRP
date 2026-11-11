-- Run on server: sudo -u postgres psql -f grant-carpet-db.sql
-- Fixes "permission denied for schema public" (PostgreSQL 15+)

ALTER DATABASE carpet_db OWNER TO reza;

\connect carpet_db

ALTER SCHEMA public OWNER TO reza;

-- PostgreSQL 15+ revoked CREATE from PUBLIC on schema public
GRANT ALL ON SCHEMA public TO reza;
GRANT CREATE ON SCHEMA public TO reza;
GRANT USAGE ON SCHEMA public TO reza;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO reza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO reza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO reza;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO reza;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO reza;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO reza;

-- Allow reza to connect
GRANT CONNECT ON DATABASE carpet_db TO reza;
GRANT TEMPORARY ON DATABASE carpet_db TO reza;
