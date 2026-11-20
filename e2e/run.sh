#!/usr/bin/env bash
# Local end-to-end test with no Supabase account needed.
# Needs: a Postgres you can reach as superuser (PGHOST/PGPORT/PGUSER), the postgrest binary on PATH,
# Python 3 with playwright, and Chrome/Chromium (set CHROME=/path/to/chrome if not found).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p e2e/out
psql -q -c "drop database if exists e2e" -c "create database e2e"
MIGRATIONS=$(ls supabase/migrations/*.sql | sort | sed "s/^/-f /")
psql -q -d e2e -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql $MIGRATIONS -f supabase/seed.sql
psql -q -d e2e -v ON_ERROR_STOP=1 -f e2e/grants.sql
# Mockup people, questions and events (local only, never production).
psql -q -d e2e -v ON_ERROR_STOP=1 -f supabase/demo_seed.sql > /dev/null || { echo 'demo seed failed'; exit 1; }
postgrest e2e/postgrest.conf > e2e/out/postgrest.log 2>&1 & PGRST=$!
python3 e2e/local_supabase.py & GW=$!
trap 'kill $PGRST $GW 2>/dev/null' EXIT
key() { python3 -c "
import json,base64,hmac,hashlib,sys
S=b'super-secret-jwt-token-with-at-least-32-characters-long'
b=lambda x: base64.urlsafe_b64encode(x).rstrip(b'=').decode()
h=b(json.dumps({'alg':'HS256','typ':'JWT'}).encode()); p=b(json.dumps({'role':sys.argv[1],'exp':2000000000}).encode())
print(h+'.'+p+'.'+b(hmac.new(S,(h+'.'+p).encode(),hashlib.sha256).digest()))" "$1"; }
ANON=$(key anon)
rm -f e2e/out/emails.jsonl
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
export SUPABASE_SERVICE_ROLE_KEY=$(key service_role) NEXT_PUBLIC_SITE_URL=http://localhost:3123
export RESEND_API_URL=http://127.0.0.1:54321/resend/emails RESEND_API_KEY=re_test EMAIL_FROM="Nayboro <hello@example.com>"
export NOTIFY_WEBHOOK_SECRET=whsec_test CRON_SECRET=cron_test UNSUBSCRIBE_SECRET=unsub_test
npm run build
if curl -s -o /dev/null localhost:3123; then echo 'Port 3123 is busy: stop the old app first'; exit 1; fi
npx next start -p 3123 > e2e/out/next.log 2>&1 & NEXT=$!
trap 'pkill -P $NEXT 2>/dev/null; kill $PGRST $GW $NEXT 2>/dev/null' EXIT
sleep 5
python3 e2e/waitlist_flow.py   # starts pre-launch, ends with the site open
python3 e2e/setup_flow.py
python3 e2e/screens_flow.py
python3 e2e/quality_check.py
