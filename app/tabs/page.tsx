'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Layers, Plus, ExternalLink, Archive, Trash2,
  Search, X, Copy, Check, RotateCcw, BookmarkIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6', blue:'#60a5fa',
}
const GROUP_COLORS: Record<string,string> = {
  Etsy:C.orange,'Sound Money':C.amber,Instagram:C.pink,
  Research:C.purple,Tools:C.teal,Reading:C.blue,Reference:C.sec,Dev:C.cyan,
}
function groupColor(g:string){ return GROUP_COLORS[g]??C.purple }
const PRESET_GROUPS = ['Etsy','Sound Money','Instagram','Research','Tools','Reading','Reference','Dev']
const LS_KEY = 'flowstate_tabs'

// ── Types ─────────────────────────────────────────────────────────────────────
type SavedTab = {
  id:string; url:string; title:string; favicon:string
  group:string; notes:string; addedAt:string
  status:'active'|'archived'; source:'manual'|'bookmarklet'
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r:any):SavedTab {
  return { id:r.id, url:r.url, title:r.title, favicon:r.favicon,
    group:r.tab_group??'', notes:r.notes, addedAt:r.added_at,
    status:r.status, source:r.source }
}
function toRow(t:SavedTab) {
  return { id:t.id, url:t.url, title:t.title, favicon:t.favicon,
    tab_group:t.group, notes:t.notes, added_at:t.addedAt,
    status:t.status, source:t.source }
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsRead():SavedTab[] { try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]') }catch{ return [] } }
function lsWrite(tabs:SavedTab[]){ try{ localStorage.setItem(LS_KEY,JSON.stringify(tabs)) }catch{} }

// ── Supabase background sync ──────────────────────────────────────────────────
// Returns null on success, error message string on failure.
// Always reads FRESH localStorage at merge time — no stale snapshot passed in.
async function dbSync(onMerge:(merged:SavedTab[])=>void): Promise<string|null> {
  try {
    const { data, error } = await supabase.from('tabs').select('*').order('added_at',{ ascending:false })
    if (error) { console.error('[tabs] dbSync select:', error); return error.message }
    if (!data) return 'No data returned'
    const current  = lsRead()
    const remote   = data.map(fromRow)
    const remoteIds= new Set(remote.map(t=>t.id))
    const localOnly= current.filter(t=>!remoteIds.has(t.id))
    if (localOnly.length>0) {
      const { error: upsertErr } = await supabase.from('tabs').upsert(localOnly.map(toRow),{onConflict:'id'})
      if (upsertErr) console.error('[tabs] dbSync upsert:', upsertErr)
    }
    const merged = [...remote,...localOnly]
      .sort((a,b)=>new Date(b.addedAt).getTime()-new Date(a.addedAt).getTime())
    lsWrite(merged)
    onMerge(merged)
    return null
  } catch(e) { console.error('[tabs] dbSync exception:', e); return String(e) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeId(){ return `tab_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }
function faviconFor(url:string,explicit?:string){
  if(explicit) return explicit
  try{ return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` }catch{ return '' }
}
function timeAgo(iso:string){
  const d=Date.now()-new Date(iso).getTime()
  const m=Math.floor(d/60000),h=Math.floor(d/3600000),dy=Math.floor(d/86400000)
  if(m<1) return 'just now'; if(m<60) return `${m}m ago`
  if(h<24) return `${h}h ago`; if(dy<7) return `${dy}d ago`
  return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'})
}
function getDomain(url:string){ try{ return new URL(url).hostname.replace('www.','') }catch{ return url } }

// ── Tab Card ──────────────────────────────────────────────────────────────────
function TabCard({ tab,archived,onOpen,onArchive,onRestore,onDelete }:{
  tab:SavedTab;archived:boolean;onOpen:()=>void;onArchive:()=>void;onRestore:()=>void;onDelete:()=>void
}){
  const [imgErr,setImgErr]=useState(false)
  const domain=getDomain(tab.url)
  const src=!imgErr&&tab.favicon?tab.favicon:`https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  const gc=tab.group?groupColor(tab.group):null
  return (
    <div style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',
      background:archived?'rgba(255,255,255,0.01)':C.card,
      border:'1px solid '+(archived?C.muted+'44':C.border),
      borderRadius:'0.75rem',opacity:archived?0.7:1 }}>
      <div style={{ width:28,height:28,flexShrink:0,borderRadius:'0.35rem',overflow:'hidden',background:C.surface,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <img src={src} alt="" width={20} height={20} onError={()=>setImgErr(true)} style={{ objectFit:'contain',display:'block' }}/>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:'0.82rem',fontWeight:600,color:archived?C.sec:C.text,margin:0,
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
          textDecoration:archived?'line-through':'none' }}>{tab.title||domain}</p>
        <div style={{ display:'flex',alignItems:'center',gap:'0.4rem',marginTop:'0.2rem',flexWrap:'wrap' as const }}>
          <span style={{ fontSize:'0.65rem',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'180px' }}>{domain}</span>
          {gc&&<span style={{ fontSize:'0.6rem',fontWeight:700,color:gc,background:gc+'18',border:'1px solid '+gc+'33',borderRadius:'0.25rem',padding:'0.05rem 0.35rem',flexShrink:0 }}>{tab.group}</span>}
          <span style={{ fontSize:'0.6rem',color:C.muted,flexShrink:0 }}>{timeAgo(tab.addedAt)}</span>
          {tab.source==='bookmarklet'&&<span style={{ fontSize:'0.55rem',color:C.teal,background:C.teal+'15',borderRadius:'0.2rem',padding:'0.05rem 0.3rem',fontWeight:600,flexShrink:0 }}>clip</span>}
        </div>
        {tab.notes&&<p style={{ fontSize:'0.67rem',color:C.sec,margin:'0.25rem 0 0',lineHeight:1.4 }}>{tab.notes}</p>}
      </div>
      <div style={{ display:'flex',gap:'0.3rem',flexShrink:0 }}>
        <button onClick={onOpen} style={{ padding:'0.3rem',borderRadius:'0.4rem',border:'1px solid '+C.border,background:'none',cursor:'pointer',color:C.cyan,display:'flex',alignItems:'center',fontFamily:'inherit' }}><ExternalLink size={13}/></button>
        {archived
          ?<button onClick={onRestore} style={{ padding:'0.3rem',borderRadius:'0.4rem',border:'1px solid '+C.border,background:'none',cursor:'pointer',color:C.green,display:'flex',alignItems:'center',fontFamily:'inherit' }}><RotateCcw size={13}/></button>
          :<button onClick={onArchive} style={{ padding:'0.3rem',borderRadius:'0.4rem',border:'1px solid '+C.border,background:'none',cursor:'pointer',color:C.amber,display:'flex',alignItems:'center',fontFamily:'inherit' }}><Archive size={13}/></button>}
        <button onClick={onDelete} style={{ padding:'0.3rem',borderRadius:'0.4rem',border:'1px solid '+C.border,background:'none',cursor:'pointer',color:C.red,display:'flex',alignItems:'center',fontFamily:'inherit' }}><Trash2 size={13}/></button>
      </div>
    </div>
  )
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ onClose,onSave,existingGroups }:{ onClose:()=>void;onSave:(p:Partial<SavedTab>)=>void;existingGroups:string[] }){
  const [url,setUrl]=useState(''),[title,setTitle]=useState(''),[group,setGroup]=useState(''),[notes,setNotes]=useState('')
  const urlRef=useRef<HTMLInputElement>(null)
  const allGroups=[...new Set([...PRESET_GROUPS,...existingGroups])].sort()
  useEffect(()=>{ urlRef.current?.focus() },[])
  const inp:React.CSSProperties={ width:'100%',background:C.surface,border:'1px solid '+C.border,borderRadius:'0.5rem',color:C.text,fontFamily:'inherit',fontSize:'0.82rem',padding:'0.55rem 0.75rem',outline:'none',boxSizing:'border-box' as const }
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:C.surface,border:'1px solid '+C.border,borderRadius:'1.25rem',padding:'1.5rem',width:'100%',maxWidth:'440px',display:'flex',flexDirection:'column' as const,gap:'0.875rem' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <h2 style={{ fontSize:'1rem',fontWeight:800,margin:0 }}>Add Tab</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',display:'flex' }}><X size={18}/></button>
        </div>
        <div>
          <label style={{ fontSize:'0.68rem',fontWeight:700,color:C.muted,textTransform:'uppercase' as const,letterSpacing:'0.05em',display:'block',marginBottom:'0.3rem' }}>URL <span style={{ color:C.red }}>*</span></label>
          <input ref={urlRef} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={inp}/>
        </div>
        <div>
          <label style={{ fontSize:'0.68rem',fontWeight:700,color:C.muted,textTransform:'uppercase' as const,letterSpacing:'0.05em',display:'block',marginBottom:'0.3rem' }}>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Leave blank to auto-generate" style={inp}/>
        </div>
        <div>
          <label style={{ fontSize:'0.68rem',fontWeight:700,color:C.muted,textTransform:'uppercase' as const,letterSpacing:'0.05em',display:'block',marginBottom:'0.3rem' }}>Group</label>
          <div style={{ display:'flex',gap:'0.35rem',flexWrap:'wrap' as const,marginBottom:'0.4rem' }}>
            {allGroups.map(g=>(
              <button key={g} onClick={()=>setGroup(group===g?'':g)} style={{ padding:'0.2rem 0.55rem',borderRadius:'999px',cursor:'pointer',fontFamily:'inherit',fontSize:'0.68rem',fontWeight:600,border:'1px solid '+(group===g?groupColor(g):C.border),background:group===g?groupColor(g)+'22':'transparent',color:group===g?groupColor(g):C.muted }}>{g}</button>
            ))}
          </div>
          <input value={group} onChange={e=>setGroup(e.target.value)} placeholder="Or type a new group..." style={inp}/>
        </div>
        <div>
          <label style={{ fontSize:'0.68rem',fontWeight:700,color:C.muted,textTransform:'uppercase' as const,letterSpacing:'0.05em',display:'block',marginBottom:'0.3rem' }}>Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Optional context..." style={{ ...inp,resize:'none' as const }}/>
        </div>
        <div style={{ display:'flex',gap:'0.5rem',paddingTop:'0.25rem' }}>
          <button onClick={onClose} style={{ flex:1,padding:'0.6rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:600 }}>Cancel</button>
          <button onClick={()=>{ if(url.trim()){ onSave({ url:url.trim(),title:title.trim(),group,notes:notes.trim() }); onClose() }}} disabled={!url.trim()} style={{ flex:2,padding:'0.6rem',borderRadius:'0.6rem',border:'none',background:url.trim()?C.cyan:C.muted+'44',color:url.trim()?'#000':C.muted,cursor:url.trim()?'pointer':'default',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:700 }}>Save Tab</button>
        </div>
      </div>
    </div>
  )
}

// ── Bookmarklet Panel ─────────────────────────────────────────────────────────
function BookmarkletPanel({ origin,onClose }:{ origin:string;onClose:()=>void }){
  const [copied,setCopied]=useState(false)
  const bm=`javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title);var f=document.querySelector('link[rel~="icon"]');var i=f?encodeURIComponent(f.href):'';window.open('${origin}/tabs?add='+u+'&title='+t+'&fav='+i,'_tabsave','width=320,height=90,top=20,left=20');})();`
  function copy(){ navigator.clipboard.writeText(bm).then(()=>{ setCopied(true);setTimeout(()=>setCopied(false),2500) }) }
  const st:React.CSSProperties={ display:'flex',gap:'0.75rem',alignItems:'flex-start' }
  const nm:React.CSSProperties={ width:22,height:22,borderRadius:'50%',background:C.cyan+'22',border:'1px solid '+C.cyan+'55',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'0.65rem',fontWeight:800,color:C.cyan,marginTop:'1px' }
  return (
    <div style={{ background:C.card,border:'1px solid '+C.cyan+'33',borderRadius:'1rem',padding:'1.25rem',marginBottom:'1.5rem' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'0.5rem' }}><BookmarkIcon size={15} color={C.cyan}/><p style={{ fontSize:'0.82rem',fontWeight:800,color:C.cyan,margin:0 }}>Bookmarklet Setup</p></div>
        <button onClick={onClose} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',display:'flex' }}><X size={15}/></button>
      </div>
      <div style={{ display:'flex',flexDirection:'column' as const,gap:'0.75rem',marginBottom:'1.1rem' }}>
        {[
          { n:'1',text:'Copy the bookmarklet code below' },
          { n:'2',text:'In Chrome, right-click the bookmarks bar &rarr; &ldquo;Add page&rdquo;' },
          { n:'3',text:'Name it &ldquo;Save Tab&rdquo; and paste the code as the URL' },
          { n:'4',text:'Click it on any page to save that tab &mdash; the Tab Sheet updates live' },
        ].map(s=>(
          <div key={s.n} style={st}><div style={nm}>{s.n}</div><p style={{ fontSize:'0.78rem',color:C.sec,margin:0,lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html:s.text }}/></div>
        ))}
      </div>
      <div style={{ background:C.surface,border:'1px solid '+C.border,borderRadius:'0.6rem',padding:'0.6rem 0.75rem',marginBottom:'0.75rem' }}>
        <p style={{ fontSize:'0.62rem',color:C.muted,margin:0,fontFamily:'monospace',wordBreak:'break-all' as const,lineHeight:1.5 }}>{bm.slice(0,130)}&hellip;</p>
      </div>
      <button onClick={copy} style={{ display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.55rem 1rem',borderRadius:'0.6rem',background:copied?C.green+'22':C.cyan+'22',border:'1px solid '+(copied?C.green+'44':C.cyan+'44'),color:copied?C.green:C.cyan,cursor:'pointer',fontFamily:'inherit',fontSize:'0.8rem',fontWeight:700 }}>
        {copied?<Check size={14}/>:<Copy size={14}/>}
        {copied?'Copied!':'Copy bookmarklet code'}
      </button>
    </div>
  )
}

// ── Popup Save View ───────────────────────────────────────────────────────────
// Opened by bookmarklet. Saves to localStorage ONLY — no dbSync, no race.
// The main Tab Sheet listens for the 'storage' event and updates live.
function PopupSave({ url,title,favicon }:{ url:string;title:string;favicon:string }){
  const [state,setState]=useState<'saving'|'saved'|'duplicate'|'error'>('saving')

  useEffect(()=>{
    try {
      let hostname=''
      try{ hostname=new URL(url).hostname }catch{}

      const local=lsRead()
      if(local.some(t=>t.url===url&&t.status==='active')){
        setState('duplicate')
        setTimeout(()=>{ try{ window.close() }catch{} },1800)
        return
      }

      const newTab:SavedTab={
        id:makeId(), url,
        title:title||hostname||'Untitled',
        favicon:favicon||faviconFor(url),
        group:'', notes:'',
        addedAt:new Date().toISOString(),
        status:'active', source:'bookmarklet',
      }

      // Write to localStorage — the main Tab Sheet's storage listener will fire
      lsWrite([newTab,...local])
      setState('saved')

      // Sync to Supabase in background (fire and forget)
      supabase.from('tabs').upsert([toRow(newTab)],{ onConflict:'id' }).then()

      setTimeout(()=>{ try{ window.close() }catch{} },1800)
    } catch {
      setState('error')
      setTimeout(()=>{ try{ window.close() }catch{} },2500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  const domain=getDomain(url)
  const col=state==='saved'?C.green:state==='duplicate'?C.amber:state==='error'?C.red:C.muted
  const label=state==='saving'?'Saving...':state==='saved'?'Saved to Tab Sheet':state==='duplicate'?'Already saved':'Error saving'
  const icon=state==='saving'?'&#8987;':state==='saved'?'&#10004;':state==='duplicate'?'&#128203;':'&#10006;'

  return (
    <main style={{ minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }}>
      <div style={{ textAlign:'center' as const }}>
        <div style={{ fontSize:'1.5rem',marginBottom:'0.5rem' }} dangerouslySetInnerHTML={{ __html:icon }}/>
        <p style={{ fontSize:'0.9rem',fontWeight:800,color:col,margin:'0 0 0.25rem' }}>{label}</p>
        <p style={{ fontSize:'0.72rem',color:C.muted,margin:0 }}>{domain}</p>
        {state!=='saving'&&<p style={{ fontSize:'0.62rem',color:C.muted,marginTop:'0.5rem' }}>Closing&hellip;</p>}
      </div>
    </main>
  )
}

// ── Main Tab Manager ──────────────────────────────────────────────────────────
function TabsInner(){
  const router  = useRouter()
  const params  = useSearchParams()
  const addUrl  = params.get('add')
  const addTitle= params.get('title')||''
  const addFav  = params.get('fav')||''

  const [tabs,setTabs]               = useState<SavedTab[]>([])
  const [mounted,setMounted]         = useState(false)
  const [syncing,setSyncing]         = useState(false)
  const [syncError,setSyncError]     = useState<string|null>(null)
  const [view,setView]               = useState<'active'|'archived'>('active')
  const [search,setSearch]           = useState('')
  const [groupFilter,setGroupFilter] = useState('all')
  const [showAdd,setShowAdd]         = useState(false)
  const [showBM,setShowBM]           = useState(false)
  const [showSQL,setShowSQL]         = useState(false)
  const [origin,setOrigin]           = useState('')

  useEffect(()=>{
    setOrigin(window.location.origin)
    setMounted(true)

    // Popup mode — skip all tab manager init, let PopupSave handle everything
    if(new URLSearchParams(window.location.search).get('add')) return

    // Load from localStorage immediately (instant, no spinner)
    const local=lsRead()
    setTabs(local)

    // Listen for storage events from the bookmarklet popup (different window, same origin)
    function onStorage(e:StorageEvent){
      if(e.key===LS_KEY) setTabs(lsRead())
    }
    window.addEventListener('storage',onStorage)

    // Background sync with Supabase
    setSyncing(true)
    dbSync(merged=>{ setTabs(merged); setSyncError(null) })
      .then(err=>{ if(err) setSyncError(err) })
      .finally(()=>setSyncing(false))

    return ()=>{ window.removeEventListener('storage',onStorage) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // Render popup save view if bookmarklet popup
  if(mounted&&addUrl){
    return <PopupSave url={decodeURIComponent(addUrl)} title={decodeURIComponent(addTitle)} favicon={decodeURIComponent(addFav)}/>
  }

  // ── CRUD: localStorage first, Supabase in background ─────────────────────
  function saveTab(partial:Partial<SavedTab>){
    const url=partial.url?.trim()||''
    if(!url) return
    const current=lsRead()
    if(current.some(t=>t.url===url&&t.status==='active')) return
    let hostname=''
    try{ hostname=new URL(url).hostname }catch{}
    const newTab:SavedTab={
      id:makeId(), url,
      title:partial.title||hostname||'Untitled',
      favicon:partial.favicon||faviconFor(url),
      group:partial.group||'', notes:partial.notes||'',
      addedAt:new Date().toISOString(),
      status:'active', source:partial.source||'manual',
    }
    const next=[newTab,...current]
    lsWrite(next); setTabs(next)
    supabase.from('tabs').upsert([toRow(newTab)],{onConflict:'id'})
      .then(({ error })=>{ if(error) console.error('[tabs] saveTab upsert:',error) })
  }

  function mutate(id:string, updates:Partial<SavedTab>){
    const next=lsRead().map(t=>t.id===id?{ ...t,...updates }:t)
    lsWrite(next); setTabs(next)
    const dbUpdates:Record<string,unknown>={}
    if('status' in updates) dbUpdates.status=updates.status
    if('group'  in updates) dbUpdates.tab_group=updates.group
    if('notes'  in updates) dbUpdates.notes=updates.notes
    if(Object.keys(dbUpdates).length>0)
      supabase.from('tabs').update(dbUpdates).eq('id',id)
        .then(({ error })=>{ if(error) console.error('[tabs] mutate update:',error) })
  }

  function removeTab(id:string){
    const next=lsRead().filter(t=>t.id!==id)
    lsWrite(next); setTabs(next)
    supabase.from('tabs').delete().eq('id',id)
      .then(({ error })=>{ if(error) console.error('[tabs] removeTab delete:',error) })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeTabs  =tabs.filter(t=>t.status==='active')
  const archivedTabs=tabs.filter(t=>t.status==='archived')
  const allGroups   =[...new Set(tabs.filter(t=>t.group).map(t=>t.group))].sort()

  function filterList(list:SavedTab[]){
    return list
      .filter(t=>groupFilter==='all'||t.group===groupFilter)
      .filter(t=>!search||t.title.toLowerCase().includes(search.toLowerCase())||getDomain(t.url).includes(search.toLowerCase())||t.notes.toLowerCase().includes(search.toLowerCase()))
  }
  const displayTabs=filterList(view==='active'?activeTabs:archivedTabs)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight:'100vh',background:C.bg,color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        input::placeholder,textarea::placeholder{color:#4a4a6a}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface,borderBottom:'1px solid '+C.border,padding:'1.25rem 2rem' }}>
        <div style={{ maxWidth:'800px',margin:'0 auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.875rem',marginBottom:'0.5rem' }}>
            <button onClick={()=>router.back()} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:'0.8rem',padding:0 }}>&#8592; back</button>
            <div style={{ flex:1 }}/>
            {syncing&&<div style={{ width:'0.7rem',height:'0.7rem',borderRadius:'50%',border:'1.5px solid '+C.muted,borderTopColor:C.cyan,animation:'spin 0.8s linear infinite' }}/>}
            <Layers size={18} color={C.cyan}/>
            <span style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' as const,color:C.cyan }}>Tab Sheet</span>
          </div>
          <div style={{ display:'flex',alignItems:'baseline',gap:'0.75rem' }}>
            <h1 style={{ fontSize:'1.5rem',fontWeight:900,margin:0,letterSpacing:'-0.02em' }}>Tab Sheet</h1>
            <span style={{ fontSize:'0.75rem',color:C.muted }}>{activeTabs.length} saved &middot; {archivedTabs.length} archived</span>
          </div>
          <p style={{ fontSize:'0.78rem',color:C.sec,margin:'0.2rem 0 0' }}>Saves locally first &mdash; syncs across devices in the background</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:'800px',margin:'0 auto',padding:'1.5rem 2rem',opacity:mounted?1:0,transition:'opacity 0.3s',animation:'fadeInUp 0.3s ease both' }}>

        {/* Supabase error banner */}
        {syncError&&(
          <div style={{ background:'rgba(255,68,102,0.08)',border:'1px solid '+C.red+'44',borderRadius:'0.875rem',padding:'0.875rem 1rem',marginBottom:'1.25rem' }}>
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'0.8rem',fontWeight:700,color:C.red,margin:'0 0 0.25rem' }}>Supabase sync failed &mdash; tabs are saving locally only</p>
                <p style={{ fontSize:'0.72rem',color:C.sec,margin:'0 0 0.5rem',lineHeight:1.5 }}>
                  Error: <code style={{ fontFamily:'monospace',fontSize:'0.68rem',color:C.amber }}>{syncError}</code>
                </p>
                <p style={{ fontSize:'0.72rem',color:C.sec,margin:'0 0 0.5rem' }}>
                  The <code style={{ fontFamily:'monospace',color:C.cyan }}>tabs</code> table probably doesn&apos;t exist yet.
                  Run this SQL in your Supabase dashboard:
                </p>
                <button onClick={()=>setShowSQL(v=>!v)} style={{ fontSize:'0.68rem',fontWeight:700,color:C.cyan,background:C.cyan+'18',border:'1px solid '+C.cyan+'33',borderRadius:'0.4rem',padding:'0.2rem 0.6rem',cursor:'pointer',fontFamily:'inherit' }}>
                  {showSQL?'Hide SQL':'Show SQL'}
                </button>
              </div>
              <button onClick={()=>setSyncError(null)} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}><X size={14}/></button>
            </div>
            {showSQL&&(
              <pre style={{ marginTop:'0.75rem',padding:'0.75rem',background:C.surface,border:'1px solid '+C.border,borderRadius:'0.5rem',fontSize:'0.65rem',color:C.text,overflowX:'auto' as const,lineHeight:1.7,fontFamily:'monospace',whiteSpace:'pre' as const }}>{`create table tabs (
  id text primary key,
  url text not null,
  title text,
  favicon text,
  tab_group text default '',
  notes text default '',
  added_at timestamptz default now(),
  status text default 'active',
  source text default 'manual'
);`}</pre>
            )}
          </div>
        )}

        {showBM&&origin&&<BookmarkletPanel origin={origin} onClose={()=>setShowBM(false)}/>}

        {/* Toolbar */}
        <div style={{ display:'flex',gap:'0.5rem',marginBottom:'0.875rem',flexWrap:'wrap' as const }}>
          <div style={{ flex:1,minWidth:'180px',display:'flex',alignItems:'center',gap:'0.5rem',background:C.card,border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.45rem 0.875rem' }}>
            <Search size={13} color={C.muted}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tabs..."
              style={{ flex:1,background:'none',border:'none',outline:'none',color:C.text,fontSize:'0.82rem',fontFamily:'inherit' }}/>
            {search&&<button onClick={()=>setSearch('')} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontFamily:'inherit',padding:0 }}><X size={13}/></button>}
          </div>
          <div style={{ display:'flex',background:C.card,border:'1px solid '+C.border,borderRadius:'0.75rem',overflow:'hidden' }}>
            {(['active','archived'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'0.45rem 0.875rem',border:'none',fontFamily:'inherit',cursor:'pointer',fontSize:'0.75rem',fontWeight:view===v?700:500,background:view===v?C.cyan+'18':'transparent',color:view===v?C.cyan:C.muted,transition:'all 0.15s' }}>
                {v==='active'?`Active (${activeTabs.length})`:`Archived (${archivedTabs.length})`}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowBM(v=>!v)} style={{ display:'flex',alignItems:'center',gap:'0.4rem',padding:'0.45rem 0.875rem',background:C.card,border:'1px solid '+(showBM?C.cyan+'44':C.border),borderRadius:'0.75rem',color:showBM?C.cyan:C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:'0.75rem',fontWeight:600 }}>
            <BookmarkIcon size={13}/> Bookmarklet
          </button>
        </div>

        {/* Group pills */}
        {allGroups.length>0&&(
          <div style={{ display:'flex',gap:'0.3rem',marginBottom:'1rem',flexWrap:'wrap' as const }}>
            <button onClick={()=>setGroupFilter('all')} style={{ padding:'0.2rem 0.6rem',borderRadius:'999px',cursor:'pointer',fontFamily:'inherit',fontSize:'0.68rem',fontWeight:600,border:'1px solid '+(groupFilter==='all'?C.cyan:C.border),background:groupFilter==='all'?C.cyan+'18':'transparent',color:groupFilter==='all'?C.cyan:C.muted }}>All</button>
            {allGroups.map(g=>{
              const gc=groupColor(g),act=groupFilter===g
              const cnt=(view==='active'?activeTabs:archivedTabs).filter(t=>t.group===g).length
              return (
                <button key={g} onClick={()=>setGroupFilter(act?'all':g)} style={{ padding:'0.2rem 0.6rem',borderRadius:'999px',cursor:'pointer',fontFamily:'inherit',fontSize:'0.68rem',fontWeight:600,border:'1px solid '+(act?gc:C.border),background:act?gc+'22':'transparent',color:act?gc:C.muted }}>
                  {g} <span style={{ opacity:0.6 }}>{cnt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Open all when filtered */}
        {view==='active'&&(groupFilter!=='all'||search)&&displayTabs.length>1&&(
          <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem' }}>
            <button onClick={()=>displayTabs.forEach(t=>window.open(t.url,'_blank'))} style={{ display:'flex',alignItems:'center',gap:'0.4rem',padding:'0.35rem 0.8rem',borderRadius:'0.5rem',background:C.cyan+'18',border:'1px solid '+C.cyan+'44',color:C.cyan,cursor:'pointer',fontFamily:'inherit',fontSize:'0.72rem',fontWeight:700 }}>
              <ExternalLink size={12}/> Open all {displayTabs.length} tabs
            </button>
          </div>
        )}

        {/* List / empty */}
        {displayTabs.length===0?(
          <div style={{ textAlign:'center' as const,padding:'3rem 1rem' }}>
            <div style={{ fontSize:'2.5rem',marginBottom:'0.75rem' }} dangerouslySetInnerHTML={{ __html:'&#128216;' }}/>
            {view==='active'&&activeTabs.length===0?(
              <>
                <p style={{ fontSize:'0.9rem',fontWeight:700,color:C.text,margin:'0 0 0.4rem' }}>No saved tabs yet</p>
                <p style={{ fontSize:'0.78rem',color:C.muted,margin:'0 0 1.25rem',lineHeight:1.6 }}>
                  Add tabs manually, or set up the bookmarklet to save any Chrome tab in one click.
                </p>
                <div style={{ display:'flex',gap:'0.6rem',justifyContent:'center',flexWrap:'wrap' as const }}>
                  <button onClick={()=>setShowAdd(true)} style={{ display:'flex',alignItems:'center',gap:'0.4rem',padding:'0.55rem 1.1rem',borderRadius:'0.6rem',border:'none',background:C.cyan,color:'#000',cursor:'pointer',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:700 }}><Plus size={15}/> Add tab</button>
                  <button onClick={()=>setShowBM(true)} style={{ display:'flex',alignItems:'center',gap:'0.4rem',padding:'0.55rem 1.1rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:'none',color:C.sec,cursor:'pointer',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:600 }}><BookmarkIcon size={14}/> Set up bookmarklet</button>
                </div>
              </>
            ):(
              <p style={{ fontSize:'0.82rem',color:C.muted }}>No tabs match your filter</p>
            )}
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column' as const,gap:'0.4rem' }}>
            {displayTabs.map(tab=>(
              <TabCard key={tab.id} tab={tab} archived={view==='archived'}
                onOpen={()=>window.open(tab.url,'_blank')}
                onArchive={()=>mutate(tab.id,{ status:'archived' })}
                onRestore={()=>mutate(tab.id,{ status:'active' })}
                onDelete={()=>removeTab(tab.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={()=>setShowAdd(true)} style={{ position:'fixed',bottom:'1.75rem',right:'1.75rem',width:52,height:52,borderRadius:'50%',border:'none',background:C.cyan,color:'#000',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(0,212,255,0.35)',zIndex:100,fontFamily:'inherit' }}><Plus size={22}/></button>

      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onSave={p=>saveTab(p)} existingGroups={allGroups}/>}
    </main>
  )
}

export default function TabsPage(){
  return <Suspense><TabsInner/></Suspense>
}
