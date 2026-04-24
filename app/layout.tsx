import type { Metadata } from 'next'
import { geistSans, geistMono } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sparter',
  description: 'Personal finance per il mercato italiano',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`${geistSans.className} antialiased`}>{children}</body>
    </html>
  )
}
