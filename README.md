# Carify

A mobile-first PWA for tracking a car's fuel fill-ups and service history.
Built with Next.js 16, Postgres (Drizzle), and Better Auth (passkeys).

## Local setup

```bash
docker compose up -d      # Postgres 17 (creates carify_test on first volume init)
cp .env.example .env
npm i
npm run db:migrate
npm run db:seed           # local databases only
npm run dev
```

The `carify_test` database is created only when the Docker volume is first
initialised (via `docker/init.sql`). If you already had a volume from before,
create it manually:
`docker compose exec db psql -U carify -c 'CREATE DATABASE carify_test;'`
(or `docker compose down -v`, which destroys local data).

Open http://localhost:3000. Demo login (from the seed): `demo@carify.local` / `demo-password`.

## Tests

With Docker running:

```bash
npm test           # unit tests
npm run test:db    # DB integration tests (use `<db>_test` next to the local DATABASE_URL)
```

## Production setup

Only the `master` branch deploys (`vercel.json`); previews are disabled.

1. **GitHub**: create a repository and push `master`.
2. **Vercel**: import the repository as a new project. Pick the project name
   carefully: the production URL `https://<name>.vercel.app` is permanent
   (see Troubleshooting). Set the Production Branch to `master`.
3. **Neon**: create a project on **Postgres 17**. Copy the **direct**
   (non-pooled) connection string; it is the only database variable
   (`DATABASE_URL`) and is also used for migrations. Do not use the Vercel-Neon
   integration's preview branches.
4. **Environment variables** (Vercel -> Settings -> Environment Variables, Production):
   - `DATABASE_URL`: the Neon direct connection string
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `https://<name>.vercel.app`
5. **First deploy**: push to `master` (or redeploy). The build runs
   `drizzle-kit migrate && next build`, so the schema is migrated automatically.
   Do not run `db:seed` against production (it refuses non-local databases).

## Install on iPhone

Open the production URL in Safari -> Share -> Add to Home Screen.
The app needs a connection; there is no offline mode.

## Project rules

- **Migrations are additive only** (add tables/columns, never drop or rename
  in place). Every deploy migrates the live DB before the new code goes live.
- **Server Actions**: a file with a file-level `'use server'` may export only
  Server Actions, and each must derive the user via `requireUser()`. Never
  accept a `userId` parameter. Every export is a public HTTP endpoint.
- **Money is stored in kopecks** (integers), never floats.

## Troubleshooting

- **Passkeys stop working**: passkeys are bound to the domain (RP ID). Changing
  the production domain, and so `BETTER_AUTH_URL`, invalidates all existing
  passkeys. Keep the `*.vercel.app` URL permanent.
- **Build fails at migrate**: check that `DATABASE_URL` is set and reachable.
