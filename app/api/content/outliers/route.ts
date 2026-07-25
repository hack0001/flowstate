import { NextRequest, NextResponse } from 'next/server'

// YouTube Data API v3 outlier scanner — the "OutlierKit" half of the Idea
// Finder. Where Claude's web search gives judgment with approximate numbers,
// this gives exact numbers with no judgment: for each seed query it pulls
// real videos, their real view counts, and their channel's real subscriber
// counts, then splits them into two evidence buckets from the SAME fetched
// data (no extra API calls):
//
//   1. RATIO outliers — high view:sub ratio on a small-enough channel. Proof
//      the topic itself pulled an audience beyond the channel's own
//      following — the strongest signal, because it isolates the topic from
//      the channel's existing reach.
//   2. VELOCITY outliers — big absolute view count racked up in a short
//      window, regardless of channel size or ratio. A gold video that hit
//      1M views in a month is real demand evidence even if it happened on a
//      channel with 2M subscribers (where the ratio would look unremarkable
//      or get filtered out entirely). This doesn't isolate topic from
//      channel authority the way ratio does — a big channel gets an
//      algorithmic/audience head start — so it's weaker evidence on its own,
//      but "ignore it because the channel is big" throws away real signal.
//      It's flagged separately so it gets weighed as secondary/corroborating
//      evidence, not treated as equivalent proof to a ratio outlier.
//
// Needs YOUTUBE_API_KEY (Google Cloud console → YouTube Data API v3 → API
// key, free tier; set in Vercel env for production). Quota note: search.list
// costs 100 units per call and each query runs 2 passes, so ~200 units per
// topic against the free 10,000/day — a 6-topic scan is ~1,200 units; a
// handful of scans a day is fine, dozens are not.

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
  ageDays: number         // days since published
  viewsPerDay: number     // views / ageDays, rounded — the velocity number
  channelCountry: string | null // ISO 3166-1 alpha-2 the channel owner set in About, e.g. "US" — not viewer demographics (YouTube doesn't expose those for channels you don't own), just the channel's declared base
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

    // Velocity thresholds — any channel size, but the views have to have
    // landed FAST: a lot of views in a short window is what makes it
    // "gained a lot despite low ratio" rather than just "old video with a
    // lot of views by now".
    const velocityMinViews = typeof body?.velocityMinViews === 'number' ? body.velocityMinViews : 300_000
    const velocityMaxAgeDays = typeof body?.velocityMaxAgeDays === 'number' ? body.velocityMaxAgeDays : 60

    // Audience-geography knobs. YouTube's public API has no way to see who
    // actually watched a video you don't own (that's YouTube Analytics,
    // owner-only) — the closest available proxy is the channel's own
    // declared country (channels.list snippet.country, set by the channel
    // owner in About, often left blank). regionCode biases search.list's
    // ranking toward what's popular in that region; countryFilter, if set,
    // hard-filters results to channels that declared that exact country
    // (so it will also drop channels that never set one).
    const regionCode = typeof body?.regionCode === 'string' && body.regionCode ? body.regionCode : 'US'
    const countryFilter = typeof body?.countryFilter === 'string' && body.countryFilter ? body.countryFilter : null

    const publishedAfter = new Date(Date.now() - maxAgeMonths * 30 * 24 * 3600 * 1000).toISOString()

    // 1. search.list per query — two passes each (relevance + viewCount) so we
    // catch both "what YouTube associates with the topic" and "the biggest
    // videos on the topic" (where the monster small-channel outliers hide).
    // Costs 200 units per query instead of 100 — worth it for coverage.
    const candidates = new Map<string, { query: string }>()
    for (const q of queries) {
      for (const order of ['relevance', 'viewCount'] as const) {
        const params = new URLSearchParams({
          key, part: 'id', type: 'video', maxResults: '50', order,
          q, publishedAfter, relevanceLanguage: 'en', regionCode,
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

    // 3. channels.list — subscriber counts + declared country (batches of 50, dedup)
    const channelIds = [...new Set(videos.map(v => v.channelId).filter(Boolean))]
    const subsByChannel = new Map<string, number>()
    const countryByChannel = new Map<string, string | null>()
    for (let i = 0; i < channelIds.length; i += 50) {
      const params = new URLSearchParams({ key, part: 'snippet,statistics', id: channelIds.slice(i, i + 50).join(',') })
      const res = await fetch(`${YT}/channels?${params}`)
      const data = await res.json()
      if (data?.error) {
        return NextResponse.json({ error: 'YouTube API error on channels: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
      }
      for (const c of data?.items ?? []) {
        subsByChannel.set(c.id, Number(c.statistics?.subscriberCount ?? 0))
        countryByChannel.set(c.id, c.snippet?.country ?? null)
      }
    }

    // 4. Enrich every candidate once — ratio, age, views/day, declared
    // country — then split into the two evidence buckets from this single
    // pass. countryFilter, if set, drops anything that didn't declare that
    // exact country (so it also drops the many channels that left it blank —
    // that's a real gap, not a bug: YouTube just doesn't expose true viewer
    // geography for channels you don't own).
    const enriched: ScannedOutlier[] = videos
      .map(v => {
        const subscribers = subsByChannel.get(v.channelId) ?? 0
        const ratio = subscribers > 0 ? Math.round((v.views / subscribers) * 10) / 10 : 0
        const ageDays = Math.max(1, Math.round((Date.now() - new Date(v.publishedAt).getTime()) / 86400000))
        const viewsPerDay = Math.round(v.views / ageDays)
        return {
          videoId: v.id, title: v.title, channel: v.channelTitle,
          views: v.views, subscribers, ratio,
          publishedAt: v.publishedAt, url: `https://www.youtube.com/watch?v=${v.id}`,
          query: candidates.get(v.id)?.query ?? '',
          ageDays, viewsPerDay,
          channelCountry: countryByChannel.get(v.channelId) ?? null,
        }
      })
      .filter(o => !countryFilter || o.channelCountry === countryFilter)

    // Ratio outliers — topic beat the channel's own audience size.
    const outliers = enriched
      .filter(o => o.views >= minViews && o.subscribers > 0 && o.subscribers <= maxSubs && o.ratio >= minRatio)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 30)

    // Velocity outliers — big absolute views, fast, regardless of channel
    // size or ratio. Excludes anything already surfaced as a ratio outlier
    // so the two lists don't just duplicate each other.
    const outlierIds = new Set(outliers.map(o => o.videoId))
    const velocityOutliers = enriched
      .filter(o => !outlierIds.has(o.videoId) && o.views >= velocityMinViews && o.ageDays <= velocityMaxAgeDays)
      .sort((a, b) => b.viewsPerDay - a.viewsPerDay)
      .slice(0, 20)

    return NextResponse.json({ outliers, velocityOutliers })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
