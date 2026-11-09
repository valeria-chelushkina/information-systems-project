DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'exporter') THEN
    CREATE ROLE exporter LOGIN;
  END IF;
END
$$;

ALTER ROLE exporter WITH LOGIN PASSWORD 'dev_exporter_pw';
GRANT pg_monitor TO exporter;

GRANT CONNECT ON DATABASE db_ticketing TO exporter;
GRANT CONNECT ON DATABASE db_catalog TO exporter;
GRANT CONNECT ON DATABASE db_notify TO exporter;

\connect db_ticketing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT SELECT ON pg_stat_statements TO exporter;

\connect db_catalog
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT SELECT ON pg_stat_statements TO exporter;

\connect db_notify
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT SELECT ON pg_stat_statements TO exporter;
