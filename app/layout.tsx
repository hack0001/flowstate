import { Providers } from './providers'

export const metadata = { title: 'FlowState', description: 'Content creator workflow' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0f', color: '#f0f0ff', fontFamily: 'system-ui,sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
