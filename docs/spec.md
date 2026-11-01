# Carify — Specification

Status: agreed (2026-11-01). Scope: MVP + UI refresh (2026-11-01: colours, floating navbar, stats on the dashboard, stations, no offline mode).

Carify is a personal car tracker — fuel and service logs with consumption and cost stats — built as a Next.js PWA meant to be installed on an iPhone home screen.

## 1. Product decisions

| Topic | Decision |
|---|---|
| Users | Open registration, multi-tenant. Every row is owned by a `userId`; every query is scoped by it on the server. |
| Auth | Email + password, then optional passkeys (Face ID). Long rolling session (~1 year). No email sending: no verification, no password reset. |
| Vehicles | Multiple per user. Archive (soft) or hard delete (cascades entries). |
| Powertrain | Petrol/diesel only in MVP. Data model uses generic `quantity` + `unit` so kWh/LPG can be added later. |
| Locale | English UI, `uk-UA` number/date formatting via `Intl`, kilometres, L/100km, UAH. No i18n library. |
| Offline | None. Every screen needs a connection. Saving without one shows "No connection — try again" and keeps the form. |
| Out of scope | Reminders, notifications, export, import, receipt photos, non-fuel/service expenses, trips, EV/LPG. |

## 2. Features

### 2.1 Vehicles
Fields: `name`, `make`, `model`, `year`, `plate`, `vin?`, `defaultGrade`.
- Archive hides the vehicle from the switcher and lists; history is kept. Archived vehicles can be restored.
- Hard delete lives in a "danger zone" with typed confirmation; deletes all its entries.

### 2.2 Vehicle switcher
- Top bar on every app screen. Selection is persisted in a `vehicleId` cookie so server components can read it.
- All tabs (dashboard, fuel, service) show the selected vehicle.
- No vehicles yet → every app screen shows an empty state pointing to "Add vehicle".

### 2.3 Fuel log
Form fields:
- **Odometer** (int km, required, autofocused)
- **Date/time** (default now)
- **Litres / Price per litre / Total** — the user enters any two, the third is derived (see §4.2)
- **Grade** — defaults to the vehicle's `defaultGrade`
- **Full tank** (default on)
- **Missed previous fill** (default off)
- **Station** (optional): one-tap buttons `OKKO`, `Ukrnafta`, `UPG`, `WOG`, `Other`; tapping the selected one clears it. Preselected = the vehicle's most recent recorded station, following the vehicle select until the user picks one.
- **Note** (optional)

Vehicle preselected = the selected vehicle (cookie).

Fuel grades (code-level enum, easy to extend): `A92`, `A95`, `A95_PLUS`, `A98`, `DIESEL`, `DIESEL_PLUS`.

Gas stations (code-level enum): `OKKO`, `UKRNAFTA`, `UPG`, `WOG`, `OTHER` (labels `OKKO`, `Ukrnafta`, `UPG`, `WOG`, `Other`). Migration `0002` converted earlier free-text stations by case-insensitive name (`Укрнафта` → `UKRNAFTA`), anything else → `OTHER`.

### 2.4 Service log
Fields: date, odometer, category, total cost, garage (optional), notes (optional).
Categories: `OIL_CHANGE`, `BRAKES`, `TYRES`, `INSPECTION`, `REPAIR`, `OTHER`.

### 2.5 Editing & deleting
- Entries: edit and hard delete (with confirm). Online only.
- Vehicles: see §2.1. Online only.

### 2.6 Dashboard (selected vehicle)
Top to bottom (there is no separate stats page; `/stats` redirects to `/`):
1. **Hero card** (brand gradient): make, model, year, plate; current odometer (max across fuel + service, "—" if none); "Last fill-up <date> · <station> · <grade>".
2. **Stat tiles**: spend this month (fuel + service), average L/100km (lifetime), last L/100km.
3. **Consumption** — L/100km per valid segment over time.
4. **Price per litre** — one series per grade.
5. **By station** (§4.5).
6. **Monthly spend** — fuel vs service (stacked bars).
7. **Totals** — fuel, service, combined; cost per km `(total spend) / (max odometer − min odometer)`, hidden if distance is 0.

All stats are computed at read time; nothing derived is stored.

### 2.7 Navigation & shell
- Floating glass navbar (Instagram-like): a pill 16px from the screen edges, above the home indicator, translucent with backdrop blur and a thin border. Five icon-only tabs (each with an accessible label): **Dashboard · Fuel · [+] · Service · Vehicles**. The active tab sits on a lighter pill that slides between tabs, with its icon in the brand colour. The middle **+** is a brand-gradient circle that opens `/add` (fuel by default, Fuel/Service switch on the form). Page content is padded so the bar never covers it.
- Top bar: vehicle switcher, link to Settings.
- Settings: manage passkeys, sign out.
- iOS safe areas respected; light/dark follows system.

### 2.8 Look
- Brand: icon blue → sky gradient (`#1f5fc4 → #2a78d6 → #38b6f0`) on the hero card, the + button, selected station buttons and the active tab. Primary buttons are `#2a78d6`.
- Per-area tints for icon chips: fuel amber, service rose, money green, consumption teal (darker shades in light mode, brighter in dark).
- Tinted app background (`#f2f6fb` light, `#0a0e14` dark) with white / `#141a22` cards.
- Charts keep the validated categorical palette (`--chart-1..6`).

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

Violation → 422 `ODOMETER_OUT_OF_RANGE` with `{ min, max }`. The `/add` screen also does a soft client-side check against the vehicle's last odometer (warn, don't block).

### 4.4 Consumption (full-to-full)
Fuel entries of one vehicle, sorted by `(date, odometer)`:
1. The first full fill is the baseline. Partial fills before it are ignored for consumption.
2. Accumulate litres of every entry after the baseline up to and including the next full fill `F`.
3. Segment consumption = `litres / (F.odometer − baseline.odometer) × 100`.
4. If any entry in the segment (including `F`) has `missedPrevious = true`, the segment is **invalid** (excluded).
5. `F` becomes the new baseline.
6. Lifetime average = `Σ valid litres / Σ valid km × 100`. Last = most recent valid segment.
7. Segments with 0 km are invalid.

### 4.5 By-station comparison
- A segment's fuel is the full fill that **starts** it plus any partial fills before its end. A segment counts for a station only when all of those fills are from that station; mixed or station-less segments are skipped.
- Per station: average L/100km over its counted segments (`Σ litres / Σ km × 100`), average price per litre (litre-weighted over **all** its fills), cost per 100 km = L/100km × price, and the difference from the vehicle's cost per 100 km (lifetime L/100km × litre-weighted price over all fills) in %.
- Stations with fewer than **3** counted segments are listed greyed out with "Not enough data (n/3)" and no comparison.
- Sorted cheapest per 100 km first; the cheapest gets a "Best" badge when at least two stations have enough data. The difference shows as "−4% ▼" (green) / "+6% ▲" (rose), never colour alone.
- Note under the card: "Season and fuel grade affect these numbers."

### 4.6 Creating entries
- `/add` posts to Route Handlers `POST /api/fuel-entries` and `POST /api/service-entries` with a client-generated UUIDv7 id. The server inserts with `ON CONFLICT (id) DO NOTHING`, so a retry after a lost response is idempotent (the form keeps the same id until it succeeds).
- Responses: 201 created / 200 duplicate → back to the dashboard; 401 → sign in; 404 vehicle gone; 409 id used by another user (new id, try again); 422 `VALIDATION` or `ODOMETER_OUT_OF_RANGE` → field errors; network failure → "No connection — try again", form kept.

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
  station        text null               -- gas station enum
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
- **DB:** Drizzle ORM + `postgres` (postgres.js) with `prepare: false`. Production: Neon direct URL. Local: Docker Postgres 17.
- **Reads:** React Server Components querying via a data-access layer that always takes the session user.
- **Writes:** Route Handlers for creates (§4.6); Server Actions for edits/deletes/vehicle management.
- **Validation:** Zod schemas shared between client form and server.

### 6.1 Routes
```
/login, /register
/                     dashboard
/stats                redirects to /
/fuel, /fuel/[id]     list, edit
/service, /service/[id]
/vehicles, /vehicles/new, /vehicles/[id]
/add?kind=fuel|service
/settings             passkeys, sign out
/api/auth/[...all]    Better Auth
/api/fuel-entries     POST
/api/service-entries  POST
```

### 6.2 Project layout
```
src/
  app/
    (auth)/login, register
    (app)/…                      authenticated screens + shell
    api/…
    manifest.ts
  db/
    schema.ts, client.ts, seed.ts
  lib/
    auth.ts, auth-client.ts
    data/                        user-scoped queries & mutations
    domain/                      pure logic: fuel-math, consumption, station-stats, odometer, money, enums
  components/
drizzle/                         migrations
docs/spec.md
docker-compose.yml
```

### 6.3 Environment
| Var | Local | Production |
|---|---|---|
| `DATABASE_URL` | Docker Postgres (db tests use `<name>_test` on the same local server) | Neon **direct** (non-pooled) URL; also used for migrations |
| `BETTER_AUTH_SECRET` | random | random |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://<name>.vercel.app` |

## 7. PWA & branding
- Name **Carify**, icon: white drop on `#2a78d6`; theme colour matches the app background in light/dark.
- No service worker. On load the app unregisters any service worker, `carify-*` caches and the `carify` IndexedDB left by earlier builds.
- `app/manifest.ts`, `display: standalone`, portrait.
- iOS splash screens and icons generated once with `pwa-asset-generator`.

## 8. Testing
Vitest unit tests for `lib/domain`, plus DB integration tests for `lib/data` and the API routes:
- full-to-full consumption (partials, missed fills, zero-km, first-fill baseline)
- two-of-three fuel math (each derivation, rounding)
- odometer validation (bounds, same date, editing excludes self)
- station comparison (attribution, mixed segments, minimum segments, ranking)

No E2E tests in MVP.

## 9. Dev & deployment
- Git default branch `master`. GitHub + Vercel + Neon configured by the owner.
- Only `master` deploys; preview deployments disabled (`vercel.json` `git.deploymentEnabled` or project settings).
- Neon: single production branch.
- Local: `docker compose up -d` (Postgres 17), `npm run dev`.
- `npm run db:seed` — demo user + 2 vehicles + ~8 months of realistic UAH fuel/service data.
- Build: `drizzle-kit migrate && next build` (migrations use `DATABASE_URL`). Migrations must be additive only.
