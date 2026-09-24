import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'

// manifest + apple web app config make "Add to Home Screen" (mobile) and
// Chrome's "Install as app" / "Create shortcut" (desktop) pick up the real
// FlowState icon instead of a generic page icon -- app/icon.png and
// app/apple-icon.png (Next's file-based favicon convention) cover the
// plain browser tab favicon; this covers the shortcut/PWA icon paths too.
export const metadata: Metadata = {
  title: 'FlowState',
  description: 'Content creator workflow',
  manifest: '/manifest.json',
  appleWebApp: { title: 'FlowState', statusBarStyle: 'black-translucent' },
}
export const viewport: Viewport = { themeColor: '#0a0a0f' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0f', color: '#f0f0ff', fontFamily: 'system-ui,sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
