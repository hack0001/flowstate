import { NextRequest, NextResponse } from 'next/server'

// YouTube Data API v3 outlier scanner — the "OutlierKit" half of the Idea
// Finder. Where Claude's web search gives judgment with approximate numbers,
// this gives exact numbers with no judgment: for each seed query it pulls
// real videos, their real view counts, and their channel's real subscriber
// counts, then keeps only genuine outliers (high view:sub ratio on a
// small-enough channel). The results are fed into the Find Ideas prompt as
// verified evidence so Claude builds ideas on real precedents instead of
// searching from scratch.
//
// Needs YOUTUBE_API_KEY in .env.local (Google Cloud console → YouTube Data
// API v3 → API key, free tier). Quota note: search.list costs 100 units per
// query and the free quota is 10,000/day — so a full 6-query scan costs
// ~600+ units; dozens of scans a day are fine, hundreds are not.

type ScannedOutlier = {
  videoId: string
  title: string
  channel: string
  views: number
  subscribers: number
  ratio: number          // views / subscribers, rounded to 1dp
  publishedAt: string    // ISO date of the video
  url: string
  query: string          // which seed query surfaced it
}

const YT = 'https://www.googleapis.com/youtube/v3'

export async function POST(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'YOUTUBE_API_KEY is not set. Get a free key from the Google Cloud console (YouTube Data API v3) and add it to .env.local, then restart the dev server.' },
      { status: 400 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const queries: string[] = Array.isArray(body?.queries) ? body.queries.slice(0, 8) : []
    if (queries.length === 0) {
      return NextResponse.json({ error: 'No queries provided.' }, { status: 400 })
    }
    // Tunable thresholds — defaults per the Hummus method: proven pull beyond
    // the channel's own audience (ratio) on a channel small enough that the
    // topic, not the brand, did the work.
    const minRatio = typeof body?.minRatio === 'number' ? body.minRatio : 3
    const maxSubs = typeof body?.maxSubs === 'number' ? body.maxSubs : 500_000
    const minViews = typeof body?.minViews === 'number' ? body.minViews : 50_000
    const maxAgeMonths = typeof body?.maxAgeMonths === 'number' ? body.maxAgeMonths : 18

    const publishedAfter = new Date(Date.now() - maxAgeMonths * 30 * 24 * 3600 * 1000).toISOString()

    // 1. search.list per query — collect candidate video ids (dedup across queries)
    const candidates = new Map<string, { query: string }>()
    for (const q of queries) {
      const params = new URLSearchParams({
        key, part: 'id', type: 'video', maxResults: '25',
        q, publishedAfter, relevanceLanguage: 'en', videoDuration: 'medium',
      })
      const res = await fetch(`${YT}/search?${params}`)
      const data = await res.json()
      if (data?.error) {
        return NextResponse.json({ error: 'YouTube API error on search: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
      }
      for (const item of data?.items ?? []) {
        const id = item?.id?.videoId
        if (id && !candidates.has(id)) candidates.set(id, { query: q })
      }
    }
    if (candidates.size === 0) return NextResponse.json({ outliers: [] })

    // 2. videos.list — stats + channel ids (batches of 50)
    const videoIds = [...candidates.keys()]
    type VideoMeta = { id: string; title: string; channelId: string; channelTitle: string; views: number; publishedAt: string }
    const videos: VideoMeta[] = []
    for (let i = 0; i < videoIds.length; i += 50) {
      const params = new URLSearchParams({ key, part: 'snippet,statistics', id: videoIds.slice(i, i + 50).join(',') })
      const res = await fetch(`${YT}/videos?${params}`)
      const data = await res.json()
      if (data?.error) {
        return NextResponse.json({ error: 'YouTube API error on videos: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
      }
      for (const v of data?.items ?? []) {
        videos.push({
          id: v.id,
          title: v.snippet?.title ?? '',
          channelId: v.snippet?.channelId ?? '',
          channelTitle: v.snippet?.channelTitle ?? '',
          views: Number(v.statistics?.viewCount ?? 0),
          publishedAt: v.snippet?.publishedAt ?? '',
        })
      }
    }

    // 3. channels.list — subscriber counts (batches of 50, dedup)
    const channelIds = [...new Set(videos.map(v => v.channelId).filter(Boolean))]
    const subsByChannel = new Map<string, number>()
    for (let i = 0; i < channelIds.length; i += 50) {
      const params = new URLSearchParams({ key, part: 'statistics', id: channelIds.slice(i, i + 50).join(',') })
      const res = await fetch(`${YT}/channels?${params}`)
      const data = await res.json()
      if (data?.error) {
        return NextResponse.json({ error: 'YouTube API error on channels: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
      }
      for (const c of data?.items ?? []) {
        subsByChannel.set(c.id, Number(c.statistics?.subscriberCount ?? 0))
      }
    }

    // 4. Filter to genuine outliers and rank by ratio
    const outliers: ScannedOutlier[] = videos
      .map(v => {
        const subscribers = subsByChannel.get(v.channelId) ?? 0
        const ratio = subscribers > 0 ? Math.round((v.views / subscribers) * 10) / 10 : 0
        return {
          videoId: v.id, title: v.title, channel: v.channelTitle,
          views: v.views, subscribers, ratio,
          publishedAt: v.publishedAt, url: `https://www.youtube.com/watch?v=${v.id}`,
          query: candidates.get(v.id)?.query ?? '',
        }
      })
      .filter(o => o.views >= minViews && o.subscribers > 0 && o.subscribers <= maxSubs && o.ratio >= minRatio)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 20)

    return NextResponse.json({ outliers })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
