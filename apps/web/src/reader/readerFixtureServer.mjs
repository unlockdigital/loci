import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = resolve(fileURLToPath(new URL('../../tests/browser/', import.meta.url)))
const webRoot = resolve(here, '../..')
const distRoot = resolve(webRoot, process.env.READER_TEST_DIST || 'dist-ci')
const mediaPath = resolve(here, '../fixtures/synthetic-12s.mp4')
const modelPath = resolve(here, '../fixtures/synthetic-cube.glb')
const posterPath = resolve(here, '../fixtures/synthetic-poster.png')
const expectedModelSha256 = 'ca427dd09cdabf6dec4779683a5525dba14a21047c4c8929451c5f90ebb0b17a'
const actualModelSha256 = createHash('sha256').update(readFileSync(modelPath)).digest('hex')
assert.equal(actualModelSha256, expectedModelSha256, 'synthetic browser model checksum changed')
const mediaBytes = readFileSync(mediaPath)
const posterBytes = readFileSync(posterPath)

function mp4TrackHandlers(bytes) {
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf'])
  const handlers = []
  const visit = (start, end) => {
    for (let offset = start; offset + 8 <= end;) {
      let size = bytes.readUInt32BE(offset)
      const type = bytes.toString('ascii', offset + 4, offset + 8)
      let headerSize = 8
      if (size === 1) {
        if (offset + 16 > end) throw new Error(`truncated extended MP4 box: ${type}`)
        const largeSize = bytes.readBigUInt64BE(offset + 8)
        if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`MP4 box is too large: ${type}`)
        size = Number(largeSize)
        headerSize = 16
      } else if (size === 0) {
        size = end - offset
      }
      if (size < headerSize || offset + size > end) throw new Error(`invalid MP4 box size: ${type}`)
      const payload = offset + headerSize
      if (type === 'hdlr' && payload + 12 <= offset + size) {
        handlers.push(bytes.toString('ascii', payload + 8, payload + 12))
      } else if (containers.has(type)) {
        visit(payload, offset + size)
      }
      offset += size
    }
  }
  visit(0, bytes.length)
  return handlers
}

assert.deepEqual(mp4TrackHandlers(mediaBytes), ['vide'], 'synthetic browser media must contain one video track and no audio')
assert.equal(posterBytes.toString('ascii', 1, 4), 'PNG', 'synthetic browser poster must be PNG')
assert.ok(existsSync(resolve(distRoot, 'index.html')), 'run the CI production build before the browser regression')

const objectSlug = 'synthetic-object'
const annotationId = 'synthetic-annotation-01'
const overlappingAnnotationId = 'synthetic-annotation-00'
const firstClip = { id: 'synthetic-clip-a', title: 'First linked window', start_ms: 2000, end_ms: 4000 }
const secondClip = { id: 'synthetic-clip-b', title: 'Second linked window', start_ms: 6000, end_ms: 9000 }
const transcriptSegments = Array.from({ length: 48 }, (_, index) => {
  const startMs = index * 250
  const text = startMs === 6000
    ? 'Synthetic segment two, aligned to the second clip.'
    : startMs === 3000
      ? 'Later line at three seconds inside the annotation window.'
      : startMs === 3500
        ? 'Later line at three and a half seconds inside the annotation window.'
        : startMs === 2000
          ? 'Synthetic segment one, aligned to the first clip.'
          : `Synthetic transcript line ${index + 1} for scroll tracking.`
  return {
    position: index,
    start_ms: startMs,
    end_ms: startMs + 250,
    text,
  }
})
const privateFields = ['raw_text_observed', 'presenter_name_raw', 'raw_payload_json', 'source_video_path', 'private_author_notes']
const failures = []
const consoleMessages = []
const requestDiagnostics = []
const apiDiagnostics = []
let browserOrigin = ''
const fixture = (url, requestParams = {}) => {
  const requestedClipId = requestParams.clip || requestParams.clip_id || ''
  const requestedAnnotationId = requestParams.annotation || requestParams.annotation_id || ''
  const activeClip = requestedClipId === secondClip.id ? secondClip : firstClip
  const isClipFocus = requestedClipId === activeClip.id
  const isAnnotationFocus = requestedAnnotationId === annotationId || requestedAnnotationId === overlappingAnnotationId
  const initialSeek = isClipFocus ? activeClip.start_ms : isAnnotationFocus ? firstClip.start_ms : 0
  const annotation = { id: annotationId, title: 'Vessel rim annotation', description: 'A generated spatial note.', start_ms: 2000, end_ms: 9000, point_x: 0, point_y: 0, point_z: 1, normal_x: 0, normal_y: 0, normal_z: 1, related_clip_ids: [firstClip.id, secondClip.id] }
  const overlappingAnnotation = { id: overlappingAnnotationId, title: 'Synthetic body annotation', description: 'A second generated spatial note linked to the same clips.', start_ms: 2000, end_ms: 9000, point_x: -0.65, point_y: 0.35, point_z: 1, normal_x: 0, normal_y: 0, normal_z: 1, related_clip_ids: [firstClip.id, secondClip.id] }
  return {
    canonical_url: `http://127.0.0.1:${server.address().port}/evidence/objects/${objectSlug}${isClipFocus ? `?clip=${activeClip.id}` : isAnnotationFocus ? `?annotation=${annotationId}` : ''}`,
    page: { title: 'Synthetic annotation: vessel rim', summary: 'Generated browser regression fixture.' },
    object: { id: 'synthetic-object-id', title: 'Synthetic Vessel', summary: 'Generated locally for CI.', external_url: null, project_slug: 'synthetic-collection', project_name: 'Synthetic Collection' },
    focus: { source: isClipFocus ? 'clip' : isAnnotationFocus ? 'annotation' : 'default', object_id: 'synthetic-object-id', annotation_id: isAnnotationFocus ? annotationId : null, clip_id: isClipFocus ? activeClip.id : null, video_id: 'synthetic-video-a', seek_ms: initialSeek, start_ms: isClipFocus || isAnnotationFocus ? activeClip.start_ms : 0, end_ms: isClipFocus || isAnnotationFocus ? activeClip.end_ms : 12000 },
    model: { model_url: `${browserOrigin}/fixtures/synthetic-cube.glb`, default_camera: null, selected_camera: null },
    playback: { video_id: 'synthetic-video-a', video_title: 'Synthetic camera pan', video_stream_url: `${browserOrigin}/fixtures/synthetic-12s.mp4`, seek_ms: initialSeek, window_start_ms: firstClip.start_ms, window_end_ms: secondClip.end_ms, duration_ms: 12000 },
    selected_annotation: isClipFocus ? null : isAnnotationFocus ? (requestedAnnotationId === overlappingAnnotationId ? overlappingAnnotation : annotation) : null,
    selected_clip: null,
    annotations: [annotation, overlappingAnnotation],
    clips: [firstClip, secondClip],
    transcript: { video_id: 'synthetic-video-a', segments: transcriptSegments },
    citation_attribution: { speaker_label: 'Synthetic Speaker', session_date: '2026-01-02', session_date_text: 'January 2, 2026', session_date_precision: 'day', attribution_mode: 'named' },
    citation_attribution_timeline: [{ video_id: 'synthetic-video-a', start_ms: 0, end_ms: 12000, speaker_label: 'Synthetic Speaker', session_date: '2026-01-02', session_date_text: 'January 2, 2026' }],
  }
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' }
const server = createServer((req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost')
  if (requestUrl.pathname === '/fixtures/synthetic-cube.glb') {
    const model = readFileSync(modelPath)
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': model.length }); res.end(model); return
  }
  if (requestUrl.pathname === '/fixtures/synthetic-12s.mp4') {
    const stat = readFileSync(mediaPath)
    const range = req.headers.range
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', 'video/mp4')
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (!match) { res.writeHead(416); res.end(); return }
      const start = Number(match[1]); const end = Math.min(match[2] ? Number(match[2]) : stat.length - 1, stat.length - 1)
      if (start > end || start >= stat.length) { res.writeHead(416); res.end(); return }
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.length}`, 'Content-Length': end - start + 1 })
      res.end(stat.subarray(start, end + 1)); return
    }
    res.writeHead(200, { 'Content-Length': stat.length }); res.end(stat); return
  }
  if (requestUrl.pathname.includes('/api/v1/public/evidence/objects/')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fixture(requestUrl, Object.fromEntries(requestUrl.searchParams)))); return }
  let filePath = resolve(distRoot, `.${requestUrl.pathname}`)
  if (!filePath.startsWith(`${distRoot}${sep}`) || !existsSync(filePath)) filePath = resolve(distRoot, 'index.html')
  res.setHeader('Content-Type', contentTypes[extname(filePath)] || 'application/octet-stream')
  createReadStream(filePath).pipe(res)
})


export async function startReaderFixture(port = 8801) {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done) })
  browserOrigin = `http://127.0.0.1:${server.address().port}`
  return { origin: browserOrigin, close: () => new Promise((done) => server.close(done)) }
}

// Default development builds and same-origin release builds share this fixture.
export async function routeReaderDevelopmentApi(page, origin) {
  const redirected = []
  await page.route(/^https?:\/\/(?:localhost|127\.0\.0\.1):8000\/api\//, async route => {
    const request = route.request()
    const source = new URL(request.url())
    redirected.push({ url: request.url(), method: request.method() })
    const cors = { 'access-control-allow-origin': new URL(origin).origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const response = await route.fetch({ url: new URL(source.pathname + source.search, origin).href })
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } })
  })
  return redirected
}
