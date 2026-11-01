// Writes public/sw.js from scripts/sw.template.js with a build-derived cache version.
import { readFile, writeFile } from 'node:fs/promises'

const version = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())
const src = await readFile('scripts/sw.template.js', 'utf8')
await writeFile('public/sw.js', src.replace('__SW_VERSION__', version))
console.log(`public/sw.js generated (version ${version})`)
