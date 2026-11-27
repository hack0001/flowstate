'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Zap, Home, Sunrise, Film, TrendingUp, Activity, BookOpen, ChevronRight, ChevronLeft, Menu } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { getPageVisits, recordPageVisit } from '@/lib/supabase'
import { C } from '@/lib/theme'

// Persistent left sidebar for the whole app: five groups instead of one button
// per page. Collapsible (state remembered per browser) -- when collapsed a small
// round button bottom-left brings it back. Hidden on the login screen only.

const STORAGE_KEY = 'flowstate_sidebar_collapsed'
const HIDDEN_ON = ['/login', '/auth']

type NavItem = { route: string; label: string }
type NavGroup = { label: string; color: string; icon: ReactNode; items: NavItem[] }

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Record<string, 'green' | 'orange' | 'red'>>({})
  const [warn, setWarn] = useState<Set<string>>(new Set())

  const groups: NavGroup[] = [
    { label:'Today', color:C.green, icon:<Sunrise size={14}/>, items:[
      { route:'morning', label:t('morning') }, { route:'calendar', label:t('calendar') },
      { route:'tasks', label:t('tasks') }, { route:'evening', label:t('evening') } ] },
    { label:'Create', color:'#ff4466', icon:<Film size={14}/>, items:[
      { route:'content', label:'Content' }, { route:'youtube', label:t('youtube') }, { route:'ideas', label:'Ideas' },
      { route:'script-editor', label:'Script Editor' }, { route:'motion', label:'Motion Studio' },
      { route:'references', label:'Reference Bank' }, { route:'music', label:'Music' }, { route:'adobe-skills', label:'Adobe Skills' } ] },
    { label:'Grow', color:'#f97316', icon:<TrendingUp size={14}/>, items:[
      { route:'seo', label:'SEO' }, { route:'x', label:'X / Social' }, { route:'instagram', label:'Instagram' },
      { route:'etsy', label:t('etsy') }, { route:'betfair', label:'Betfair Desk' } ] },
    { label:'Life', color:C.cyan, icon:<Activity size={14}/>, items:[
      { route:'physical', label:'Physical' }, { route:'nsdr', label:'NSDR' }, { route:'welsh', label:'Welsh' },
      { route:'goals', label:'Goals' }, { route:'personal', label:t('personal') } ] },
    { label:'Library', color:C.purple, icon:<BookOpen size={14}/>, items:[
      { route:'vault', label:'Vault' }, { route:'projects', label:t('projects') },
      { route:'links', label:'Links' }, { route:'tabs', label:'Tab Sheet' } ] },
  ]

  // Remembered collapsed state; on a phone it starts collapsed so it never covers the page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setCollapsed(saved === '1')
      else if (window.innerWidth < 760) setCollapsed(true)
    } catch {}
  }, [])
  function setCollapsedPersist(v: boolean) {
    setCollapsed(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch {}
  }

  // Open the group containing the current page.
  const currentRoute = pathname.split('/')[1] ?? ''
  const activeGroup = groups.find(g => g.items.some(i => i.route === currentRoute))?.label ?? null
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup) }, [activeGroup])

  // "Not visited recently" dots (same thresholds the old Home buttons used).
  useEffect(() => {
    getPageVisits().then(({ visits }) => {
      const now = Date.now()
      const a: Record<string, 'green' | 'orange' | 'red'> = {}
      const w = new Set<string>()
      for (const g of groups) for (const { route } of g.items) {
        const raw = visits[route]
        if (!raw) { a[route] = 'red'; w.add(route); continue }
        const days = (now - new Date(raw).getTime()) / 86400000
        if (days >= 5) a[route] = 'red'
        else if (days >= 4) a[route] = 'orange'
        else if (days >= 2) a[route] = 'green'
        if (days >= 3) w.add(route)
      }
      setAlerts(a); setWarn(w)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function go(route: string) {
    recordPageVisit(route)
    setWarn(p => { if (!p.has(route)) return p; const n = new Set(p); n.delete(route); return n })
    setAlerts(p => { if (!(route in p)) return p; const n = { ...p }; delete n[route]; return n })
    if (typeof window !== 'undefined' && window.innerWidth < 760) setCollapsedPersist(true)
    router.push('/' + route)
  }
  const dotColor = (route: string) => {
    const a = alerts[route]
    return a === 'red' ? '#ff4466' : a === 'orange' ? C.amber : a === 'green' ? C.green : warn.has(route) ? C.amber : null
  }

  if (HIDDEN_ON.some(p => pathname === p || pathname.startsWith(p + '/'))) return <>{children}</>

  return (
    <div className="fs-shell" style={{ display:'flex', minHeight:'100vh' }}>
      {!collapsed && (
        <aside className="fs-side" style={{ width:'200px', flexShrink:0, position:'sticky', top:0, alignSelf:'flex-start', height:'100vh', overflowY:'auto', padding:'1rem 0.7rem', borderRight:'1px solid '+C.border, background:'#0e0e16', zIndex:50, boxSizing:'border-box' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', padding:'0 0.3rem', marginBottom:'0.9rem' }}>
            <Zap size={15} color={C.cyan} />
            <span style={{ flex:1, fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.cyan }}>FlowState</span>
            <button onClick={() => setCollapsedPersist(true)} aria-label="Hide sidebar" title="Hide sidebar" style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', padding:'2px' }}><ChevronLeft size={16}/></button>
          </div>

          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'0.55rem', width:'100%', padding:'0.5rem 0.55rem', marginBottom:'0.2rem', background: pathname === '/' ? 'rgba(0,212,255,0.1)' : 'transparent', border:'none', borderRadius:'0.55rem', color: pathname === '/' ? C.cyan : C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700, textAlign:'left' }}>
            <Home size={14}/> Home
          </button>

          {groups.map(g => {
            const open = openGroup === g.label
            const groupWarn = g.items.some(i => warn.has(i.route))
            return (
              <div key={g.label} style={{ marginBottom:'0.2rem' }}>
                <button onClick={() => setOpenGroup(open ? null : g.label)} style={{ display:'flex', alignItems:'center', gap:'0.55rem', width:'100%', padding:'0.5rem 0.55rem', background: open ? g.color+'14' : 'transparent', border:'none', borderRadius:'0.55rem', color: open ? g.color : C.text, cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700, textAlign:'left' }}>
                  {g.icon}
                  <span style={{ flex:1 }}>{g.label}</span>
                  {groupWarn && !open && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:C.amber }} />}
                  <ChevronRight size={12} color={C.muted} style={{ transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }} />
                </button>
                {open && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1px', margin:'0.15rem 0 0.4rem 1.35rem', borderLeft:'1px solid '+C.border }}>
                    {g.items.map(i => {
                      const dc = dotColor(i.route)
                      const active = i.route === currentRoute
                      return (
                        <button key={i.route} onClick={() => go(i.route)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.35rem 0.6rem', background: active ? g.color+'18' : 'none', border:'none', color: active ? g.color : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.76rem', fontWeight: active ? 700 : 400, textAlign:'left' }}>
                          <span style={{ flex:1 }}>{i.label}</span>
                          {dc && <span title="Not visited recently" style={{ width:'6px', height:'6px', borderRadius:'50%', background:dc }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </aside>
      )}

      <div style={{ flex:1, minWidth:0 }}>{children}</div>

      {collapsed && (
        <button onClick={() => setCollapsedPersist(false)} aria-label="Show sidebar" title="Show sidebar" style={{ position:'fixed', left:'14px', bottom:'14px', zIndex:50, width:'38px', height:'38px', borderRadius:'50%', border:'1px solid '+C.border, background:'#12121a', color:C.cyan, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.5)' }}>
          <Menu size={16}/>
        </button>
      )}

      <style>{`
        @media (max-width: 760px) {
          .fs-side { position: fixed !important; left: 0; top: 0; box-shadow: 8px 0 32px rgba(0,0,0,0.6); }
        }
      `}</style>
    </div>
  )
}
