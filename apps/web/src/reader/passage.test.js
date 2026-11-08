import test from 'node:test'
import assert from 'node:assert/strict'
import { passageSegments } from './passage.js'
test('selected passage preserves complete overlapping lines in chronological order', () => {
  const segments = [{ start_ms: 3000, end_ms: 4000, text: 'third' }, { start_ms: 0, end_ms: 1000, text: 'outside' }, { start_ms: 1500, end_ms: 2500, text: 'first' }, { start_ms: 2500, end_ms: 3000, text: 'second' }, { start_ms: 4000, end_ms: 5000, text: 'outside end' }]
  assert.deepEqual(passageSegments(segments, 2000, 4000).map(s => s.text), ['first', 'second', 'third'])
  assert.equal(segments[0].text, 'third')
})
test('point selection includes its containing line and empty transcripts remain empty', () => {
  assert.deepEqual(passageSegments([], 0, null), [])
  assert.deepEqual(passageSegments([{ start_ms: 0, end_ms: 1000 }], 250, null), [{ start_ms: 0, end_ms: 1000 }])
})

import { buildPassageSelection, passageParticipantPairs, retainPassageSelection } from './passage.js'
const rows = [
  { start_ms: 100, end_ms: 1000, text: 'Opening "quoted" line. '.repeat(90) },
  { start_ms: 1000, end_ms: 2500, text: 'Complete closing line.' },
  { start_ms: 5000, end_ms: 6000, text: 'Disjoint interpretation.' },
]
const record = (name, start, end, date = '2026-01-02', mode = 'named') => ({ video_id: 'fixture-video', start_ms: start, end_ms: end, speaker_label: name, session_date: date, attribution_mode: mode })
const buildUrl = ({ videoId, seekMs, source }) => `${source}/${videoId}?t=${seekMs}`
const select = (extra = {}) => buildPassageSelection({ segments: rows, timeline: [], videoId: 'fixture-video', startMs: 500, endMs: 2000, buildUrl, ...extra })

test('full quotation and range cover complete boundary lines while preserving raw window', () => {
  const result = select()
  assert.equal(result.text, rows.slice(0, 2).map(row => row.text).join(' '))
  assert.ok(result.text.length > 1500)
  assert.deepEqual([result.startMs, result.endMs], [100, 2500])
  assert.deepEqual(result.rawWindow, { startMs: 500, endMs: 2000 })
  assert.equal(result.url, 'video/fixture-video?t=100')
})

test('timeline pairs retain chronological identity/date associations and omit duplicates', () => {
  const timeline = [record('Fixture B', 1000, 2500), record('Fixture A', 100, 1000), record('Fixture A', 1500, 2500, '2026-02-03'), record('Fixture A', 200, 900), record('Outside', 5000, 6000)]
  const result = select({ timeline })
  assert.deepEqual(result.participantPairs, [
    { name: 'Fixture A', date: 'January 2, 2026' },
    { name: 'Fixture B', date: 'January 2, 2026' },
    { name: 'Fixture A', date: 'February 3, 2026' },
  ])
  assert.match(result.attribution, /^Public session timeline:/)
})

test('redacted and unknown identities yield honest empty attribution', () => {
  const timeline = ['withheld', 'anonymous', 'unavailable'].map(mode => record('Excluded fixture', 0, 3000, undefined, mode))
  timeline.push(record('', 0, 3000), { ...record('Other recording', 0, 3000), video_id: 'other' })
  assert.deepEqual(select({ timeline }).participantPairs, [])
  assert.match(select({ timeline }).attribution, /unavailable/)
  assert.deepEqual(passageParticipantPairs(null, 'fixture-video', 0, 100), [])
})

test('null end selects a point, empty and invalid inputs yield no passage, zero-duration lines remain selectable', () => {
  assert.equal(select({ startMs: 1500, endMs: null }).text, rows[1].text)
  assert.equal(select({ segments: [] }), null)
  assert.equal(select({ startMs: null }), null)
  assert.equal(select({ startMs: 3000, endMs: 3000 }), null)
  const point = { start_ms: 0, end_ms: null, text: 'Fixture point' }
  assert.equal(select({ segments: [point], startMs: 0, endMs: 0 }).text, point.text)
  assert.equal(select({ segments: [point], startMs: 50, endMs: null }), null)
})

test('exact line selection preserves a single row even when another row overlaps', () => {
  const overlapping = { start_ms: 900, end_ms: 1600, text: 'Exact fixture line' }
  const result = select({ segments: [...rows, overlapping], startMs: 900, endMs: 1600, exactLine: overlapping })
  assert.equal(result.text, overlapping.text)
  assert.deepEqual([result.startMs, result.endMs], [900, 1600])
  assert.equal(select({ startMs: 500, endMs: 900, annotationId: 'fixture-annotation' }).text, rows[0].text)
})

test('snapshot keeps source, quote and link across playback and media changes and clears at object boundary', () => {
  const result = { ...select(), objectId: 'fixture-object' }
  const before = structuredClone(result)
  rows[0].text = 'Playback source refreshed'
  assert.deepEqual(retainPassageSelection(result, 'fixture-object'), before)
  assert.equal(retainPassageSelection(result, 'another-object'), null)
  assert.equal(retainPassageSelection(null, 'fixture-object'), null)
})

test('point selection on a boundary chooses the following complete line', () => {
  assert.deepEqual(passageSegments([{ start_ms: 0, end_ms: 1000 }, { start_ms: 1000, end_ms: 2000 }], 1000, null), [{ start_ms: 1000, end_ms: 2000 }])
})

test('known timeline identity with unknown date stays qualified and receives no inferred date', () => {
  const result = select({ timeline: [record('Fixture A', 0, null, '')] })
  assert.deepEqual(result.participantPairs, [{ name: 'Fixture A', date: null }])
  assert.match(result.attribution, /Date unavailable/)
  assert.equal(result.provenance.label, 'Published transcript')
})
