import type { Metadata } from 'next'
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
  title: 'RenGör — Biltvätt Portal',
  description: 'Arbetsportal och bokningssystem för biltvättsoperationer',
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
