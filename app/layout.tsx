import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FlowState',
  description: 'Focus-first workflow tool for content creators',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, minHeight: '100vh', background: '#0a0a0f', color: '#f0f0ff', fontFamily: 'system-ui, -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  )
}
