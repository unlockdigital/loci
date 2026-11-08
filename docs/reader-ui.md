# Public Search and Evidence reader

Search results group object identity, timestamp, transcript excerpt and the evidence-opening action. Scene descriptions and retrieval explanations remain available in a disclosure. The additive `search_page` query parameter and navigation history retain the originating query, collection filter, page and scroll position when returning from Evidence.

Evidence pairs the object with its recording and places the selected passage beneath both media. Phone layouts retain deliberate model loading; short landscape keeps simultaneous comparison with a full passage reader. Desktop viewer height follows the recording and its controls. Enlargement preserves the mounted Canvas through modal entry, exit and rotation.

An explicit annotation, clip or transcript selection captures a passage snapshot. Playback and transport seeking preserve that snapshot and its spatial annotation. Scrubbing cancels guided playback boundaries while the current-time clip highlight follows the recording. Passage citations use complete overlapping transcript lines, their recording identity and ordered public timeline participant/date associations. Attribution remains qualified as session-timeline information. Related interpretations remain individually selectable.

Copy passage, Copy citation and Copy passage link have separate payloads. Passage links restore the selected start time; the existing playback-link action uses the current playhead. Links preserve the established URL contract and restore a start location rather than encoding a complete selected range. Clipboard failure provides a selectable manual-copy field.

Published timed transcript lines supply a WebVTT caption track. Deployments with a Content Security Policy must permit `blob:` caption/media URLs in the applicable media policy. The interface preserves source-provided text and makes no additional transcription-review or speaker-verification claim.

The change uses existing public API contracts and requires no database migration or dependency update. Site homepages, branding, collection assets and operational configuration remain deployment concerns.

From `apps/web`, run the normal checks:

```sh
npm test
npm run build -- --outDir dist-ci
npm run test:browser
```

The reader and Search-return browser suites use generated fixtures. Their controlled API routing supports both the default development API address and same-origin builds. `READER_TEST_DIST` can select another build directory. Physical Safari, touch, assistive-technology and enlarged-text validation remain useful release checks alongside the automated Chromium coverage.

Desktop model loading starts automatically, including lower-memory and narrow fine-pointer desktop windows. Phone/tablet detection retains deliberate loading. Memory, Data Saver and available network estimates choose the constrained or standard server-advertised representation independently of that admission decision. The chosen URL stays stable for the mounted viewer, preserving the Canvas and camera during resizing and connection changes. Existing API capability validation, required-tier failure behavior and default-off hosting switch remain authoritative.
