# Carify MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Carify — a multi-user, iPhone-installable Next.js PWA for logging fuel and service entries per vehicle, with full-to-full consumption and cost stats, and offline creation of entries.

**Architecture:** Server-first Next.js App Router app. Pure domain logic (`src/lib/domain`) is framework-free and unit-tested; a user-scoped data layer (`src/lib/data`) wraps Drizzle/Postgres and is integration-tested against a Docker test database. Reads are React Server Components; online-only mutations are Server Actions; entry creation always goes through an IndexedDB outbox that replays to idempotent Route Handlers.

**Tech Stack:** Next.js (latest stable, App Router, TypeScript, Turbopack), npm, Tailwind + shadcn/ui (+ shadcn charts / Recharts), Better Auth (email/password + passkey), Drizzle ORM + postgres.js, Postgres 17 (Docker locally, Neon in prod), Zod, `idb`, `uuid` (v7), Serwist, Vitest + `fake-indexeddb`, `tsx`.

**Spec:** `docs/spec.md`

## Global Constraints

- Package manager **npm**; git default branch **`master`**; Node ≥ 22.
- Postgres **17** locally (`docker-compose.yml`), Neon in production via pooled `DATABASE_URL` with postgres.js `prepare: false`; migrations use `DATABASE_URL_UNPOOLED`.
- Every function in `src/lib/data` takes `userId: string` as its first parameter and filters every query by it. No exceptions.
- Money is integer **kopecks** everywhere in code and DB (`…Kop` suffix in TS names). Litres are `numeric(8,3)` in DB; postgres.js returns numeric as `string` — convert to `number` at the data-layer boundary, never leak strings upward.
- Display: English UI copy; numbers/dates via `Intl` with locale **`uk-UA`**; currency **UAH** (`1 234,56 ₴`); distance **km**; consumption **L/100km**.
- Calendar bucketing (month keys, "this month") uses time zone **`Europe/Kyiv`** (plan decision; spec is silent).
- Entry IDs are **UUIDv7** generated on the client (`import { v7 } from 'uuid'`).
- Queued creates go only through Route Handlers `POST /api/fuel-entries` and `POST /api/service-entries` — never Server Actions.
- Fuel grades: `A92`, `A95`, `A95_PLUS`, `A98`, `DIESEL`, `DIESEL_PLUS`. Service categories: `OIL_CHANGE`, `BRAKES`, `TYRES`, `INSPECTION`, `REPAIR`, `OTHER`. Stored as `text`, validated with Zod.
- Migrations are additive only.
- Not in MVP: reminders, notifications, export, import, photos, other expenses, trips, EV/LPG.

## Review Focus

1. **Cross-user access** — user B creating an entry on user A's vehicle, or reading/editing/deleting A's entry by id, must behave exactly like "not found". Pinned in Task 10 and Task 11.
2. **Comma decimals** — iOS `decimal` keypad with Ukrainian region types `45,5`; parsing must accept `,` and `.` and spaces as group separators. Pinned in Task 2.
3. **Month boundaries in Kyiv time** — an entry at `2026-03-31T21:30:00Z` is 00:30 on 1 April in Kyiv and must count toward April. Pinned in Task 6.
4. **Lost response after commit** — the server stored the entry but the phone never got the 201; the replay must get 200 and clear the item, never create a duplicate or a "Needs attention" item. Pinned in Task 11 and Task 18.
5. **Vehicle deleted while entries are queued** — replay gets 404 and the item lands in Needs attention with a readable message; the `/add` picker never offers archived vehicles. Pinned in Task 12 and Task 18.

---

## File Structure

```
docker-compose.yml, docker/init.sql        Postgres 17 + carify_test DB
drizzle.config.ts, drizzle/                migrations
vitest.config.ts, vitest.db-setup.ts       unit + db test projects
vercel.json, README.md
src/
  proxy.ts                                 auth redirect (cookie check only)
  db/schema.ts, db/auth-schema.ts, db/client.ts, db/seed.ts
  lib/domain/  enums.ts money.ts fuel-math.ts consumption.ts odometer.ts
               dates.ts stats.ts schemas.ts types.ts        (+ *.test.ts)
  lib/auth/    auth.ts auth-client.ts session.ts
  lib/data/    vehicles.ts entries.ts snapshot.ts overview.ts test-utils.ts (+ *.test.ts)
  lib/offline/ db.ts outbox.ts snapshot.ts sync.ts           (+ *.test.ts)
  lib/vehicle-selection.ts
  app/
    layout.tsx, manifest.ts, sw.ts, globals.css
    (auth)/login/page.tsx, (auth)/register/page.tsx
    (app)/layout.tsx, page.tsx, stats/, fuel/, service/, vehicles/, settings/
    add/page.tsx, offline/page.tsx
    api/auth/[...all]/route.ts, api/fuel-entries/route.ts,
    api/service-entries/route.ts, api/offline-snapshot/route.ts, api/_lib/responses.ts
  components/
    shell/  top-bar.tsx bottom-tabs.tsx fab.tsx vehicle-switcher.tsx sync-indicator.tsx
    forms/  fuel-fields.tsx use-fuel-math.ts service-fields.tsx vehicle-form.tsx
    sync/   sync-provider.tsx needs-attention.tsx
    charts/ consumption-chart.tsx price-chart.tsx monthly-spend-chart.tsx
```

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: Next.js app at repo root, `docker-compose.yml`, `docker/init.sql`, `.env.example`, `vitest.config.ts`, `src/lib/domain/smoke.test.ts`
- Modify: `package.json` scripts, `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `lint`, `test` (unit project), `test:db` (db project), `db:generate`, `db:migrate`, `db:seed`; path alias `@/*` → `src/*`.

- [ ] **Step 1:** `git init -b master`. Run `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack`. If it refuses because of `docs/`, scaffold into a temp dir and move the files in.
- [ ] **Step 2:** `npx shadcn@latest init` (neutral base colour, CSS variables). Add components: `button input label select switch card dialog alert-dialog sheet dropdown-menu sonner tabs badge chart`.
- [ ] **Step 3:** Write `docker-compose.yml`: service `db`, image `postgres:17`, env `POSTGRES_USER=carify POSTGRES_PASSWORD=carify POSTGRES_DB=carify`, port `5432:5432`, named volume, mount `docker/init.sql` into `/docker-entrypoint-initdb.d/`. `init.sql`: `CREATE DATABASE carify_test;`
- [ ] **Step 4:** `.env.example`:
  ```
  DATABASE_URL=postgres://carify:carify@localhost:5432/carify
  DATABASE_URL_UNPOOLED=postgres://carify:carify@localhost:5432/carify
  TEST_DATABASE_URL=postgres://carify:carify@localhost:5432/carify_test
  BETTER_AUTH_SECRET=change-me
  BETTER_AUTH_URL=http://localhost:3000
  ```
  Copy to `.env` (gitignored).
- [ ] **Step 5:** Install `vitest vite-tsconfig-paths fake-indexeddb tsx` (dev). `vitest.config.ts` with two projects: `unit` (include `src/lib/{domain,offline}/**/*.test.ts`, environment `node`) and `db` (include `src/lib/data/**/*.test.ts`, `src/app/api/**/*.test.ts`, `fileParallelism: false`, `setupFiles: ['vitest.db-setup.ts']` — file created in Task 8). Scripts: `"test": "vitest run --project unit"`, `"test:db": "vitest run --project db"`.
- [ ] **Step 6:** Write `src/lib/domain/smoke.test.ts` (`expect(1 + 1).toBe(2)`). Run `npm test` → 1 passed. Run `npm run build` → success. `docker compose up -d` → `docker compose exec db psql -U carify -l` lists `carify` and `carify_test`.
- [ ] **Step 7:** Delete the smoke test. Commit `chore: scaffold Next.js app, tooling, local Postgres`.

---

### Task 2: Domain — enums, money & number formatting

**Files:**
- Create: `src/lib/domain/enums.ts`, `src/lib/domain/money.ts`
- Test: `src/lib/domain/money.test.ts`

**Interfaces:**
- Produces:
  - `FUEL_GRADES: readonly FuelGrade[]`, `type FuelGrade`, `FUEL_GRADE_LABELS: Record<FuelGrade, string>` = `A-92, A-95, A-95+, A-98, Diesel, Diesel+`
  - `SERVICE_CATEGORIES`, `type ServiceCategory`, `SERVICE_CATEGORY_LABELS` = `Oil change, Brakes, Tyres, Inspection, Repair, Other`
  - `formatUah(kop: number): string`
  - `formatNumber(n: number, fractionDigits: number): string`
  - `formatKm(km: number): string` → `"123 456 km"`
  - `formatConsumption(lPer100: number): string` → `"7,4 L/100km"` (1 decimal)
  - `parseDecimal(input: string): number | null`
  - `uahToKop(uah: number): number` (`Math.round(uah * 100)`)

- [ ] **Step 1: Write failing tests** (normalise all whitespace with `.replace(/\s/g, ' ')` before comparing — `uk-UA` uses non-breaking spaces):
  ```ts
  formatUah(123456)        → '1 234,56 ₴'
  formatUah(0)             → '0,00 ₴'
  formatKm(123456)         → '123 456 km'
  formatConsumption(7.3611)→ '7,4 L/100km'
  parseDecimal('45,5')     → 45.5
  parseDecimal('45.5')     → 45.5
  parseDecimal(' 1 234,5 ')→ 1234.5
  parseDecimal('1 234,5') → 1234.5
  parseDecimal('')         → null
  parseDecimal('abc')      → null
  parseDecimal('1,2,3')    → null
  parseDecimal('-5')       → null      // nothing in the app is negative
  uahToKop(58.99)          → 5899
  ```
- [ ] **Step 2:** `npm test` → fails (module not found).
- [ ] **Step 3:** Implement. `parseDecimal`: strip all whitespace, replace a single `,` with `.`, accept only `/^\d+(\.\d+)?$/`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `feat(domain): enums and uk-UA money/number formatting`.

---

### Task 3: Domain — two-of-three fuel math

**Files:**
- Create: `src/lib/domain/fuel-math.ts`
- Test: `src/lib/domain/fuel-math.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type FuelField = 'litres' | 'pricePerLitreKop' | 'totalKop'
  type FuelValues = { litres: number; pricePerLitreKop: number; totalKop: number }
  type PartialFuel = Partial<FuelValues>
  const DEFAULT_SOURCES: [FuelField, FuelField] = ['litres', 'pricePerLitreKop']
  function nextSources(prev: [FuelField, FuelField], edited: FuelField): [FuelField, FuelField]
  function derivedField(sources: [FuelField, FuelField]): FuelField
  function deriveFuel(values: PartialFuel, sources: [FuelField, FuelField]): FuelValues | null
  function isFuelConsistent(v: FuelValues): boolean
  const FUEL_TOLERANCE_KOP = 100
  ```

- [ ] **Step 1: Write failing tests:**
  ```ts
  nextSources(['litres','totalKop'], 'pricePerLitreKop') → ['pricePerLitreKop','litres']
  nextSources(['litres','totalKop'], 'totalKop')         → ['totalKop','litres']
  nextSources(['litres','totalKop'], 'litres')           → ['litres','totalKop']
  derivedField(['litres','pricePerLitreKop'])            → 'totalKop'
  deriveFuel({litres: 40, pricePerLitreKop: 5899}, ['litres','pricePerLitreKop'])
      → {litres: 40, pricePerLitreKop: 5899, totalKop: 235960}
  deriveFuel({totalKop: 235960, pricePerLitreKop: 5899}, ['totalKop','pricePerLitreKop'])
      → {litres: 40, …}
  deriveFuel({litres: 40, totalKop: 235960}, ['litres','totalKop'])
      → {pricePerLitreKop: 5899, …}
  deriveFuel({totalKop: 100000, pricePerLitreKop: 5899}, ['totalKop','pricePerLitreKop'])
      → litres 16.952            // rounded to 3 decimals
  deriveFuel({litres: 40}, ['litres','pricePerLitreKop'])          → null
  deriveFuel({litres: 0, pricePerLitreKop: 5899}, DEFAULT_SOURCES) → null
  isFuelConsistent({litres: 40, pricePerLitreKop: 5899, totalKop: 236060}) → true   // diff 100
  isFuelConsistent({litres: 40, pricePerLitreKop: 5899, totalKop: 236061}) → false
  ```
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement. Derivations exactly as spec §4.2: `T = round(L×P)`, `P = round(T/L)`, `L = round3(T/P)`. The derived field's input value is ignored.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(domain): two-of-three fuel math`.

---

### Task 4: Domain — full-to-full consumption

**Files:**
- Create: `src/lib/domain/consumption.ts`
- Test: `src/lib/domain/consumption.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ConsumptionEntry = { id: string; date: Date; odometer: number; litres: number; isFull: boolean; missedPrevious: boolean }
  type Segment = { endEntryId: string; endDate: Date; startOdometer: number; endOdometer: number; km: number; litres: number; lPer100: number | null; valid: boolean }
  function computeSegments(entries: ConsumptionEntry[]): Segment[]   // chronological
  function summarizeConsumption(segments: Segment[]): { lifetime: number | null; last: number | null }
  ```

- [ ] **Step 1: Write failing tests** (helper `e(odo, litres, opts?)` builds entries with increasing dates):
  - `two full fills`: full 10000/40L, full 10500/35L → one segment `{km: 500, litres: 35, lPer100: 7, valid: true}`
  - `partials accumulate`: full 10000, partial 10200/15L, full 10600/25L → `{km: 600, litres: 40}`, `lPer100 ≈ 6.667`
  - `leading partial ignored`: partial 9800/10L, full 10000/40L, full 10500/35L → exactly one segment, `lPer100 = 7`
  - `missed fill invalidates segment and resets baseline`: full 10000, full 10500/35L `missedPrevious`, full 11000/30L → segments `[invalid, {startOdometer: 10500, lPer100: 6, valid: true}]`
  - `missed flag on a partial inside the segment invalidates it`
  - `zero km is invalid`: full 10000, full 10000/5L → `valid: false, lPer100: null`
  - `unsorted input is sorted by (date, odometer)`
  - `no full fill` → `[]`, summary `{lifetime: null, last: null}`
  - `lifetime is distance-weighted`: segments 35L/500km and 60L/1000km → lifetime `6.333…` (not 6.5), last `6`
  - `last skips trailing invalid segment` → last = most recent *valid* segment
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement per spec §4.4.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(domain): full-to-full consumption`.

---

### Task 5: Domain — odometer bounds

**Files:**
- Create: `src/lib/domain/odometer.ts`
- Test: `src/lib/domain/odometer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type OdometerPoint = { id: string; date: Date; odometer: number }
  type OdometerCheck = { ok: true } | { ok: false; min: number | null; max: number | null }
  function odometerBounds(points: OdometerPoint[], date: Date, excludeId?: string): { min: number | null; max: number | null }
  function checkOdometer(points: OdometerPoint[], candidate: { id?: string; date: Date; odometer: number }): OdometerCheck
  ```

- [ ] **Step 1: Write failing tests** (points `a = (Jan 1, 1000)`, `b = (Feb 1, 2000)`):
  - between: date Jan 15 → bounds `{min: 1000, max: 2000}`; 1500 ok; 999 → `{ok:false, min:1000, max:2000}`; 2001 fails
  - equal to bounds allowed: 1000 and 2000 ok
  - same timestamp as `a` → `a` counts as previous (`≤`): min 1000
  - after all points → `max: null`; before all → `min: null`; empty → both null, any value ok
  - editing excludes self: points include `{id:'c', Jan 15, 1500}`; `checkOdometer(points, {id:'c', date: Jan 15, odometer: 1800})` → ok
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement per spec §4.3.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(domain): odometer bounds`.

---

### Task 6: Domain — dates & stats aggregations

**Files:**
- Create: `src/lib/domain/dates.ts`, `src/lib/domain/stats.ts`
- Test: `src/lib/domain/dates.test.ts`, `src/lib/domain/stats.test.ts`

**Interfaces:**
- Produces:
  ```ts
  const APP_TIME_ZONE = 'Europe/Kyiv'
  function monthKey(date: Date, tz?: string): string                 // 'YYYY-MM'
  function formatDate(date: Date): string                           // uk-UA, Kyiv tz, e.g. '01.11.2026'
  type SpendItem = { date: Date; totalKop: number; kind: 'fuel' | 'service' }
  type MonthlySpend = { month: string; fuelKop: number; serviceKop: number }
  function monthlySpend(items: SpendItem[]): MonthlySpend[]          // ascending, contiguous, zero-filled
  function spendTotals(items: SpendItem[]): { fuelKop: number; serviceKop: number; totalKop: number }
  function spendInMonth(items: SpendItem[], month: string): number
  type PricePoint = { date: Date; pricePerLitreKop: number }
  function pricePerLitreSeries(entries: (PricePoint & { grade: FuelGrade })[]): Partial<Record<FuelGrade, PricePoint[]>>
  function currentOdometer(odometers: number[]): number | null
  function costPerKm(totalKop: number, odometers: number[]): number | null   // kopecks per km
  ```

- [ ] **Step 1: Write failing tests:**
  - `monthKey(new Date('2026-03-31T21:30:00Z'))` → `'2026-04'` (Kyiv UTC+3 after 29 Mar DST)
  - `monthKey(new Date('2026-01-31T22:30:00Z'))` → `'2026-02'` (UTC+2)
  - `monthKey(new Date('2026-01-31T21:59:00Z'))` → `'2026-01'`
  - `monthlySpend`: fuel in Jan and Mar, service in Mar → 3 rows, Feb `{fuelKop: 0, serviceKop: 0}`; `[]` → `[]`
  - `spendTotals` sums by kind
  - `pricePerLitreSeries` groups by grade, each series sorted by date
  - `currentOdometer([])` → null; `([1000, 5000, 3000])` → 5000
  - `costPerKm(150000, [10000, 11000])` → 150; `(150000, [10000])` → null; `(150000, [10000, 10000])` → null
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement. `monthKey` via `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' })`.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(domain): Kyiv month bucketing and stats aggregations`.

---

### Task 7: Domain — Zod input schemas & shared types

**Files:**
- Create: `src/lib/domain/schemas.ts`, `src/lib/domain/types.ts`
- Test: `src/lib/domain/schemas.test.ts`

**Interfaces:**
- Consumes: enums (Task 2), `isFuelConsistent` (Task 3).
- Produces:
  ```ts
  vehicleInputSchema       → VehicleInput   { name, make, model, year, plate, vin: string | null, defaultGrade }
  fuelEntryInputSchema     → FuelEntryInput { id, vehicleId, date: Date, odometer, litres, pricePerLitreKop, totalKop, grade, isFull, missedPrevious, station: string | null, note: string | null }
  serviceEntryInputSchema  → ServiceEntryInput { id, vehicleId, date: Date, odometer, category, totalKop, garage: string | null, notes: string | null }
  fuelEntryUpdateSchema = fuelEntryInputSchema.omit({ id: true, vehicleId: true }) → FuelEntryUpdate
  serviceEntryUpdateSchema (same omit)                                              → ServiceEntryUpdate
  // types.ts
  type Vehicle = VehicleInput & { id: string; archivedAt: Date | null; createdAt: Date }
  type FuelEntry = Omit<FuelEntryInput,'…'> & { id; vehicleId; currency: 'UAH' }    (fully spelled out in file)
  type ServiceEntry = …
  type SnapshotVehicle = { id: string; name: string; defaultGrade: FuelGrade; lastOdometer: number | null }
  ```
  Rules: `name` 1–60, `make`/`model` 1–40, `year` int 1950..(current year + 1), `plate` 1–15 trimmed uppercased, `vin` empty → null else exactly 17 chars `[A-HJ-NPR-Z0-9]` uppercased; `id`/`vehicleId` uuid; `date` `z.coerce.date()`; `odometer` int 0..2,000,000; `litres` > 0 and ≤ 99999.999; fuel money ints > 0; service `totalKop` int ≥ 0 (warranty work); `station`/`garage` ≤ 100, `note`/`notes` ≤ 500, empty string → null. Fuel schema `.superRefine` adds issue `{ path: ['totalKop'], message: 'TOTAL_MISMATCH' }` when `!isFuelConsistent`.

- [ ] **Step 1: Write failing tests:** valid fuel payload with ISO date string parses to `Date`; `totalKop` off by 101 → issue `TOTAL_MISMATCH`; `litres: 0` rejected; `vin: ''` → `null`; `vin: 'wvwzzz1kzaw000001'` → uppercased; VIN with `O` rejected; service `totalKop: 0` accepted; `plate: ' aa1234bb '` → `'AA1234BB'`.
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(domain): input schemas and shared types`.

---

### Task 8: Database — schema, client, migrations, test harness

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `vitest.db-setup.ts`, `src/lib/data/test-utils.ts`, `drizzle/*`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `db` (Drizzle instance) and tables `vehicle`, `energyEntry`, `serviceEntry` exactly as spec §5, plus Better Auth core tables in `src/db/auth-schema.ts` (generated here from a minimal `src/lib/auth/auth.ts` — email/password + Drizzle adapter only — so `user.id` exists for FKs; Task 9 adds the passkey plugin and regenerates).
  - `test-utils.ts`: `resetDb(): Promise<void>` (TRUNCATE all app + auth tables CASCADE), `createTestUser(email?: string): Promise<{ id: string }>` (direct insert into `user`).
- Constraints: `client.ts` uses `postgres(process.env.DATABASE_URL!, { prepare: false })`; in test runs `DATABASE_URL` is set to `TEST_DATABASE_URL` by the setup file. Reuse a single client via `globalThis` in dev to survive HMR. `drizzle.config.ts` uses `DATABASE_URL_UNPOOLED ?? DATABASE_URL`.

- [ ] **Step 1:** Install `drizzle-orm postgres better-auth` and `drizzle-kit` (dev). Write the minimal `auth.ts`, generate `src/db/auth-schema.ts` with the Better Auth CLI, re-export it from `schema.ts`. Write app tables with FKs `onDelete: 'cascade'` and indexes `(user_id)` on vehicle and `(vehicle_id, date)` on both entry tables.
- [ ] **Step 2:** Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`. Run `npm run db:generate` then `npm run db:migrate` → succeeds; `psql … -c '\d energy_entry'` shows `quantity numeric(8,3)`.
- [ ] **Step 3:** `vitest.db-setup.ts`: load `.env`, set `process.env.DATABASE_URL = process.env.TEST_DATABASE_URL`, run Drizzle `migrate()` once against the test DB (guard with a module-level flag).
- [ ] **Step 4:** Write `src/lib/data/schema.test.ts`: inserting an `energy_entry` with `quantity: '40.125'` reads back `'40.125'`; deleting a vehicle cascades to its entries.
- [ ] **Step 5:** `npm run test:db` → pass.
- [ ] **Step 6:** Commit `feat(db): schema, client, migrations, db test harness`.

---

### Task 9: Auth — Better Auth, session helpers, proxy, login/register

**Files:**
- Create: `src/lib/auth/auth-client.ts`, `src/lib/auth/session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- Modify: `src/lib/auth/auth.ts` (full config), `src/db/auth-schema.ts` (regenerated with passkey table), new migration

**Interfaces:**
- Produces:
  - `auth` (server instance), `authClient` (React client with passkey plugin)
  - `getSessionUser(): Promise<{ id: string; email: string; name: string } | null>` — reads `headers()`
  - `requireUser(): Promise<{ id; email; name }>` — `redirect('/login')` when null
- Config: `emailAndPassword: { enabled: true, minPasswordLength: 8 }`, no email verification, session `expiresIn: 60*60*24*365`, `updateAge: 60*60*24`; passkey plugin (`@better-auth/passkey` or `better-auth/plugins/passkey`, whichever the installed version ships) with `rpID` = hostname of `BETTER_AUTH_URL`, `rpName: 'Carify'`, `origin: BETTER_AUTH_URL`. Drizzle adapter, provider `pg`.
- Proxy: if no Better Auth session cookie (`getSessionCookie`) → redirect to `/login`. Matcher **excludes** `/login`, `/register`, `/add`, `/offline`, `/api`, `/_next`, `/sw.js`, `/manifest.webmanifest`, `/icons`, `/splash`, favicon. (`/add` must stay statically cacheable by the service worker — Task 20.) If the installed Next.js predates 16, name the file `middleware.ts`.

- [ ] **Step 1:** Install the passkey plugin package if separate from `better-auth`. Complete `auth.ts`, regenerate `src/db/auth-schema.ts` with the Better Auth CLI; `npm run db:generate && npm run db:migrate`.
- [ ] **Step 2:** Implement auth, route handler, session helpers, proxy.
- [ ] **Step 3:** Pages. Register: name, email, password → `authClient.signUp.email`, then `/`. Login: email/password + **"Sign in with passkey"** button (`authClient.signIn.passkey()`), link to register. Errors shown inline. Mobile layout, `autocomplete` attributes (`email`, `current-password`, `new-password`, `webauthn` on the email field).
- [ ] **Step 4: Verify manually** with `npm run dev`: `/` redirects to `/login`; register → lands on `/`; reload keeps session; sign out (temporary button) → `/login`; `/add` does **not** redirect.
- [ ] **Step 5:** `npm run build && npm run lint` → clean. Commit `feat(auth): email/password + passkey auth, route protection`.

---

### Task 10: Data layer — vehicles

**Files:**
- Create: `src/lib/data/vehicles.ts`
- Test: `src/lib/data/vehicles.test.ts`

**Interfaces:**
- Consumes: `db`, schema (Task 8); `VehicleInput`, `Vehicle` (Task 7).
- Produces:
  ```ts
  listVehicles(userId: string, opts?: { includeArchived?: boolean }): Promise<Vehicle[]>   // by createdAt asc
  getVehicle(userId: string, id: string): Promise<Vehicle | null>
  createVehicle(userId: string, input: VehicleInput): Promise<Vehicle>
  updateVehicle(userId: string, id: string, input: VehicleInput): Promise<Vehicle | null>
  setVehicleArchived(userId: string, id: string, archived: boolean): Promise<boolean>
  deleteVehicle(userId: string, id: string): Promise<boolean>
  ```

- [ ] **Step 1: Write failing tests** (users A and B via `createTestUser`, `resetDb()` in `beforeEach`):
  - create + list returns the vehicle; archived hidden by default, included with `includeArchived`
  - **cross-user**: B's `getVehicle`, `updateVehicle`, `setVehicleArchived`, `deleteVehicle` on A's vehicle → `null` / `false`, and A's vehicle is unchanged
  - `deleteVehicle` removes the vehicle's entries (cascade)
- [ ] **Step 2:** `npm run test:db` → fails.
- [ ] **Step 3:** Implement; every `where` includes `eq(vehicle.userId, userId)`.
- [ ] **Step 4:** `npm run test:db` → pass.
- [ ] **Step 5:** Commit `feat(data): user-scoped vehicles`.

---

### Task 11: Data layer — fuel & service entries

**Files:**
- Create: `src/lib/data/entries.ts`
- Test: `src/lib/data/entries.test.ts`

**Interfaces:**
- Consumes: `checkOdometer`, `OdometerPoint` (Task 5); input schemas/types (Task 7); `getVehicle` (Task 10).
- Produces:
  ```ts
  type CreateResult =
    | { status: 'created' } | { status: 'duplicate' } | { status: 'conflict' }
    | { status: 'vehicle_not_found' }
    | { status: 'odometer_out_of_range'; min: number | null; max: number | null }
  type UpdateResult =
    | { status: 'updated' } | { status: 'not_found' }
    | { status: 'odometer_out_of_range'; min: number | null; max: number | null }
  createFuelEntry(userId, input: FuelEntryInput): Promise<CreateResult>
  createServiceEntry(userId, input: ServiceEntryInput): Promise<CreateResult>
  updateFuelEntry(userId, id, input: FuelEntryUpdate): Promise<UpdateResult>
  updateServiceEntry(userId, id, input: ServiceEntryUpdate): Promise<UpdateResult>
  deleteFuelEntry(userId, id): Promise<boolean>
  deleteServiceEntry(userId, id): Promise<boolean>
  getFuelEntry(userId, id): Promise<FuelEntry | null>
  getServiceEntry(userId, id): Promise<ServiceEntry | null>
  listFuelEntries(userId, vehicleId): Promise<FuelEntry[]>          // date desc
  listServiceEntries(userId, vehicleId): Promise<ServiceEntry[]>    // date desc
  listOdometerPoints(userId, vehicleId): Promise<OdometerPoint[]>   // fuel ∪ service
  ```
- Create algorithm (one transaction): if a row with `input.id` already exists in **either** entry table → `duplicate` if its `userId` matches, else `conflict` (checked before the vehicle and odometer checks, so a replay of an already-stored entry always gets `duplicate`). Else vehicle not owned → `vehicle_not_found`. Else `checkOdometer` against `listOdometerPoints` → `odometer_out_of_range`. Else insert. Archived vehicles accept entries.

- [ ] **Step 1: Write failing tests:**
  - create fuel → `created`; list returns it with `litres` as `number` (not string)
  - **replay same payload → `duplicate`**, row count still 1
  - **replay after a newer entry made the odometer invalid → still `duplicate`** (lost-response case)
  - same id by user B → `conflict`
  - **B creating on A's vehicle → `vehicle_not_found`**
  - odometer 900 when an earlier entry has 1000 → `{status:'odometer_out_of_range', min: 1000, max: null}`; service entries count as odometer points for fuel and vice versa
  - update moving odometer within bounds → `updated`; editing excludes itself from bounds
  - **B updating/deleting/getting A's entry → `not_found` / `false` / `null`**
- [ ] **Step 2:** `npm run test:db` → fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run test:db` → pass.
- [ ] **Step 5:** Commit `feat(data): idempotent, user-scoped fuel and service entries`.

---

### Task 12: API route handlers

**Files:**
- Create: `src/app/api/_lib/responses.ts`, `src/app/api/fuel-entries/route.ts`, `src/app/api/service-entries/route.ts`, `src/app/api/offline-snapshot/route.ts`, `src/lib/data/snapshot.ts`
- Test: `src/app/api/entries.test.ts`, `src/lib/data/snapshot.test.ts`

**Interfaces:**
- Consumes: `getSessionUser` (Task 9), `createFuelEntry`/`createServiceEntry` (Task 11), schemas (Task 7).
- Produces:
  - `getOfflineSnapshot(userId): Promise<SnapshotVehicle[]>` — non-archived vehicles only, `lastOdometer` = max across both entry tables
  - `toCreateResponse(result: CreateResult): Response`
  - HTTP contract (consumed by Task 18):

    | Case | Status | Body |
    |---|---|---|
    | no session | 401 | `{ error: 'UNAUTHENTICATED' }` |
    | invalid JSON / schema | 422 | `{ error: 'VALIDATION', issues }` |
    | created | 201 | `{ ok: true }` |
    | duplicate | 200 | `{ ok: true, duplicate: true }` |
    | conflict | 409 | `{ error: 'ID_CONFLICT' }` |
    | vehicle_not_found | 404 | `{ error: 'VEHICLE_NOT_FOUND' }` |
    | odometer | 422 | `{ error: 'ODOMETER_OUT_OF_RANGE', min, max }` |
    | snapshot | 200 | `{ vehicles: SnapshotVehicle[] }` |

- [ ] **Step 1: Write failing tests** — `vi.mock('@/lib/auth/session')` to control `getSessionUser`; call exported `POST`/`GET` with `new Request(...)`: one test per table row; snapshot excludes an archived vehicle and reports `lastOdometer` from a service entry when it is the highest.
- [ ] **Step 2:** `npm run test:db` → fails.
- [ ] **Step 3:** Implement. Route handlers set `export const dynamic = 'force-dynamic'`.
- [ ] **Step 4:** `npm run test:db` → pass.
- [ ] **Step 5:** Commit `feat(api): idempotent entry endpoints and offline snapshot`.

---

### Task 13: Seed script

**Files:**
- Create: `src/db/seed.ts`
- Modify: `package.json` (`"db:seed": "tsx --env-file=.env src/db/seed.ts"`)

**Interfaces:**
- Consumes: `auth.api.signUpEmail`, `createVehicle`, `createFuelEntry`, `createServiceEntry`.

- [ ] **Step 1:** Implement. Refuses to run unless `DATABASE_URL` host is `localhost`/`127.0.0.1` (exit 1 with message). Deletes existing user `demo@carify.local`, recreates with password `demo-password`, name `Demo`. Vehicles: `Golf` (Volkswagen Golf 2017, `AA1234BB`, `A95`) and `Octavia` (Skoda Octavia 2015, `KA5678CE`, `DIESEL`). For each, ~8 months back to now: fill every 450–700 km, ~85 % full fills, one `missedPrevious`, price drifting 52→60 ₴/L, total derived via `deriveFuel`; 4 service entries (oil change, tyres, brakes, inspection). Deterministic PRNG (fixed seed) so runs are reproducible. Insert through the data layer so all rules apply.
- [ ] **Step 2:** `npm run db:seed` twice → both succeed; `psql` shows 1 demo user, 2 vehicles, ≥ 40 energy entries.
- [ ] **Step 3:** Commit `chore(db): deterministic demo seed`.

---

### Task 14: App shell & vehicle selection

**Files:**
- Create: `src/lib/vehicle-selection.ts`, `src/app/(app)/layout.tsx`, `src/components/shell/{top-bar,bottom-tabs,fab,vehicle-switcher}.tsx`, `src/app/(app)/settings/page.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces:
  - `getSelectedVehicle(userId: string): Promise<Vehicle | null>` — `vehicleId` cookie if it names an owned, non-archived vehicle, else first non-archived vehicle, else `null`
  - `selectVehicleAction(vehicleId: string): Promise<void>` (Server Action; sets cookie, 1 year, `sameSite: 'lax'`, then `revalidatePath('/', 'layout')`)
  - `<EmptyVehicles />` — empty state linking to `/vehicles/new`, used by every vehicle-scoped page when `getSelectedVehicle` is null

- [ ] **Step 1:** Root layout: `viewport` with `viewportFit: 'cover'` and light/dark `themeColor`; `appleWebApp: { capable: true, title: 'Carify', statusBarStyle: 'black-translucent' }`; dark mode via `prefers-color-scheme` (shadcn CSS vars under `@media`), Sonner toaster.
- [ ] **Step 2:** `(app)/layout.tsx`: `requireUser()`; top bar (vehicle switcher dropdown, placeholder slot for the sync indicator from Task 19, settings link); bottom tabs Dashboard `/` · Fuel `/fuel` · Service `/service` · Vehicles `/vehicles`, active state from pathname; FAB → `/add?kind=fuel`. Padding uses `env(safe-area-inset-*)`.
- [ ] **Step 3:** Settings page: sign out button. (Passkeys and Needs attention are added in Tasks 15 and 19.)
- [ ] **Step 4: Verify** with seeded data (`demo@carify.local`): switcher lists Golf and Octavia, switching persists across reload; tabs navigate; layout correct at 390×844 in Chrome device mode, light and dark; FAB clear of home indicator.
- [ ] **Step 5:** `npm run build && npm run lint` → clean. Commit `feat(ui): app shell, tabs, vehicle switcher`.

---

### Task 15: Vehicles screens & passkey management

**Files:**
- Create: `src/components/forms/vehicle-form.tsx`, `src/app/(app)/vehicles/{page.tsx,new/page.tsx,[id]/page.tsx,actions.ts}`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: Task 10 data functions, `vehicleInputSchema`.
- Produces Server Actions in `vehicles/actions.ts`: `createVehicleAction`, `updateVehicleAction(id)`, `setArchivedAction(id, archived)`, `deleteVehicleAction(id, confirmName)` — each calls `requireUser()`, validates with Zod, returns `{ ok: true } | { ok: false; fieldErrors?; error? }`.

- [ ] **Step 1:** Vehicles list: active vehicles, then a collapsed "Archived" section with Restore. New/edit page uses `VehicleForm` (grade select uses `FUEL_GRADE_LABELS`). Edit page has Archive and a "Danger zone" card: delete requires typing the vehicle name exactly (`deleteVehicleAction` re-checks server-side); after delete, clear the cookie if it pointed to that vehicle.
- [ ] **Step 2:** Settings: list passkeys (`authClient.passkey.listUserPasskeys`), "Add passkey" (`authClient.passkey.addPasskey()`), delete passkey.
- [ ] **Step 3: Verify manually:** create, edit, archive (disappears from switcher), restore, delete with wrong name rejected and right name accepted; add a passkey in Chrome (virtual authenticator in DevTools → WebAuthn) and sign in with it.
- [ ] **Step 4:** `npm run build && npm run lint` → clean. Commit `feat(ui): vehicle management and passkeys`.

---

### Task 16: Fuel & service lists and edit pages

**Files:**
- Create: `src/components/forms/use-fuel-math.ts`, `src/components/forms/fuel-fields.tsx`, `src/components/forms/service-fields.tsx`, `src/app/(app)/fuel/{page.tsx,[id]/page.tsx,actions.ts}`, `src/app/(app)/service/{page.tsx,[id]/page.tsx,actions.ts}`

**Interfaces:**
- Consumes: Task 3 (`nextSources`, `deriveFuel`, `derivedField`, `DEFAULT_SOURCES`), Task 2 (`parseDecimal`, `uahToKop`), Task 11.
- Produces (reused by `/add` in Task 19):
  - `useFuelMath(initial?: FuelValues)` → `{ inputs: Record<FuelField, string>; derived: FuelField; values: FuelValues | null; onChange(field: FuelField, raw: string): void }` — display strings in UAH/litres, values in kop/litres
  - `<FuelFields vehicles defaultValues errors />`, `<ServiceFields … />` — controlled field groups without submit logic. Numeric inputs use `inputMode="decimal"` (odometer `inputMode="numeric"`); date uses `datetime-local`.
  - Server Actions `updateFuelEntryAction(id, data)`, `deleteFuelEntryAction(id)` (+ service equivalents) returning `{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'ODOMETER_OUT_OF_RANGE' | 'VALIDATION'; min?; max?; fieldErrors? }`

- [ ] **Step 1:** Lists for the selected vehicle, newest first. Fuel row: date, odometer, litres, total, grade, "Partial" badge when not full. Service row: date, odometer, category, total, garage. Rows link to edit pages. Empty state with "Add" button.
- [ ] **Step 2:** Edit pages with the shared fields, Save, Delete (AlertDialog). `ODOMETER_OUT_OF_RANGE` shown under the odometer field as "Must be between {min} and {max} km" (omit the missing side). The derived field is visibly read-only.
- [ ] **Step 3: Verify manually** on seeded data: typing `45,5` litres and `58,99` price derives total `2 684,05 ₴`; then editing total derives price (litres stays a source); edit an odometer out of range → inline error; delete removes from list.
- [ ] **Step 4:** `npm run build && npm run lint` → clean. Commit `feat(ui): fuel and service lists and editing`.

---

### Task 17: Dashboard & stats

**Files:**
- Create: `src/lib/data/overview.ts`, `src/app/(app)/page.tsx`, `src/app/(app)/stats/page.tsx`, `src/components/charts/{consumption-chart,price-chart,monthly-spend-chart}.tsx`
- Test: `src/lib/data/overview.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 6, 11.
- Produces:
  ```ts
  type RecentEntry = { kind: 'fuel' | 'service'; id: string; date: Date; odometer: number; totalKop: number; label: string }
  getVehicleOverview(userId, vehicleId, now: Date): Promise<{
    currentOdometer: number | null; consumption: { lifetime: number | null; last: number | null };
    spendThisMonthKop: number; recent: RecentEntry[] /* 5, newest first */ }>
  getVehicleStats(userId, vehicleId): Promise<{
    segments: Segment[]; consumption: { lifetime; last }; pricePerLitre: Partial<Record<FuelGrade, PricePoint[]>>;
    monthly: MonthlySpend[]; totals: { fuelKop; serviceKop; totalKop }; costPerKmKop: number | null }>
  ```
  Fuel `label` = `"{litres} L {grade label}"`; service `label` = category label.

- [ ] **Step 1: Write failing test** (db project): seed 3 fuel (two full + partial) and 1 service for one vehicle, `now` inside the latest month → overview `recent.length === 4` mixing kinds by date; `spendThisMonthKop` counts only that Kyiv month; `consumption.lifetime` matches hand-computed value; stats `costPerKmKop` = total / (max − min odometer).
- [ ] **Step 2:** `npm run test:db` → fails. **Step 3:** Implement as compositions of the pure functions. **Step 4:** → pass.
- [ ] **Step 5:** Dashboard cards: current odometer, avg / last L/100km ("—" when null), this month spend, recent entries (link to edit pages), "Stats →". Stats page: the six items from spec §2.7 — consumption line (valid segments only, x = `endDate`), price-per-litre lines per grade, stacked monthly bars (fuel vs service), cost per km (hidden when null), totals. Charts via shadcn `ChartContainer`; month labels `MM.YYYY`.
- [ ] **Step 6: Verify manually** with seed data: numbers plausible (~6–9 L/100km), charts render in light and dark, empty vehicle shows empty states instead of broken charts.
- [ ] **Step 7:** `npm run build && npm run lint` → clean. Commit `feat(ui): dashboard and stats`.

---

### Task 18: Offline core — IndexedDB, outbox, snapshot, sync

**Files:**
- Create: `src/lib/offline/{db.ts,outbox.ts,snapshot.ts,sync.ts}`
- Test: `src/lib/offline/outbox.test.ts`, `src/lib/offline/sync.test.ts`

**Interfaces:**
- Consumes: HTTP contract (Task 12), `SnapshotVehicle` (Task 7).
- Produces:
  ```ts
  // db.ts — DB name 'carify', version 1, stores: outbox (keyPath 'id'), snapshot (keyPath 'id'), meta (out-of-line keys)
  openOfflineDb(): Promise<IDBPDatabase<OfflineSchema>>
  // outbox.ts
  type OutboxKind = 'fuel' | 'service'
  type OutboxError = { code: 'VALIDATION' | 'ODOMETER_OUT_OF_RANGE' | 'VEHICLE_NOT_FOUND' | 'ID_CONFLICT' | 'UNKNOWN'; message: string; min?: number | null; max?: number | null }
  type OutboxItem = { id: string; kind: OutboxKind; payload: Record<string, unknown> /* JSON, date as ISO */; status: 'pending' | 'failed'; error?: OutboxError; attempts: number; createdAt: number; nextAttemptAt: number }
  enqueue(kind: OutboxKind, payload: { id: string } & Record<string, unknown>): Promise<void>
  listOutbox(): Promise<OutboxItem[]>                       // createdAt asc
  discard(id: string): Promise<void>
  retry(id: string, payload?: Record<string, unknown>): Promise<void>   // → pending, attempts 0, error cleared
  subscribeOutbox(cb: () => void): () => void              // fires after any outbox mutation
  // snapshot.ts
  refreshSnapshot(fetchFn?: typeof fetch): Promise<void>    // replace store on 200, ignore otherwise
  getSnapshotVehicles(): Promise<SnapshotVehicle[]>
  bumpLastOdometer(vehicleId: string, odometer: number): Promise<void>   // max(existing, odometer)
  getLastUsedVehicleId(): Promise<string | null>; setLastUsedVehicleId(id: string): Promise<void>
  // sync.ts
  type SyncResult = { sent: number; failed: number; pending: number; needsAuth: boolean }
  syncOutbox(deps?: { fetchFn?: typeof fetch; now?: () => number }): Promise<SyncResult>
  backoffMs(attempts: number): number                       // min(5000 * 2 ** (attempts - 1), 600000)
  ```
- Sync rules: single-flight (a call while one is running returns the running promise); process `pending` items with `nextAttemptAt ≤ now` in `createdAt` order; POST to `/api/fuel-entries` or `/api/service-entries`. 200/201 → delete. 401 → stop, `needsAuth: true`, item untouched. 404/409/422 → `failed` with `OutboxError` from the body (`message` is English copy: e.g. `"Vehicle no longer exists"`, `"Odometer must be between 1 000 and 2 000 km"`). Network error or 5xx → `attempts++`, `nextAttemptAt = now + backoffMs(attempts)`, stop the loop. After any 2xx, call `refreshSnapshot`.

- [ ] **Step 1: Write failing tests** (`import 'fake-indexeddb/auto'`, fresh DB per test via `indexedDB.deleteDatabase`, stub `fetchFn` returning `new Response(...)`):
  - enqueue → `listOutbox` has one pending item, `attempts 0`; `subscribeOutbox` callback fired
  - 201 removes; **200 duplicate removes** and counts as sent
  - **404 → failed with `code: 'VEHICLE_NOT_FOUND'`**; 409 → `ID_CONFLICT`; 422 odometer → `ODOMETER_OUT_OF_RANGE` with `min/max`
  - 401 → item still pending, `needsAuth: true`, later items not attempted
  - fetch throws → pending, `attempts 1`, `nextAttemptAt = now + 5000`; a second sync at `now + 1000` sends nothing
  - two items sent in `createdAt` order
  - **single-flight**: two concurrent `syncOutbox()` calls → `fetchFn` called once per item
  - `retry(id, newPayload)` resets a failed item to pending with the new payload
  - `bumpLastOdometer` keeps the max; `refreshSnapshot` replaces store contents
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Install `idb`; implement.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(offline): outbox, snapshot and sync loop`.

---

### Task 19: Add screen, sync provider, Needs attention

**Files:**
- Create: `src/app/add/page.tsx`, `src/app/add/add-entry.tsx`, `src/components/sync/sync-provider.tsx`, `src/components/sync/needs-attention.tsx`, `src/components/shell/sync-indicator.tsx`
- Modify: `src/app/layout.tsx` (mount provider), `src/components/shell/top-bar.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/layout.tsx` (offline banner)

**Interfaces:**
- Consumes: Task 18 (all), Task 16 (`FuelFields`, `ServiceFields`, `useFuelMath`), Task 7 schemas (client-side validation).
- Produces: `useSync(): { online: boolean; pendingCount: number; failedCount: number; needsAuth: boolean; syncNow(): Promise<void> }`.
- `SyncProvider` triggers `syncOutbox` on mount, `visibilitychange` → visible, `online`; recounts on `subscribeOutbox`; calls `refreshSnapshot` on mount when online.

- [ ] **Step 1:** `/add` page is a static shell (no server data, no `requireUser`) rendering client `AddEntry`: Fuel/Service toggle from `?kind=`, vehicle select from `getSnapshotVehicles()` preselecting `getLastUsedVehicleId()`, odometer autofocused, date defaults to now. Soft warning (non-blocking) when odometer < snapshot `lastOdometer`. On save: validate with the Zod schema client-side, `id = v7()`, `enqueue`, `bumpLastOdometer`, `setLastUsedVehicleId`, kick `syncNow()` without awaiting, toast "Saved" (online) / "Saved — will sync when online" (offline), navigate to `/` (online) or reset the form (offline). If the snapshot is empty: online → "Add a vehicle first" link; offline → "Open Carify once online to load your vehicles".
- [ ] **Step 2:** Sync indicator in the top bar: hidden when idle; spinner/count when pending; red badge with `failedCount` linking to `/settings#needs-attention`. Offline banner in `(app)` layout: "Offline — {n} entries waiting to sync". `needsAuth` → banner linking to `/login`.
- [ ] **Step 3:** Needs attention list in Settings: each failed item shows kind, date, odometer, vehicle name (from snapshot or "Unknown vehicle"), error message; actions **Edit & retry** (opens the item's values in `FuelFields`/`ServiceFields` inside a Sheet, then `retry(id, payload)` + `syncNow`) and **Discard** (confirm).
- [ ] **Step 4: Verify manually** (Chrome DevTools, logged in as demo):
  - online add fuel → appears on dashboard after redirect
  - DevTools Network → Offline, add two entries → banner shows 2 → back online → both appear, banner gone
  - enqueue an entry, delete its vehicle before going online → item lands in Needs attention with "Vehicle no longer exists"; Discard removes it
  - enqueue odometer lower than an existing entry → Needs attention with range message; Edit & retry with a valid odometer succeeds
- [ ] **Step 5:** `npm run build && npm run lint && npm test` → clean. Commit `feat(offline): add screen, sync status and needs attention`.

---

### Task 20: PWA — manifest, icons, splash, service worker

**Files:**
- Create: `src/app/manifest.ts`, `src/app/sw.ts`, `src/app/offline/page.tsx`, `assets/icon.svg`, `public/icons/*`, `public/splash/*`
- Modify: `next.config.ts`, `src/app/layout.tsx`, `.gitignore` (`public/sw.js*`, `public/swe-worker*`)

**Interfaces:**
- Manifest: `name: 'Carify'`, `short_name: 'Carify'`, `start_url: '/'`, `display: 'standalone'`, `orientation: 'portrait'`, `background_color`/`theme_color` matching the light background, icons 192, 512, 512 maskable.
- Service worker (spec §3.6): precache build assets + `/add` + `/offline`; navigation requests network-first; on failure serve cached `/add` for `/add*`, else `/offline`. Never cache `/api/*`.

- [ ] **Step 1: Decide the SW tooling.** Install `@serwist/next` + `serwist`, follow its current Next.js guide. If `next build` with Turbopack is unsupported by the installed version, use Serwist's Turbopack integration if one exists; otherwise drop Serwist and hand-write `public/sw.js` (versioned cache name, precache list of `/add`, `/offline`, plus runtime cache-first for `/_next/static/*`) registered from a small client component. Record which path was taken in the commit message.
- [ ] **Step 2:** Placeholder `assets/icon.svg` (simple car or fuel-drop glyph on a solid rounded square). Generate PNG icons and iOS splash screens: `npx pwa-asset-generator assets/icon.svg public/icons --icon-only --favicon --type png` and `npx pwa-asset-generator assets/icon.svg public/splash --splash-only --background "#ffffff"` (+ `--dark-mode --background "#0a0a0a"`); add the generated `apple-touch-startup-image` links and `apple-touch-icon` to the root layout `<head>`.
- [ ] **Step 3:** `/offline` page: "You're offline", button to `/add`, count of pending entries via `useSync`.
- [ ] **Step 4: Verify** with `npm run build && npm start`: DevTools → Application shows manifest without errors and an activated SW; Lighthouse "Installable" passes; go Offline and reload `/add` → form works; reload `/` offline → `/offline` page.
- [ ] **Step 5:** Commit `feat(pwa): manifest, icons, splash screens, service worker`.

---

### Task 21: Deployment config & README

**Files:**
- Create: `vercel.json`, `README.md`
- Modify: `package.json`

- [ ] **Step 1:** `package.json`: `"build": "drizzle-kit migrate && next build"`. `vercel.json`: disable non-`master` deployments via `git.deploymentEnabled` (check current Vercel docs for the exact branch-pattern form; fallback is the project's "Ignored Build Step" set to `[ "$VERCEL_GIT_COMMIT_REF" != "master" ]` — exit 0 skips).
- [ ] **Step 2:** README: local setup (`docker compose up -d`, `cp .env.example .env`, `npm i`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`, demo login), tests (`npm test`, `npm run test:db` with Docker running), production setup for the owner (Neon project on Postgres 17 → set `DATABASE_URL` = pooled URL, `DATABASE_URL_UNPOOLED` = direct URL, `BETTER_AUTH_SECRET` = `openssl rand -base64 32`, `BETTER_AUTH_URL` = the permanent `https://<name>.vercel.app`; warning that changing the domain invalidates passkeys), install on iPhone (Safari → Share → Add to Home Screen), rule "migrations additive only".
- [ ] **Step 3: Verify** `npm run build` locally against Docker → migrate is a no-op, build succeeds. `npm test && npm run test:db` → all pass.
- [ ] **Step 4:** Commit `chore: deployment config and README`.
