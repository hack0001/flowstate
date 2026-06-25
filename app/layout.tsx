import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FlowState — Content Creator Workflow',
  description: 'Focus-first workflow tool for content creators',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {children}
      </body>
    </html>
  )
}
