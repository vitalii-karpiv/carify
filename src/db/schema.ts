import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export * from './auth-schema'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const vehicle = pgTable(
  'vehicle',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    plate: text('plate').notNull(),
    vin: text('vin'),
    defaultGrade: text('default_grade').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('vehicle_user_id_idx').on(t.userId)],
)

export const energyEntry = pgTable(
  'energy_entry',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicle.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    odometer: integer('odometer').notNull(),
    quantity: numeric('quantity', { precision: 8, scale: 3 }).notNull(),
    unit: text('unit').notNull().default('L'),
    grade: text('grade').notNull(),
    pricePerUnit: integer('price_per_unit').notNull(),
    totalCost: integer('total_cost').notNull(),
    currency: text('currency').notNull().default('UAH'),
    isFull: boolean('is_full').notNull().default(true),
    missedPrevious: boolean('missed_previous').notNull().default(false),
    station: text('station'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [index('energy_entry_vehicle_date_idx').on(t.vehicleId, t.date)],
)

export const serviceEntry = pgTable(
  'service_entry',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicle.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    odometer: integer('odometer').notNull(),
    category: text('category').notNull(),
    totalCost: integer('total_cost').notNull(),
    currency: text('currency').notNull().default('UAH'),
    garage: text('garage'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('service_entry_vehicle_date_idx').on(t.vehicleId, t.date)],
)
