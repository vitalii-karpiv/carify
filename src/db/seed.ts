import { v7 as uuidv7 } from 'uuid'

const DEMO_EMAIL = 'demo@carify.local'
const DEMO_PASSWORD = 'demo-password'
const MONTHS_BACK = 8
const DAY_MS = 86_400_000

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL
  let host = ''
  try {
    host = new URL(url ?? '').hostname
  } catch {
    // fall through to the refusal below
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.error(`Refusing to seed: DATABASE_URL host "${host}" is not localhost/127.0.0.1`)
    process.exit(1)
  }
}

// mulberry32: small deterministic PRNG so every run produces the same data
function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  assertLocalDatabase()

  const [{ eq }, { db }, { user }, { auth }, vehicles, entries, math, schemas] = await Promise.all([
    import('drizzle-orm'),
    import('@/db/client'),
    import('@/db/schema'),
    import('@/lib/auth/auth'),
    import('@/lib/data/vehicles'),
    import('@/lib/data/entries'),
    import('@/lib/domain/fuel-math'),
    import('@/lib/domain/schemas'),
  ])
  const { client } = await import('@/db/client')

  await db.delete(user).where(eq(user.email, DEMO_EMAIL))
  const created = await auth.api.signUpEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo' },
  })
  const userId = created.user.id

  const now = Date.now()
  const start = new Date(now)
  start.setMonth(start.getMonth() - MONTHS_BACK)

  const ok = (what: string, r: { status: string }) => {
    if (r.status !== 'created') throw new Error(`Seed bug: ${what} -> ${r.status}`)
  }

  type Spec = {
    input: Parameters<typeof vehicles.createVehicle>[1]
    grade: 'A95' | 'DIESEL'
    startOdo: number
    litresPer100: number
    seed: number
    fills: number
    services: { at: number; category: 'OIL_CHANGE' | 'TYRES' | 'BRAKES' | 'INSPECTION'; kop: number; garage: string }[]
    stations: string[]
  }
  const specs: Spec[] = [
    {
      input: {
        name: 'Golf',
        make: 'Volkswagen',
        model: 'Golf',
        year: 2017,
        plate: 'AA1234BB',
        vin: null,
        defaultGrade: 'A95',
      },
      grade: 'A95',
      startOdo: 84_200,
      litresPer100: 7,
      seed: 1017,
      fills: 22,
      services: [
        { at: 4, category: 'OIL_CHANGE', kop: 320_000, garage: 'AutoMaster' },
        { at: 9, category: 'TYRES', kop: 780_000, garage: 'ShinaPlus' },
        { at: 14, category: 'BRAKES', kop: 540_000, garage: 'AutoMaster' },
        { at: 19, category: 'INSPECTION', kop: 150_000, garage: 'TechCenter' },
      ],
      stations: ['OKKO', 'WOG', 'SOCAR'],
    },
    {
      input: {
        name: 'Octavia',
        make: 'Skoda',
        model: 'Octavia',
        year: 2015,
        plate: 'KA5678CE',
        vin: null,
        defaultGrade: 'DIESEL',
      },
      grade: 'DIESEL',
      startOdo: 162_500,
      litresPer100: 5.5,
      seed: 2015,
      fills: 22,
      services: [
        { at: 3, category: 'INSPECTION', kop: 120_000, garage: 'TechCenter' },
        { at: 8, category: 'OIL_CHANGE', kop: 410_000, garage: 'SkodaService' },
        { at: 13, category: 'BRAKES', kop: 620_000, garage: 'SkodaService' },
        { at: 18, category: 'TYRES', kop: 690_000, garage: 'ShinaPlus' },
      ],
      stations: ['UPG', 'Shell', 'OKKO'],
    },
  ]

  for (const spec of specs) {
    const rand = prng(spec.seed)
    const veh = await vehicles.createVehicle(userId, schemas.vehicleInputSchema.parse(spec.input))

    const span = now - start.getTime() - 2 * DAY_MS
    const step = span / (spec.fills - 1)
    let odo = spec.startOdo
    let kmSinceFull = 0
    let litresSinceFull = 0
    const missedAt = 11

    for (let i = 0; i < spec.fills; i++) {
      const km = i === 0 ? 0 : Math.round(450 + rand() * 250)
      odo += km
      const date = new Date(start.getTime() + i * step)
      const progress = i / (spec.fills - 1)
      const priceKop = Math.round(
        (52 + 8 * progress + (rand() - 0.5) * 1.2) * 100,
      )
      const isFull = i === 0 || i === missedAt || rand() < 0.85
      // full-to-full consumption: a full fill tops up what the km since the last
      // full fill used, minus whatever partial fills already added
      const noise = 0.94 + rand() * 0.12
      kmSinceFull += km
      let litres: number
      if (i === 0) litres = 38
      else if (isFull) litres = (kmSinceFull / 100) * spec.litresPer100 * noise - litresSinceFull
      else litres = (km / 100) * spec.litresPer100 * 0.6
      litres = Math.max(5, Math.round(litres * 100) / 100)
      if (isFull) {
        kmSinceFull = 0
        litresSinceFull = 0
      } else litresSinceFull += litres
      const derived = math.deriveFuel({ litres, pricePerLitreKop: priceKop }, [
        'litres',
        'pricePerLitreKop',
      ])
      if (!derived) throw new Error('Seed bug: deriveFuel returned null')

      const input = schemas.fuelEntryInputSchema.parse({
        id: uuidv7(),
        vehicleId: veh.id,
        date,
        odometer: odo,
        litres: derived.litres,
        pricePerLitreKop: derived.pricePerLitreKop,
        totalKop: derived.totalKop,
        grade: spec.grade,
        isFull,
        missedPrevious: i === missedAt,
        station: spec.stations[i % spec.stations.length],
        note: null,
      })
      ok(`${veh.name} fuel #${i}`, await entries.createFuelEntry(userId, input))

      const service = spec.services.find((s) => s.at === i)
      if (service) {
        // a few km and a day after the fill; the next fill is >= 450 km and ~10 days later
        const input = schemas.serviceEntryInputSchema.parse({
          id: uuidv7(),
          vehicleId: veh.id,
          date: new Date(date.getTime() + DAY_MS),
          odometer: odo + 5,
          category: service.category,
          totalKop: service.kop,
          garage: service.garage,
          notes: null,
        })
        ok(`${veh.name} service ${service.category}`, await entries.createServiceEntry(userId, input))
        odo += 5
      }
    }
  }

  await client.end()
  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
