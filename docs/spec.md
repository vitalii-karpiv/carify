# Carify — Specification

Status: agreed (2026-11-01). Scope: MVP.

Carify is a personal car tracker — fuel and service logs with consumption and cost stats — built as a Next.js PWA meant to be installed on an iPhone home screen.

## 1. Product decisions

| Topic | Decision |
|---|---|
| Users | Open registration, multi-tenant. Every row is owned by a `userId`; every query is scoped by it on the server. |
| Auth | Email + password, then optional passkeys (Face ID). Long rolling session (~1 year). No email sending: no verification, no password reset. |
| Vehicles | Multiple per user. Archive (soft) or hard delete (cascades entries). |
| Powertrain | Petrol/diesel only in MVP. Data model uses generic `quantity` + `unit` so kWh/LPG can be added later. |
| Locale | English UI, `uk-UA` number/date formatting via `Intl`, kilometres, L/100km, UAH. No i18n library. |
| Offline | Server-first, plus an offline outbox for **creating** fuel/service entries. Everything else requires a connection. |
| Out of scope | Reminders, notifications, export, import, receipt photos, non-fuel/service expenses, trips, EV/LPG. |

## 2. Features

### 2.1 Vehicles
Fields: `name`, `make`, `model`, `year`, `plate`, `vin?`, `defaultGrade`.
- Archive hides the vehicle from the switcher and lists; history is kept. Archived vehicles can be restored.
- Hard delete lives in a "danger zone" with typed confirmation; deletes all its entries.

### 2.2 Vehicle switcher
- Top bar on every app screen. Selection is persisted in a `vehicleId` cookie so server components can read it.
- All tabs (dashboard, fuel, service, stats) show the selected vehicle.
- No vehicles yet → every app screen shows an empty state pointing to "Add vehicle".

### 2.3 Fuel log
Form fields:
- **Odometer** (int km, required, autofocused)
- **Date/time** (default now)
- **Litres / Price per litre / Total** — the user enters any two, the third is derived (see §4.2)
- **Grade** — defaults to the vehicle's `defaultGrade`
- **Full tank** (default on)
- **Missed previous fill** (default off)
- **Station** (optional), **Note** (optional)

Vehicle preselected = last used vehicle.

Fuel grades (code-level enum, easy to extend): `A92`, `A95`, `A95_PLUS`, `A98`, `DIESEL`, `DIESEL_PLUS`.

### 2.4 Service log
Fields: date, odometer, category, total cost, garage (optional), notes (optional).
Categories: `OIL_CHANGE`, `BRAKES`, `TYRES`, `INSPECTION`, `REPAIR`, `OTHER`.

### 2.5 Editing & deleting
- Entries: edit and hard delete (with confirm). Online only.
- Vehicles: see §2.1. Online only.

### 2.6 Dashboard (selected vehicle)
- Current odometer (max odometer across fuel + service entries; "—" if none)
- Average L/100km (lifetime) and last L/100km
- Spend this month (fuel + service)
- Last 5 entries, fuel and service mixed, newest first
- Link to Stats

### 2.7 Stats (selected vehicle, page under dashboard)
1. Average L/100km — lifetime and last segment
2. Consumption trend — L/100km per valid segment over time (line)
3. Price-per-litre trend — per grade (line, one series per grade)
4. Monthly spend — fuel vs service (stacked bars)
5. Cost per km — `(total fuel + service spend) / (max odometer − min odometer)`; hidden if distance is 0
6. Total spent — fuel, service, combined

All stats are computed at read time; nothing derived is stored.

### 2.8 Navigation & shell
- Bottom tab bar: **Dashboard · Fuel · Service · Vehicles**
- Floating "+" button → quick add (fuel by default, toggle to service)
- Top bar: vehicle switcher, sync status indicator, link to Settings
- Settings: manage passkeys, sign out, "Needs attention" list (§3.5)
- iOS safe areas respected; light/dark follows system

## 3. Offline design

### 3.1 Scope
- Works offline: the **Add entry** screen (`/add`) only.
- Other screens offline: offline fallback / banner "Offline — N entries waiting to sync".

### 3.2 Local storage (IndexedDB via `idb`)
- `snapshot` store — per vehicle: `id`, `name`, `defaultGrade`, `lastOdometer`, `archived`; plus `lastUsedVehicleId`. Refreshed from `GET /api/offline-snapshot` whenever the app loads online and after each successful sync.
- `outbox` store — `{ id, kind: 'fuel' | 'service', payload, status: 'pending' | 'failed', error?, attempts, createdAt }`.

### 3.3 Write path
- `/add` always writes to the outbox first, then triggers a sync immediately (online case completes within a second; offline case waits).
- Entry IDs are UUIDv7 generated on the client.
- Queued writes go to **Route Handlers**, never Server Actions (action IDs change per deploy):
  - `POST /api/fuel-entries`
  - `POST /api/service-entries`
- Server inserts with `ON CONFLICT (id) DO NOTHING` → replays are idempotent.

Response handling in the sync loop:

| Response | Meaning | Client action |
|---|---|---|
| 201 | created | remove from outbox |
| 200 | duplicate (same id, same user) | remove from outbox |
| 401 | session gone | keep pending, prompt to sign in |
| 403 / 404 | vehicle not owned / deleted | mark `failed` |
| 409 | id exists for another user | mark `failed` |
| 422 | validation (e.g. `ODOMETER_OUT_OF_RANGE`) | mark `failed` with server error |
| 5xx / network | transient | keep pending, retry with backoff |

### 3.4 Sync triggers
iOS has no Background Sync API. Sync runs on: app start, `visibilitychange` → visible, `online` event, and right after enqueue. Single-flight (one sync loop at a time), entries sent in `createdAt` order.

### 3.5 Needs attention
`failed` outbox items are listed under Settings → Needs attention, with the server error. The user can edit-and-retry or discard. A badge on the sync indicator shows the count.

### 3.6 Service worker
- Serwist (`@serwist/next`). Verify Turbopack compatibility at scaffolding; fallback is a hand-written `public/sw.js` with the same behaviour.
- Precache: app shell assets, `/add`, `/offline`.
- Navigations: network-first, fall back to `/offline` (or cached `/add` for `/add`).
- `/add` is a static client page with no user data in its HTML; auth is enforced by the API.

## 4. Domain rules

### 4.1 Money & quantities
- Money as integer **kopecks** (`totalCost`, `pricePerUnit`). Currency stored per entry (`'UAH'`), not used for conversion in MVP.
- Litres as `numeric(8,3)`.
- Formatting: `Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })` → `1 234,56 ₴`.

### 4.2 Two-of-three fuel math
Inputs: litres `L`, price per litre `P`, total `T`. The two most recently edited fields are the sources; the third is derived and shown read-only.
- `T = round(L × P)` (kopecks)
- `P = round(T / L)` (kopecks)
- `L = round3(T / P)` (3 decimals)

All three are stored. Server validates `|round(L × P) − T| ≤ 100` kopecks (pump rounding tolerance) and that all are positive.

### 4.3 Odometer validation
For a vehicle, consider all fuel **and** service entries (excluding the entry being edited):
- `prev` = max odometer among entries with `date ≤ new.date`
- `next` = min odometer among entries with `date > new.date`
- Require `prev ≤ new.odometer ≤ next` (missing bounds ignored).

Violation → 422 `ODOMETER_OUT_OF_RANGE` with `{ min, max }`. Offline, the `/add` screen does a soft client-side check against the snapshot's `lastOdometer` (warn, don't block).

### 4.4 Consumption (full-to-full)
Fuel entries of one vehicle, sorted by `(date, odometer)`:
1. The first full fill is the baseline. Partial fills before it are ignored for consumption.
2. Accumulate litres of every entry after the baseline up to and including the next full fill `F`.
3. Segment consumption = `litres / (F.odometer − baseline.odometer) × 100`.
4. If any entry in the segment (including `F`) has `missedPrevious = true`, the segment is **invalid** (excluded).
5. `F` becomes the new baseline.
6. Lifetime average = `Σ valid litres / Σ valid km × 100`. Last = most recent valid segment.
7. Segments with 0 km are invalid.

## 5. Data model (Drizzle, Postgres 17)

Better Auth tables (`user`, `session`, `account`, `verification`, `passkey`) as generated by Better Auth.

```
vehicle
  id            uuid pk
  user_id       text fk → user.id, on delete cascade
  name          text not null
  make          text not null
  model         text not null
  year          int not null
  plate         text not null
  vin           text null
  default_grade text not null            -- fuel grade enum
  archived_at   timestamptz null
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
  index (user_id)

energy_entry
  id             uuid pk                 -- UUIDv7, client-generated
  user_id        text fk → user.id, on delete cascade
  vehicle_id     uuid fk → vehicle.id, on delete cascade
  date           timestamptz not null
  odometer       int not null
  quantity       numeric(8,3) not null
  unit           text not null default 'L'
  grade          text not null
  price_per_unit int not null            -- kopecks
  total_cost     int not null            -- kopecks
  currency       text not null default 'UAH'
  is_full        boolean not null default true
  missed_previous boolean not null default false
  station        text null
  note           text null
  created_at, updated_at
  index (vehicle_id, date)

service_entry
  id          uuid pk                    -- UUIDv7, client-generated
  user_id     text fk → user.id, on delete cascade
  vehicle_id  uuid fk → vehicle.id, on delete cascade
  date        timestamptz not null
  odometer    int not null
  category    text not null              -- service category enum
  total_cost  int not null               -- kopecks
  currency    text not null default 'UAH'
  garage      text null
  notes       text null
  created_at, updated_at
  index (vehicle_id, date)
```

Enums are TypeScript constants validated with Zod, stored as `text` (adding a value needs no migration).

## 6. Architecture

- **Next.js** (latest stable, App Router, TypeScript, Turbopack), **npm**.
- **UI:** Tailwind + shadcn/ui, shadcn charts (Recharts).
- **Auth:** Better Auth with email/password and passkey plugin. Passkey RP ID derived from `BETTER_AUTH_URL` (the permanent `*.vercel.app` domain). Route protection via middleware/proxy + server-side session check in every data access.
- **DB:** Drizzle ORM + `postgres` (postgres.js). Production: Neon **pooled** URL with `prepare: false`. Local: Docker Postgres 17.
- **Reads:** React Server Components querying via a data-access layer that always takes the session user.
- **Writes:** Route Handlers for outbox-backed creates; Server Actions for online-only edits/deletes/vehicle management.
- **Validation:** Zod schemas shared between client form and server.

### 6.1 Routes
```
/login, /register
/                     dashboard
/stats
/fuel, /fuel/[id]     list, edit
/service, /service/[id]
/vehicles, /vehicles/new, /vehicles/[id]
/add?kind=fuel|service   offline-capable
/settings             passkeys, sign out, needs attention
/offline              fallback
/api/auth/[...all]    Better Auth
/api/fuel-entries     POST
/api/service-entries  POST
/api/offline-snapshot GET
```

### 6.2 Project layout
```
src/
  app/
    (auth)/login, register
    (app)/…                      authenticated screens + shell
    add/                         offline-capable client page
    offline/
    api/…
    sw.ts                        Serwist service worker
    manifest.ts
  db/
    schema.ts, client.ts, seed.ts
  lib/
    auth.ts, auth-client.ts
    data/                        user-scoped queries & mutations
    domain/                      pure logic: fuel-math, consumption, odometer, money, enums
    offline/                     outbox, snapshot, sync loop (IndexedDB)
  components/
drizzle/                         migrations
docs/spec.md
docker-compose.yml
```

### 6.3 Environment
| Var | Local | Production |
|---|---|---|
| `DATABASE_URL` | Docker Postgres | Neon pooled URL |
| `DATABASE_URL_UNPOOLED` | Docker Postgres | Neon direct URL (migrations) |
| `BETTER_AUTH_SECRET` | random | random |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://<name>.vercel.app` |

## 7. PWA & branding
- Name **Carify**, placeholder icon (car / fuel drop), theme colour matches the app background in light/dark.
- `app/manifest.ts`, `display: standalone`, portrait.
- iOS splash screens and icons generated once with `pwa-asset-generator`.

## 8. Testing
Vitest unit tests for `lib/domain` and `lib/offline`:
- full-to-full consumption (partials, missed fills, zero-km, first-fill baseline)
- two-of-three fuel math (each derivation, rounding)
- odometer validation (bounds, same date, editing excludes self)
- outbox/sync (status transitions per response code, idempotent replay, single-flight)

No E2E tests in MVP.

## 9. Dev & deployment
- Git default branch `master`. GitHub + Vercel + Neon configured by the owner.
- Only `master` deploys; preview deployments disabled (`vercel.json` `git.deploymentEnabled` or project settings).
- Neon: single production branch.
- Local: `docker compose up -d` (Postgres 17), `npm run dev`.
- `npm run db:seed` — demo user + 2 vehicles + ~8 months of realistic UAH fuel/service data.
- Build: `drizzle-kit migrate && next build` (migrations use `DATABASE_URL_UNPOOLED`). Migrations must be additive only.
