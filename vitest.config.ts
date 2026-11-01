import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/lib/{domain,offline}/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['src/lib/data/**/*.test.ts', 'src/app/api/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          setupFiles: ['vitest.db-setup.ts'],
        },
      },
    ],
  },
})
