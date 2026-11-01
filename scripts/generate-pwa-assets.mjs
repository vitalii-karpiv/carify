// Regenerates public/icons and public/splash from assets/icon.svg using sharp.
// Usage: node scripts/generate-pwa-assets.mjs
import { readFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile('assets/icon.svg', 'utf8')
const square = Buffer.from(svg.replace('rx="112"', 'rx="0"'))
const rounded = Buffer.from(svg)

await mkdir('public/icons', { recursive: true })
await mkdir('public/splash', { recursive: true })

await sharp(rounded).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(rounded).resize(512, 512).png().toFile('public/icons/icon-512.png')
// Maskable: full-bleed background, glyph shrunk into the central safe zone (~60%).
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2a78d6' } })
  .composite([{ input: await sharp(square).resize(307, 307).png().toBuffer(), gravity: 'centre' }])
  .png()
  .toFile('public/icons/icon-512-maskable.png')
await sharp(square).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')

const sizes = [
  [1179, 2556], [1290, 2796], [1170, 2532], [1284, 2778], [1125, 2436], [828, 1792], [750, 1334],
]
const themes = { light: '#f2f6fb', dark: '#0a0e14' }
for (const [w, h] of sizes) {
  for (const [name, bg] of Object.entries(themes)) {
    const logo = await sharp(rounded).resize(Math.round(w * 0.28)).png().toBuffer()
    await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toFile(`public/splash/${w}x${h}-${name}.png`)
  }
}
