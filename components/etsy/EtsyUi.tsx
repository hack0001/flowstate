'use client'
import { useState, useEffect, Suspense } from 'react'
import { ShoppingBag, CheckCircle, Circle, RotateCcw, ChevronDown, ExternalLink, Search, BookOpen } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ETSY_NOTES, SOFTWARE_PIPELINE, ETSY_TODOS, ETSY_LINKS, BATCH_WORKFLOW } from '@/lib/etsy-data'
import { supabase } from '@/lib/supabase'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'
import { C } from '@/lib/theme'
import { SOP } from '@/lib/etsyPageData'

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display:'inline-block', background: color+'22', color,
      padding:'0.1rem 0.42rem', borderRadius:'0.3rem',
      fontSize:'0.6rem', fontWeight:700, whiteSpace:'nowrap' as const, letterSpacing:'0.02em',
    }}>{label}</span>
  )
}

export function SearchBar({ value, onChange, placeholder }: { value:string; onChange:(v:string)=>void; placeholder:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.45rem 0.875rem', marginBottom:'1rem' }}>
      <Search size={13} color={C.muted} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex:1, background:'none', border:'none', outline:'none', color:C.text, fontSize:'0.82rem', fontFamily:'inherit' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0 0.2rem', fontSize:'0.8rem', fontFamily:'inherit' }}>x</button>
      )}
    </div>
  )
}

// ---- Components ----
export function CheckItem({ id, label, note, checked, onToggle }: { id:string; label:string; note:string; checked:boolean; onToggle:(id:string)=>void }) {
  return (
    <button onClick={() => onToggle(id)} style={{
      display:'flex', alignItems:'flex-start', gap:'0.875rem',
      width:'100%', padding:'0.75rem 0.875rem', textAlign:'left',
      background: checked ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.02)',
      border:'1px solid '+(checked ? 'rgba(0,255,136,0.2)' : C.border),
      borderRadius:'0.75rem', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s ease',
    }}>
      <div style={{ flexShrink:0, marginTop:'1px', color: checked ? C.green : C.muted, transition:'color 0.15s' }}>
        {checked ? <CheckCircle size={17} /> : <Circle size={17} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.82rem', fontWeight:600, margin:'0 0 0.15rem', color: checked ? C.green : C.text, textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.75 : 1 }}
          dangerouslySetInnerHTML={{ __html: label }} />
        <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}
          dangerouslySetInnerHTML={{ __html: note }} />
      </div>
    </button>
  )
}

export function SOPCard({ sop }: { sop:SOP }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border:'1px solid '+C.border, borderRadius:'0.875rem', overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'1rem 1.125rem', background:'rgba(255,255,255,0.02)',
        border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left',
      }}>
        <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: sop.icon }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:'0.85rem', fontWeight:700, color:C.text, margin:'0 0 0.1rem' }}>
            <span style={{ color:C.muted, fontSize:'0.65rem', fontWeight:500, marginRight:'0.4rem' }}>SOP {sop.id}</span>
            {sop.title}
          </p>
          {!open && <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sop.tagline}</p>}
        </div>
        <ChevronDown size={16} color={C.muted} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s', flexShrink:0 }} />
      </button>
      {open && (
        <div style={{ padding:'0.25rem 1.125rem 1.125rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.72rem', color:C.orange, fontStyle:'italic', margin:'0.75rem 0 0.875rem', lineHeight:1.5 }}>{sop.tagline}</p>
          <ol style={{ margin:0, padding:'0 0 0 1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {sop.steps.map((step, i) => (
              <li key={i} style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6 }}
                dangerouslySetInnerHTML={{ __html: step }} />
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
