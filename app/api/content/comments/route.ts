import { NextRequest, NextResponse } from 'next/server'

// YouTube comment analyser — pulls real top-level comments for one video via
// the YouTube Data API and surfaces the ones actually worth reading: enough
// substance to say something (not just "nice video" or an emoji), ranked by
// like count so the ones the audience itself endorsed float to the top.
// These are the closest thing to unfiltered audience research available —
// what real viewers are asking for, frustrated by, or wish a video had
// covered — used to ground the Find Ideas workflow's "comment_gap" field in
// real quotes instead of a guess.
//
// Needs YOUTUBE_API_KEY (same key as /api/content/outliers). Quota note:
// commentThreads.list costs 1 unit per call (cheap relative to search.list's
// 100), so this can be run per-outlier freely.

type TopComment = {
  id: string
  author: string
  text: string
  likeCount: number
  publishedAt: string
  replyCount: number
}

const YT = 'https://www.googleapis.com/youtube/v3'

// Filters out low-effort reactions ("great video!", emoji-only, "first!") so
// what's left actually has a chance of containing a real opinion, question,
// or piece of feedback — "insightful" as a length/substance proxy. Real
// ranking by audience approval (likeCount) happens after this filter.
const MIN_INSIGHTFUL_LENGTH = 40

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
    const videoId: string = typeof body?.videoId === 'string' ? body.videoId.trim() : ''
    if (!videoId) return NextResponse.json({ error: 'No videoId provided.' }, { status: 400 })

    const limit = typeof body?.limit === 'number' ? Math.min(50, Math.max(1, body.limit)) : 20

    // order=relevance is YouTube's own "top comments" ranking (engagement +
    // recency-weighted) — the closest single call to what a viewer sees by
    // default, and a much better starting pool than order=time. We still
    // re-sort by raw likeCount ourselves below so "lots of likes" wins,
    // rather than trusting YouTube's relevance blend alone.
    const all: TopComment[] = []
    let pageToken = ''
    for (let page = 0; page < 3; page++) {
      const params = new URLSearchParams({
        key, part: 'snippet', videoId, order: 'relevance',
        maxResults: '100', textFormat: 'plainText',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const res = await fetch(`${YT}/commentThreads?${params}`)
      const data = await res.json()
      if (data?.error) {
        // Comments disabled on the video is a common, expected case (403) —
        // surface it as a soft empty result rather than a hard error.
        const reason = data.error?.errors?.[0]?.reason
        if (reason === 'commentsDisabled') {
          return NextResponse.json({ comments: [], disabled: true })
        }
        return NextResponse.json({ error: 'YouTube API error on commentThreads: ' + (data.error?.message ?? JSON.stringify(data.error)) }, { status: 502 })
      }
      for (const item of data?.items ?? []) {
        const top = item?.snippet?.topLevelComment?.snippet
        if (!top) continue
        all.push({
          id: item.id,
          author: top.authorDisplayName ?? 'Unknown',
          text: (top.textDisplay ?? '').trim(),
          likeCount: Number(top.likeCount ?? 0),
          publishedAt: top.publishedAt ?? '',
          replyCount: Number(item.snippet?.totalReplyCount ?? 0),
        })
      }
      pageToken = data?.nextPageToken ?? ''
      if (!pageToken || all.length >= 300) break
    }

    const comments = all
      .filter(c => c.text.length >= MIN_INSIGHTFUL_LENGTH)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, limit)

    return NextResponse.json({ comments })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
