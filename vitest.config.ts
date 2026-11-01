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
          include: ['src/lib/domain/**/*.test.ts', 'src/db/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['src/lib/data/**/*.test.ts', 'src/lib/vehicle-selection.test.ts', 'src/app/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          setupFiles: ['vitest.db-setup.ts'],
        },
      },
    ],
  },
})
