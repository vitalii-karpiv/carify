import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { RegisterSW } from '@/components/pwa/register-sw'
import { SyncProvider } from '@/components/sync/sync-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// iPhone portrait splash sizes: [css width, css height, pixel ratio, png width, png height]
const SPLASH_SIZES = [
  [393, 852, 3, 1179, 2556],
  [430, 932, 3, 1290, 2796],
  [390, 844, 3, 1170, 2532],
  [428, 926, 3, 1284, 2778],
  [375, 812, 3, 1125, 2436],
  [414, 896, 2, 828, 1792],
  [375, 667, 2, 750, 1334],
] as const

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Carify',
  description: 'Track fuel and service for your cars.',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: 'Carify',
    statusBarStyle: 'black-translucent',
    startupImage: SPLASH_SIZES.flatMap(([dw, dh, ratio, w, h]) =>
      (['light', 'dark'] as const).map((scheme) => ({
        url: `/splash/${w}x${h}-${scheme}.png`,
        media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
      })),
    ),
  },
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SyncProvider>{children}</SyncProvider>
        <Toaster position="top-center" />
        <RegisterSW />
      </body>
    </html>
  )
}
