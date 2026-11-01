import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { passkey } from '@better-auth/passkey'
import { db } from '../../db/client'
import * as schema from '../../db/schema'

const baseURL = process.env.BETTER_AUTH_URL!

export const auth = betterAuth({
  baseURL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 },
  plugins: [
    passkey({
      rpID: new URL(baseURL).hostname,
      rpName: 'Carify',
      origin: baseURL,
    }),
  ],
})
