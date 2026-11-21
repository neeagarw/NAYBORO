#!/usr/bin/env bash
# Pre-launch Google Sheet setup, end to end: builds the site with NO Supabase settings,
# runs apps-script/Code.gs locally (e2e/fake_apps_script.mjs) and drives the page in Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p e2e/out; rm -f e2e/out/sheet.json e2e/out/sheet-mail.jsonl
if curl -s -o /dev/null localhost:3124; then echo 'Port 3124 is busy'; exit 1; fi
SECRET=test-secret PORT=54400 node e2e/fake_apps_script.mjs > e2e/out/sheet-script.log 2>&1 & FAKE=$!
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u RESEND_API_KEY \
  WAITLIST_STORE=sheet npx next build > e2e/out/sheet-build.log 2>&1 || { tail -30 e2e/out/sheet-build.log; kill $FAKE; exit 1; }
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u RESEND_API_KEY \
  WAITLIST_STORE=sheet SHEET_WEBHOOK_URL=http://127.0.0.1:54400/exec SHEET_WEBHOOK_SECRET=test-secret \
  UNSUBSCRIBE_SECRET=test-unsub IP_HASH_SALT=test-salt NEXT_PUBLIC_SITE_URL=http://localhost:3124 \
  npx next start -p 3124 > e2e/out/sheet-next.log 2>&1 & NEXT=$!
trap 'pkill -P $NEXT 2>/dev/null; kill $NEXT $FAKE 2>/dev/null' EXIT
for i in $(seq 60); do curl -s -o /dev/null localhost:3124 && break; sleep 1; done
python3 e2e/sheet_flow.py
