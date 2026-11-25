'use client'
// One player for both kinds of reference: an uploaded video (HTML5 <video>) or a YouTube link (IFrame API).
// The parent controls it through a ref: getTime / seek / play / pause / still.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { captureStill, type MotionReference } from '@/lib/references'

export type RefPlayerHandle = {
  getTime: () => number
  getDuration: () => number
  seek: (s: number) => void
  play: () => void
  pause: () => void
  isPaused: () => boolean
  /** JPEG of the current frame (uploads only; YouTube frames can't be captured). */
  still: () => Promise<Blob | null>
}

type Props = {
  reference: MotionReference
  src?: string                       // signed URL for uploads
  loop?: { start: number; end: number } | null
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  onTime?: (t: number) => void
  onMeta?: (m: { duration: number; width?: number; height?: number }) => void
  style?: React.CSSProperties
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }
let ytReady: Promise<any> | null = null
function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!ytReady) ytReady = new Promise(res => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT) }
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s)
  })
  return ytReady
}

export const RefPlayer = forwardRef<RefPlayerHandle, Props>(function RefPlayer(
  { reference, src, loop, autoPlay, muted, controls = true, onTime, onMeta, style }, handle,
) {
  const video = useRef<HTMLVideoElement>(null)
  const ytHost = useRef<HTMLDivElement>(null)
  const yt = useRef<any>(null)
  const loopRef = useRef(loop); loopRef.current = loop
  const onTimeRef = useRef(onTime); onTimeRef.current = onTime
  const isYT = reference.source === 'youtube'

  useImperativeHandle(handle, () => ({
    getTime: () => isYT ? (yt.current?.getCurrentTime?.() ?? 0) : (video.current?.currentTime ?? 0),
    getDuration: () => isYT ? (yt.current?.getDuration?.() ?? 0) : (video.current?.duration ?? 0),
    seek: s => { if (isYT) yt.current?.seekTo?.(s, true); else if (video.current) video.current.currentTime = s },
    play: () => { if (isYT) yt.current?.playVideo?.(); else video.current?.play().catch(() => {}) },
    pause: () => { if (isYT) yt.current?.pauseVideo?.(); else video.current?.pause() },
    isPaused: () => isYT ? yt.current?.getPlayerState?.() !== 1 : (video.current?.paused ?? true),
    still: () => (!isYT && video.current) ? captureStill(video.current) : Promise.resolve(null),
  }), [isYT])

  // YouTube player lifecycle
  useEffect(() => {
    if (!isYT || !reference.youtube_id || !ytHost.current) return
    let dead = false
    const el = document.createElement('div'); ytHost.current.appendChild(el)
    loadYT().then(YT => {
      if (dead) return
      yt.current = new YT.Player(el, {
        videoId: reference.youtube_id, width: '100%', height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: controls ? 1 : 0, start: Math.floor(loopRef.current?.start ?? 0), mute: muted ? 1 : 0, autoplay: autoPlay ? 1 : 0 },
        events: { onReady: (e: any) => onMeta?.({ duration: e.target.getDuration() }) },
      })
    })
    return () => { dead = true; try { yt.current?.destroy?.() } catch {} yt.current = null; el.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT, reference.youtube_id])

  // Time ticker: reports time and enforces the loop range for both kinds.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = isYT ? (yt.current?.getCurrentTime?.() ?? 0) : (video.current?.currentTime ?? 0)
      onTimeRef.current?.(t)
      const l = loopRef.current
      if (l && (t >= l.end || t < l.start - 0.25)) {
        if (isYT) yt.current?.seekTo?.(l.start, true); else if (video.current) video.current.currentTime = l.start
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [isYT])

  // Jump to the loop start whenever the range changes.
  useEffect(() => {
    if (!loop) return
    if (isYT) yt.current?.seekTo?.(loop.start, true); else if (video.current) video.current.currentTime = loop.start
  }, [loop?.start, loop?.end, isYT]) // eslint-disable-line react-hooks/exhaustive-deps

  const box: React.CSSProperties = { position: 'relative', width: '100%', background: '#000', borderRadius: 10, overflow: 'hidden', ...style }
  if (isYT) return <div style={{ ...box, aspectRatio: reference.format === 'short' ? '9 / 16' : '16 / 9' }} ref={ytHost} className="ref-yt" />
  return (
    <div style={box}>
      {src ? (
        <video
          ref={video} src={src} crossOrigin="anonymous" playsInline controls={controls} autoPlay={autoPlay} muted={muted}
          preload="auto"
          onLoadedMetadata={e => {
            const v = e.currentTarget
            onMeta?.({ duration: v.duration, width: v.videoWidth, height: v.videoHeight })
            if (loopRef.current) v.currentTime = loopRef.current.start
          }}
          style={{ width: '100%', display: 'block', maxHeight: style?.maxHeight ?? '70vh', background: '#000' }}
        />
      ) : <div style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', color: '#666', fontSize: 13 }}>Loading…</div>}
    </div>
  )
})
