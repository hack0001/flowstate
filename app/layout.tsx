export const metadata = { title: 'FlowState', description: 'Content creator workflow' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0f', color: '#f0f0ff', fontFamily: 'system-ui,sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
