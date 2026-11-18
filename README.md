# Nayboro

Find your people, wherever you are. Phone-first web app (Next.js + Supabase).

## Start
```bash
npm install
cp .env.example .env.local      # add your Supabase URL and anon key
npm run dev                     # http://localhost:3000
```

## Database
```bash
supabase link --project-ref <your-ref>
supabase db push                # applies supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql
```
To check the privacy rules against any local Postgres: `supabase/tests/run.sh`.

## Where things are
- `CLAUDE.md`: product rules and working style for Claude Code. Read this first.
- `docs/SPEC.md`: screens → routes, data model, build order, open questions.
- `design/mockups/`: the 10 HTML mockups (source of truth). `design/screenshots/`: reference images.
- `supabase/`: migration, seed and privacy tests.
- `src/app/page.tsx`: Welcome screen, ported from the mockup.
