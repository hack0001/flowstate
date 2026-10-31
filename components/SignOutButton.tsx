'use client'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Ends the session (clears the auth cookies) and returns to /login.
export default function SignOutButton() {
  const [busy, setBusy] = useState(false)
  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    // Full navigation so the middleware re-evaluates with the cookies gone.
    window.location.href = '/login'
  }
  return (
    <button onClick={signOut} disabled={busy} title="Sign out"
      style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.4rem 0.75rem', background:'transparent', border:'1px solid #2a2a3a', borderRadius:'0.625rem', color:'#8888aa', cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:'0.72rem', fontWeight:700 }}>
      <LogOut size={13}/> {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
