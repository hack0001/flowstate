'use client'
import type { RecorderStatus } from '@/lib/betfair/recorderStatus'

// One-line health of the recorder server, shown on the Data and Setup tabs.
const C = { panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b' }
const ago = (iso: string | null) => {
  if (!iso) return 'never'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`
}

export default function RecorderStatusCard({ s }: { s: RecorderStatus | null | undefined }) {
  const box: React.CSSProperties = { background: C.panel2, border: '1px solid ' + C.line, borderRadius: 8, padding: '10px 12px', fontFamily: 'system-ui,sans-serif', fontSize: 13, lineHeight: 1.6 }
  if (s === undefined) return <div style={{ ...box, color: C.mut }}>Checking the recorder…</div>
  if (s === null) return <div style={{ ...box, color: C.mut }}>The recorder server isn&apos;t set up yet. Until it is, the bots and recording only run while this page is open. See “Recorder server” on the Setup tab.</div>
  const recentError = s.lastError && s.lastErrorAt && Date.now() - new Date(s.lastErrorAt).getTime() < 5 * 60_000
  const colour = !s.alive ? C.red : recentError || s.pendingWrites > 0 ? C.amb : C.teal
  return (
    <div style={box}>
      <div style={{ color: colour, fontWeight: 600 }}>
        ● {s.alive ? 'Recorder server online' : 'Recorder server offline'}
        <span style={{ color: C.mut, fontWeight: 400 }}> · last heartbeat {ago(s.lastBeat)} · last good Betfair check {ago(s.lastOk)}{s.version ? ` · v${s.version}` : ''}</span>
      </div>
      <div style={{ color: C.mut }}>
        {s.alive ? `Tracking ${s.marketsTracked} races. Bots keep running with this tab closed.` : 'Bots and recording only run while this page is open until it’s back. If it stays offline, check the server (Setup tab).'}
        {s.pendingWrites > 0 && <span style={{ color: C.amb }}> {s.pendingWrites.toLocaleString('en-GB')} rows waiting to be saved (Supabase unreachable; nothing is lost).</span>}
      </div>
      {recentError && <div style={{ color: C.amb }}>Last problem ({ago(s.lastErrorAt)}): {s.lastError}</div>}
    </div>
  )
}
