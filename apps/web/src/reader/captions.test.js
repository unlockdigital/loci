import test from 'node:test'
import assert from 'node:assert/strict'
import { publishedTranscriptVtt } from './captions.js'

test('published captions retain exact milliseconds, chronological text and long recording hours', () => {
  const source = [{ start_ms: 3600001, end_ms: 3602003, text: 'Later passage' }, { start_ms: 10230, end_ms: 12999, text: 'First passage' }]
  assert.equal(publishedTranscriptVtt(source), 'WEBVTT\n\n00:00:10.230 --> 00:00:12.999\nFirst passage\n\n01:00:00.001 --> 01:00:02.003\nLater passage\n')
  assert.equal(source[0].text, 'Later passage')
})

test('caption cue content displays source markup literally and keeps blank lines inside one cue', () => {
  const result = publishedTranscriptVtt([{ start_ms: 0, end_ms: 1000, text: '<v Name>A & B\n\n<00:00:00.500> --> next' }])
  assert.ok(result.includes('&lt;v Name&gt;A &amp; B\n&lt;00:00:00.500&gt; --&gt; next'))
  assert.equal(result.match(/\n\n/g).length, 1)
})

test('absent or invalid published timing never fabricates caption cues', () => {
  assert.equal(publishedTranscriptVtt(null), '')
  assert.equal(publishedTranscriptVtt([{ start_ms: null, end_ms: 1000, text: 'Unknown start' }, { start_ms: 1, end_ms: 1, text: 'Empty range' }, { start_ms: -1, end_ms: 1, text: 'Negative' }, { start_ms: 0, end_ms: 2, text: '' }]), '')
})
