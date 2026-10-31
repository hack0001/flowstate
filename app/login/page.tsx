'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { safeNextPath } from '@/lib/authConfig'
import { Lock, Mail, AlertCircle } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', red:'#ff4466',
  text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.7rem 0.85rem', background:C.surface, border:'1px solid '+C.border,
  borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.9rem', outline:'none', boxSizing:'border-box',
}

function LoginForm() {
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const denied = params.get('denied')
  const callbackError = params.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(
    denied === 'unconfigured'
      ? 'Signed in, but ALLOWED_EMAILS is not set on the server, so no one is allowed in. Set it to your email in the environment variables and redeploy.'
      : denied
        ? "That account isn't on the allow-list for this app."
        : callbackError
          ? "That sign-in link didn't work (it may have expired or been opened in a different browser). Request a new one."
          : null,
  )

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setErr(error.message)
      setBusy(false)
      return
    }
    // Full navigation (not router.push) so the middleware sees the fresh cookie.
    window.location.href = next
  }

  async function sendMagicLink() {
    if (!email.trim()) { setErr('Enter your email first.'); return }
    setBusy(true); setErr(null); setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // shouldCreateUser:false -> an unknown address can never create an account.
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(next) },
    })
    if (error) setErr(error.message)
    else setMsg('Check your inbox for a sign-in link. Open it in this same browser.')
    setBusy(false)
  }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ width:'100%', maxWidth:380, background:C.card, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.75rem' }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:900, margin:'0 0 0.25rem', display:'flex', alignItems:'center', gap:'0.5rem', letterSpacing:'-0.02em' }}>
          <Lock size={20} color={C.cyan}/> FlowState
        </h1>
        <p style={{ fontSize:'0.8rem', color:C.sec, margin:'0 0 1.25rem' }}>Sign in to continue.</p>

        <form onSubmit={signInWithPassword} style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle}/>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={inputStyle}/>
          <button type="submit" disabled={busy || !email.trim() || !password} style={{ padding:'0.7rem', background:'linear-gradient(135deg,'+C.cyan+',#0099cc)', border:'none', borderRadius:'0.625rem', color:'#000', fontFamily:'inherit', fontSize:'0.9rem', fontWeight:800, cursor: busy ? 'not-allowed' : 'pointer', opacity: (busy || !email.trim() || !password) ? 0.6 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'1rem 0' }}>
          <div style={{ flex:1, height:1, background:C.border }}/>
          <span style={{ fontSize:'0.68rem', color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>or</span>
          <div style={{ flex:1, height:1, background:C.border }}/>
        </div>

        <button type="button" onClick={sendMagicLink} disabled={busy} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', padding:'0.6rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.sec, fontFamily:'inherit', fontSize:'0.8rem', fontWeight:700, cursor: busy ? 'not-allowed' : 'pointer' }}>
          <Mail size={14}/> Email me a sign-in link
        </button>

        {err && <p style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', fontSize:'0.78rem', color:C.red, margin:'1rem 0 0', lineHeight:1.5 }}><AlertCircle size={14} style={{ flexShrink:0, marginTop:2 }}/> {err}</p>}
        {msg && <p style={{ fontSize:'0.78rem', color:C.green, margin:'1rem 0 0', lineHeight:1.5 }}>{msg}</p>}
      </div>
    </main>
  )
}

export default function LoginPage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
