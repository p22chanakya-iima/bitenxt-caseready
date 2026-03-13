import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BiteNxt CaseReady™ | Scan Verification Engine',
  description:
    'Context-aware dental scan verification. Marginal gap, occlusal clearance, undercut detection before you mill.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-navy text-cream font-sans" suppressHydrationWarning>{children}</body>
    </html>
  )
}
