import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/providers'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: {
    default: 'KOM-fort Bilvård — Portal',
    template: '%s · KOM-fort Bilvård',
  },
  description: 'Arbetsportal och bokningssystem för KOM-fort Bilvård',
}

// Utan denna renderar mobilen sidan som 980px bred och zoomar ut allt —
// det var därför veckovyn klipptes av på telefonen.
// maximumScale sätts medvetet inte: användaren ska kunna zooma.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#121110',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className={`${dmSans.variable} ${dmMono.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
