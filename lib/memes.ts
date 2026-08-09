// ============================================================
// lib/memes.ts — Sound Money meme/reaction-image catalog
// ============================================================
// Static snapshot of the "Sound Money Memes" Google Drive folder
// (https://drive.google.com/drive/folders/10IRLbRbxQOGi_ugO5GSf76PgNO8DtYZf),
// owned by tompatelwales@gmail.com. Not a live API integration — Drive
// access needs OAuth credentials this app doesn't have server-side, so
// Claude pulls the file list + on-screen text from each image via the
// Drive connector and writes it here. Ask Claude to "refresh the meme
// library" any time new memes are added to the folder, and it will
// re-pull and update this file.
//
// Thumbnails/links resolve straight to Drive (thumbUrl uses Drive's public
// thumbnail endpoint, viewUrl opens the file) — nothing is copied into
// this repo, so they only render correctly when viewed while signed into
// the Drive account that owns the folder.
//
// tags are one or more of the brand's 3 content pillars (gold-history,
// inflation-data, urgency-crisis) plus general-humor/stocks/crypto/quote
// for anything that doesn't map cleanly, and 'untagged' for images with
// no on-screen text Claude could read — those still show up in the
// library, just without a caption or tag filter match.

export type MemeItem = {
  id: string
  title: string
  caption: string
  tags: string[]
  viewUrl: string
  thumbUrl: string
}

function drive(id: string, title: string, caption: string, tags: string[]): MemeItem {
  return {
    id, title, caption, tags,
    viewUrl: 'https://drive.google.com/file/d/' + id + '/view',
    thumbUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w400',
  }
}

export const MEME_LIBRARY: MemeItem[] = [
  drive('1zZtjZz59oTYfCr9fWCaI61t-CcMlxtuq', 'Screenshot 2026-06-15 at 10.04.54.png', "Elon Musk ‘buying Coca-Cola to put the cocaine back in’ + barber/haircut reaction meme (naiive)", ['general-humor', 'elon-musk']),
  drive('1-1JJt-fb6xZqTpzpxrqANuSYX-dMI5fV', 'E775AC3D-FCA0-4C60-9DE4-FE7EA3341B45_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('10jkmNtqvcxNClN2RKobzCfhZHEWp5M_m', 'Screenshot 2026-06-15 at 10.04.54.png', 'Duplicate upload of the Elon Musk Coca-Cola/barber meme above', ['general-humor', 'elon-musk', 'duplicate']),
  drive('1Wvm1h3SVqxg0414d7k6nRk6e5iK9yDiH', 'Screenshot 2026-06-15 at 10.03.44.png', '"Finally starting the task you told your boss you started a week ago" procrastination meme (naiive)', ['general-humor', 'work']),
  drive('1xdqliZ4HQZerUAFMwy4TiEjE-EWxCIkb', '4BA1F0E8-7D78-43DD-AE05-9C995D156B8B_4_5005_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1u5_nf38ndC16NTTpg6n4WrVA4LvxDPrJ', '28C60642-EFD3-42C3-B162-43C8FF175C02_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1LIIBMdWHcYl2328vOz33l6m7hErGNjtE', '3FB845CD-BA4B-4DDF-9DD4-D40FB1FC9CCD_1_201_a.jpeg', 'Thomas Sowell quote — "futile to talk facts to people enjoying moral superiority in their ignorance"', ['gold-history', 'quote', 'thomas-sowell']),
  drive('1uwkUjQau0rBCZbyNDK_nwvuidxV7T9kF', 'AE8D7598-CBD1-4100-924F-F714557D04FA_1_201_a.jpeg', 'Thomas Sowell quote — "the first lesson of economics is scarcity"', ['inflation-data', 'quote', 'thomas-sowell']),
  drive('1PpRsXuMT1WnjLFEcHxf27Co9NeGFWqBq', '0B9E13F8-6AF9-4A1E-8945-4F9149409D38_1_201_a.jpeg', 'Sandisk stock +4,000% in a year meme/screenshot', ['stocks', 'urgency-crisis']),
  drive('1y71ETNxcPYFSIrurm2maAisQE0AYFGl-', 'A2E7E778-67A2-4B41-B4CC-0BB4621902D6_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1MhGbosqJEm2UlDJQiArgdM_DgguXo7Yf', '46E0415B-760F-4BE5-9C4B-4B223A455776_1_102_o.jpeg', 'Sowell on markets self-correcting + "dear grandparents, turns out you were right" lifestyle meme', ['gold-history', 'quote', 'general-humor']),
  drive('1sL85a2-KNGIODCIr2itYVXGgA_JVlOfj', '9139828B-4635-46C9-873D-BAF31232D8D6_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('142h1CYQbnTqIjqtXSZqNcLZxgBVav2iv', 'AB587071-5D62-4058-AABA-9AF777D89B97_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1WX1H1dgp4hDmLz6UlUFrcEC7NCgbs7Er', '42982727-8913-48BF-A42E-87CF2CCA26C1_1_105_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1sirhIiDp2lAq7NfgI7No2cpBFfCtDouC', 'E9B466D8-D845-4170-B6D2-82455AF1AC31_1_105_c.jpeg', 'Peter Schiff quote — "the gain in the stock market is inflation, not real value"', ['inflation-data', 'quote', 'peter-schiff']),
  drive('1Z3kGquDVnb0InzKlJLeQilBGj-_Zx9bv', '53E6788F-1DF2-47F8-B49F-F57383206F66_1_105_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1ywzl_ycqLPVnYgOSGetu54NRjT0YaepF', 'C7F7049E-0B4E-4386-AA47-0BE1859A9DA1_1_105_c.jpeg', 'Elon Musk "give yourself 3 hours not 30 days" goals quote + haircut reaction meme', ['general-humor', 'elon-musk']),
  drive('11DqYupEmk2g3nyIeN-Z6cSgu1WOlTX_i', 'E39C92B5-D3CA-4F9D-BA35-7CC9FDFB4114_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1H6z5otJ1vXwsJW4x5fHy_o8xLQKxMqbo', '430A8361-93F5-4FA0-BEF4-ECFD2A18DFDD_1_105_c.jpeg', '"Not Jerome Powell" parody account — BlackRock foreclosure / Bernie Sanders lakefront property memes', ['urgency-crisis', 'general-humor', 'parody']),
  drive('1sKj9GktoeXhBFp0oLDqRPzSzWR6TD56s', '62672997-2780-4AAA-BACB-FEF799E5759F_1_201_a.jpeg', '"Gambling is Life" frog reaction meme — general humor, not finance-specific', ['general-humor']),
  drive('1XCaeYFzY80OPjuMIBI8nY_3NllbdtGRk', '9CD9CBD9-BA28-42DD-B1C6-7FE555F8D1A3_1_105_c.jpeg', 'Alan Greenspan on the US debt downgrade — news screenshot', ['urgency-crisis', 'quote']),
  drive('1VR-ITwLbZz6RNgDaC4yYF6Cu3m5zfmfR', 'A2DFBB04-60D4-4588-A15D-A2B69692A218_1_105_c.jpeg', 'Peter Schiff — "when the dollar loses value, everything appears to rise, it’s an illusion, 99% are being robbed"', ['inflation-data', 'quote', 'peter-schiff']),
  drive('1K2g3vXGBwvhWygl4B3g5CfcIeSSBlC0G', '02F30C3C-8DD3-4261-AF38-534EB813CBB4_1_201_a.jpeg', 'TradingView chart — Gold +159% vs Government Bonds -46% since 2021', ['gold-history', 'chart', 'inflation-data']),
  drive('174coWZ1eVUBbK5pbg_ktTPDg9l0q_Ue5', 'E0962538-643D-450F-8F17-7319FC94CD4E_1_105_c.jpeg', 'Russia’s gold reserves top $400B + Charlie Munger "I invert all the time" quote', ['gold-history', 'urgency-crisis', 'quote']),
  drive('19Ky8zd2NzUJqjM4EQh92wbepn-_vX14l', 'EF35ADE8-1C4A-4D37-9B4D-D632B3DF9E5D.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1STuBVR4ywep_Fp2nrJIZcu_7F2SH7zIK', 'EFA7143F-7A7F-4815-8904-8E5DF5DC0BF0_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1LV8j_QlwoW65B1JgAEaZhAa-4I7RufN5', 'D97988DA-4A13-4E1C-B321-0F2E2F96CDF3_1_105_c.jpeg', 'J.P. Morgan "gold is money, everything else is credit" — explainer text screenshot', ['gold-history', 'quote']),
  drive('1-pAVlbnI5uRy0SUYLSIZiRtLxcvApxFo', '294142BE-DA08-4B6A-9F43-4367AF93C9A3_1_201_a.jpeg', 'Peter Schiff tweet — foreign central banks moved gold from $2,000 to $5,500', ['gold-history', 'urgency-crisis', 'peter-schiff']),
  drive('1m-cKqH8Bz3RXM5q8WylieWrQc2z8N5Ww', '9C746CAF-13CA-4ACB-B717-39A31CECBB13_1_201_a.jpeg', '"My money was losing 7% a year to inflation so I invested in gold & silver, now I lose 30% a week" joke (naiive)', ['general-humor', 'gold-history']),
  drive('10JBSZI9CEeSJhrXdOGXPlp82KsmXk2CN', 'FB5E3D21-4553-4420-ACB2-DA43CBEEF9AC_1_201_a.jpeg', 'Michael Burry bearish-on-Palantir tracker meme — down 33% since his call', ['stocks', 'urgency-crisis']),
  drive('1R5F0fzO3LjtcWvRZPEcN_pTLsiNMrydG', '8BBB5082-6A1E-4228-BC32-B87683E64865_1_201_a.jpeg', 'Peter Schiff interview — "the dollar is going to collapse, replaced by gold, crisis worse than 2008"', ['urgency-crisis', 'peter-schiff', 'quote']),
  drive('12QkO_VQDlHOLY8oQJzzQEypvRJzVsznu', '4E47EF02-0604-4E22-88BB-7ED5547FFC6E_1_105_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1-9ck0LiYUXurqj__UgTEGqx1ptqH8PkV', 'EF0C1C37-D394-4739-9147-CFB9D33C85C6_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1zMV3f6TNPGK7aIyW5Hhf--jKGBmZaCAL', 'DA17EB36-2AF7-45B3-BCBE-B22AA8AF6E16.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1MJS_rj0gGLMreReU0lh2xtvtvos2gXus', 'C2FF9CBA-BB36-47C9-A13E-00C8E70B230E.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1NHpY6DbTuYZyIkY7p9D-GxUDWrjxmXls', '5EF24E63-DFDD-40D8-BEC7-4AC5D562E54B_1_105_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1LIdEDoHmEuiLTl5A-GarhOzcwm4f6IoC', '5E44A05D-0E25-4483-A54F-6255E1839512_1_105_c.jpeg', 'List of banks fined for gold/silver manipulation — JPMorgan, Deutsche Bank, Scotiabank, HSBC', ['gold-history', 'urgency-crisis']),
  drive('179LcfGVxbvy9LxpiaPqvXzu_lAxBLtHE', 'D5596EC2-FCE2-4FB0-9310-A874F201EDD6_1_102_o.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('16Sf1R0wUCwgx2vreeruuWkP1fRXx07Z3', '6E948225-0987-4DA0-A08A-A10B2E906E49.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1sjW98mfhdvpLKSy6Y4yZkOQOR-JzAEVh', '54DE0525-570A-4089-B021-803E9AA3C1F9.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1tE6rHYIxhY2Dd-p3GDgGewVVNseOxhGy', 'FAFE78DB-5DA5-4FAD-91E1-67EB4D3A754D_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('18s0I8I7Tg1gUaoSey7qSqKmuy9Lot5JC', '5A89D244-BB26-437B-8F7F-700EC9572F15_1_201_a.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1OMi1uj1V_hH4Fg-AQU70mAd57tmTCnuW', 'F18FAD29-9A98-4FC6-9305-416687BDA8BD_1_105_c.jpeg', 'No on-screen text detected — untagged, review manually', ['untagged']),
  drive('1uS6ObYFyq5dT_0dXTuBBXkm6Eu-Qg_FB', '0B518151-B4B5-4A07-A8A2-D8F548E02545_1_105_c.jpeg', '"When line go up post happy meme, when line go down post sad meme" — Dogecoin Memes comic', ['crypto', 'general-humor']),
]

export const MEME_TAG_LABELS: Record<string, string> = {
  'gold-history': 'Gold & History',
  'inflation-data': 'Inflation Data',
  'urgency-crisis': 'Urgency / Crisis',
  'general-humor': 'General Humor',
  stocks: 'Stocks',
  crypto: 'Crypto',
  quote: 'Quote',
  'peter-schiff': 'Peter Schiff',
  'thomas-sowell': 'Thomas Sowell',
  'elon-musk': 'Elon Musk',
  parody: 'Parody',
  chart: 'Chart',
  work: 'Work',
  duplicate: 'Duplicate',
  untagged: 'Untagged',
}

export const ALL_MEME_TAGS = Array.from(new Set(MEME_LIBRARY.flatMap(m => m.tags))).sort((a, b) => {
  if (a === 'untagged') return 1
  if (b === 'untagged') return -1
  return a.localeCompare(b)
})

// Naive keyword scoring against caption + tags + title. Good enough for
// "does this video's topic loosely match this meme" -- not a real search
// index, just enough to surface a handful of plausible picks.
export function searchMemes(query: string, limit = 40): MemeItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return MEME_LIBRARY.filter(m => !m.tags.includes('untagged')).slice(0, limit)
  const words = q.split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return MEME_LIBRARY.slice(0, limit)
  const scored = MEME_LIBRARY.map(m => {
    const hay = (m.caption + ' ' + m.tags.join(' ') + ' ' + m.title).toLowerCase()
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
    return { m, score }
  }).filter(x => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(x => x.m)
}

export function memesByTag(tag: string, limit = 40): MemeItem[] {
  return MEME_LIBRARY.filter(m => m.tags.includes(tag)).slice(0, limit)
}
