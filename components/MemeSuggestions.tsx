'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { searchMemes } from '@/lib/memes'

// Suggests memes from the Sound Money Memes library (lib/memes.ts) that
// loosely match the video currently being worked in the focus session, by
// simple keyword overlap against each meme's caption/tags. Collapsed by
// default so it doesn't compete with the SOP checklist for attention.
// Hardcoded colours (not a shared C import) matching the focus session's
// own palette -- same pattern as components/FoodProgress.tsx, which this
// sits next to on the page.
export default function MemeSuggestions({ topic }: { topic: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const suggestions = searchMemes(topic, 4)

  if (suggestions.length === 0) return null

  return (
    <div style={{ background:'#12121a', border:'1px solid #2a2a3a', borderRadius:'0.875rem', padding:'0.75rem 1rem' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:'flex', alignItems:'center', gap:'0.4rem', width:'100%', background:'none', border:'none',
        padding:0, cursor:'pointer', fontFamily:'inherit', color:'#00d4ff', fontSize:'0.72rem', fontWeight:800,
        letterSpacing:'0.05em', textTransform:'uppercase',
      }}>
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }} />
        Suggested memes for this video ({suggestions.length})
      </button>

      {open && (
        <>
          <div style={{ display:'flex', gap:'0.6rem', overflowX:'auto', padding:'0.75rem 0 0.25rem' }}>
            {suggestions.map(m => (
              <a key={m.id} href={m.viewUrl} target="_blank" rel="noopener noreferrer" title={m.caption} style={{
                flexShrink:0, width:'110px', display:'flex', flexDirection:'column', textDecoration:'none',
                background:'#1a1a26', border:'1px solid #2a2a3a', borderRadius:'0.6rem', overflow:'hidden',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.thumbUrl} alt={m.caption} loading="lazy" style={{ width:'100%', height:'80px', objectFit:'cover', display:'block', background:'#0a0a0f' }} />
              </a>
            ))}
          </div>
          <button onClick={() => router.push('/youtube?tab=memes&q=' + encodeURIComponent(topic))} style={{
            background:'none', border:'none', padding:0, marginTop:'0.4rem', cursor:'pointer', fontFamily:'inherit',
            color:'#8888aa', fontSize:'0.68rem', textDecoration:'underline',
          }}>Browse full meme library &rarr;</button>
        </>
      )}
    </div>
  )
}
