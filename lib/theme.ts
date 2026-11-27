// Single source of truth for colours and fonts. ~30 files used to each paste
// their own copy of this palette; import it instead:  import { C, MONO } from '@/lib/theme'

export const C = {
  bg: '#0a0a0f', surface: '#12121a', card: '#1a1a26', border: '#2a2a3a',
  cyan: '#00d4ff', green: '#00ff88', amber: '#ffb800', purple: '#8b5cf6',
  red: '#ff4466', text: '#f0f0ff', sec: '#8888aa', muted: '#4a4a6a',
} as const

// Navy "trading desk" palette (Betfair desk + Home dashboard tiles).
export const DESK = {
  bg: '#060914', panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677',
  teal: '#2fd6b0', red: '#ff5470', amb: '#f6b93b', grn: '#3ee08f', vio: '#9b8cff', blu: '#6f9bff',
} as const

export const SANS = 'system-ui,sans-serif'
export const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
