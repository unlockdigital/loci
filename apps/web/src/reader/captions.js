function timestamp(value) {
  const ms = Math.floor(value)
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor(ms / 60000) % 60
  const seconds = Math.floor(ms / 1000) % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

// Reuse published text/times as captions, preserving literal text safely in VTT.
export function publishedTranscriptVtt(segments) {
  const cues = (Array.isArray(segments) ? segments : []).filter(segment => (
    segment.start_ms != null && segment.end_ms != null
    && Number.isFinite(Number(segment.start_ms)) && Number(segment.start_ms) >= 0
    && Number.isFinite(Number(segment.end_ms)) && Number(segment.end_ms) > Number(segment.start_ms)
    && typeof segment.text === 'string' && segment.text.trim()
  )).slice().sort((a, b) => Number(a.start_ms) - Number(b.start_ms)).map(segment => {
    const text = segment.text.trim().replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `${timestamp(Number(segment.start_ms))} --> ${timestamp(Number(segment.end_ms))}\n${text}`
  })
  return cues.length ? `WEBVTT\n\n${cues.join('\n\n')}\n` : ''
}
