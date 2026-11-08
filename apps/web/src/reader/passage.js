import { normalizeCitationAttribution } from '../lib/citationAttribution.js'

const finite = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null
const lineEnd = row => Math.max(finite(row.start_ms) ?? 0, finite(row.end_ms) ?? finite(row.start_ms) ?? 0)

// Windows select complete published lines; a missing end selects a point.
export function passageSegments(segments, startMs, endMs) {
  const start = finite(startMs)
  const end = finite(endMs)
  if (start === null) return []
  return (Array.isArray(segments) ? segments : []).filter(row => {
    const from = finite(row.start_ms)
    if (from === null) return false
    const to = lineEnd(row)
    return end !== null && end > start
      ? from < end && (to > start || (to === from && from >= start))
      : from <= start && (to > start || (to === from && to === start))
  }).slice().sort((a, b) => Number(a.start_ms) - Number(b.start_ms))
}

// Copy only public identity/date values; timeline membership qualifies attribution.
export function passageParticipantPairs(timeline, videoId, startMs, endMs) {
  if (!videoId) return []
  const seen = new Set()
  return (Array.isArray(timeline) ? timeline : [])
    .filter(row => (row.video_id ?? row.videoId) === videoId)
    .filter(row => {
      const start = finite(row.start_ms ?? row.startMs ?? row.timestamp_ms ?? row.timestampMs)
      const end = finite(row.end_ms ?? row.endMs)
      return start !== null && (endMs > startMs
        ? start < endMs && (end === null || end > startMs)
        : start <= startMs && (end === null || end > startMs || end === startMs))
    })
    .sort((a, b) => Number(a.start_ms ?? a.startMs ?? a.timestamp_ms ?? a.timestampMs) - Number(b.start_ms ?? b.startMs ?? b.timestamp_ms ?? b.timestampMs))
    .flatMap(row => {
      const normalized = normalizeCitationAttribution(row)
      if (!normalized.speakerLabel) return []
      const pair = { name: normalized.speakerLabel, date: normalized.recordedDateLabel || null }
      const key = JSON.stringify(pair)
      if (seen.has(key)) return []
      seen.add(key)
      return [pair]
    })
}

export function buildPassageSelection({ segments, timeline, videoId, startMs, endMs, exactLine, title = '', annotationId = null, clipId = null, buildUrl }) {
  const rows = exactLine ? [exactLine] : passageSegments(segments, startMs, endMs)
  if (!rows.length) return null
  const start = Math.min(...rows.map(row => Number(row.start_ms)))
  const end = Math.max(...rows.map(lineEnd))
  const participantPairs = passageParticipantPairs(timeline, videoId, start, end)
  const attribution = participantPairs.length
    ? `Public session timeline: ${participantPairs.map(pair => `${pair.name} — ${pair.date || 'Date unavailable'}`).join('; ')}`
    : 'Public session timeline: participant and date unavailable'
  return {
    title, startMs: start, endMs: end,
    text: rows.map(row => String(row.text ?? '')).join(' '),
    videoId, annotationId, clipId,
    rawWindow: { startMs: finite(startMs), endMs: finite(endMs) },
    participantPairs, attribution,
    provenance: { label: 'Published transcript', qualification: 'Attribution follows the published session timeline.' },
    url: buildUrl({ source: 'video', videoId, seekMs: start, annotationId }),
  }
}

// An object boundary clears source data; media changes within it retain the pin.
export function retainPassageSelection(previous, objectId) {
  return previous?.objectId === objectId ? previous : null
}
