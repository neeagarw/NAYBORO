#!/usr/bin/env bash
# Runs the privacy checks against a throwaway local Postgres (no Supabase needed).
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -q -c "drop database if exists nayboro_test" -c "create database nayboro_test"
psql -q -d nayboro_test -v ON_ERROR_STOP=1 -f tests/00_supabase_stub.sql $(ls migrations/*.sql | sort | sed "s/^/-f /") -f seed.sql
psql -q -d nayboro_test -f tests/privacy_checks.sql
