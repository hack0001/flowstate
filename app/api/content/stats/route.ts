import { NextRequest, NextResponse } from 'next/server'

// Public YouTube stats for published videos — one batched call for every
// pipeline item that has a youtube_url. Uses the same YOUTUBE_API_KEY as the
// outlier scanner; videos.list costs 1 quota unit per call (up to 50 ids),
// so refreshing stats is effectively free next to the scanner's searches.
//
// Public API only: views/likes/comments. CTR, VVSA and retention live in
// YouTube Analytics (OAuth against the channel) — that's a later phase; for
// now those get read from Studio and typed into the revenue/notes fields.

export async function POST(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY is not set.' }, { status: 400 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const videoIds: string[] = Array.isArray(body?.videoIds) ? body.videoIds.filter((v: unknown) => typeof v === 'string' && v).slice(0, 50) : []
    if (videoIds.length === 0) return NextResponse.json({ stats: {} })

    const params = new URLSearchParams({ key, part: 'statistics,snippet', id: videoIds.join(',') })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    const data = await res.json()
    if (data?.error) {
      return NextResponse.json({ error: 'YouTube API error: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
    }
    const stats: Record<string, { views: number; likes: number; comments: number; publishedAt: string; title: string }> = {}
    for (const v of data?.items ?? []) {
      stats[v.id] = {
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
        publishedAt: v.snippet?.publishedAt ?? '',
        title: v.snippet?.title ?? '',
      }
    }
    return NextResponse.json({ stats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
