import { useEffect, useState } from 'react'

export function Icon({ name }) {
  const paths = { play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />, pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />, speaker: <><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8q5 4 0 8M19 5q8 7 0 14"/></>, muted: <><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="m16 9 6 6m0-6-6 6"/></>, cc: <><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9a3 3 0 1 0 0 6m9-6a3 3 0 1 0 0 6"/></>, fullscreen: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/> }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

// State comes from the mounted media element, including native/fullscreen actions.
export default function RecordingControls({ videoRef, currentMs, durationMs, onSeek, formatClock, onTranscript }) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [captions, setCaptions] = useState(false)
  const [hasCaptions, setHasCaptions] = useState(false)
  const [captionState, setCaptionState] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    const update = () => { setPlaying(!video.paused && !video.ended); setMuted(video.muted); const tracks = Array.from(video.textTracks || []).filter(track => ['captions', 'subtitles'].includes(track.kind)); setHasCaptions(tracks.length > 0); setCaptions(tracks.some(track => track.mode === 'showing')); const elements = Array.from(video.querySelectorAll('track')).filter(track => ['captions', 'subtitles'].includes(track.kind)); setCaptionState(elements.some(track => track.readyState === 3) ? 'Captions could not load.' : elements.some(track => track.readyState === 1) ? 'Captions loading…' : tracks.length ? '' : 'Captions unavailable.') }
    // Tracks may be supplied after the video mounts. Capture their native
    // load/error events so late tracks receive the same observed feedback.
    const observer = new MutationObserver(update)
    observer.observe(video, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
    video.addEventListener('load', update, true)
    video.addEventListener('error', update, true)
    const events = ['play', 'pause', 'ended', 'volumechange', 'emptied', 'loadedmetadata']
    events.forEach((name) => video.addEventListener(name, update))
    const fullscreen = () => { video.controls = Boolean(document.fullscreenElement === video) }
    document.addEventListener('fullscreenchange', fullscreen)
    const webkitExit = () => { video.controls = false }
    video.addEventListener('webkitendfullscreen', webkitExit)
    video.textTracks?.addEventListener('addtrack', update)
    video.textTracks?.addEventListener('change', update)
    update()
    return () => {
      observer.disconnect()
      video.removeEventListener('load', update, true)
      video.removeEventListener('error', update, true)
      events.forEach((name) => video.removeEventListener(name, update))
      document.removeEventListener('fullscreenchange', fullscreen)
      video.removeEventListener('webkitendfullscreen', webkitExit)
      video.textTracks?.removeEventListener('addtrack', update)
      video.textTracks?.removeEventListener('change', update)
    }
  })
  return (
    <div className="reader-playback" aria-label="Recording controls">
      <button type="button" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'} onClick={async () => {
        const video = videoRef.current
        if (!video) return
        try { if (video.paused) await video.play(); else video.pause(); setError('') }
        catch { setError('Playback could not start. Try Play again.') }
      }}><Icon name={playing ? 'pause' : 'play'} /></button>
      <time>{formatClock(currentMs)}</time>
      <input type="range" aria-label="Seek recording" step={1000} aria-valuetext={`${formatClock(currentMs)} of ${formatClock(durationMs)}`} min="0" max={durationMs || 1} value={Math.min(currentMs, durationMs || 1)} disabled={!durationMs} onChange={(event) => onSeek({ seekMs: Number(event.target.value), source: 'transport' })} />
      <time>{formatClock(durationMs)}</time>
      <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted }}><Icon name={muted ? 'muted' : 'speaker'} /></button>
      {hasCaptions ? <button type="button" aria-label="Toggle captions" title="Toggle captions" aria-pressed={captions} onClick={() => { Array.from(videoRef.current?.textTracks || []).filter(track => ['captions', 'subtitles'].includes(track.kind)).forEach((track, index) => { track.mode = !captions && index === 0 ? 'showing' : 'hidden' }); setCaptions(!captions) }}><Icon name="cc" /></button> : null}
      <button type="button" aria-label="Enlarge video" title="Enlarge video" onClick={async () => {
        const video = videoRef.current
        if (!video) return
        video.controls = true
        try {
          if (video.requestFullscreen) await video.requestFullscreen()
          else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen()
          else setError('Use the native video controls to enlarge the recording.')
        } catch { setError('Use the native video controls to enlarge the recording.') }
      }}><Icon name="fullscreen" /></button>
      {captionState ? <span className="reader-caption-status" role="status">{captionState}{onTranscript ? <button type="button" onClick={onTranscript}>Open transcript</button> : null}</span> : null}
      {error ? <span role="status">{error}</span> : null}
    </div>
  )
}
