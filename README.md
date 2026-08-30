# LocalTools

LocalTools is a static, browser-first toolbox for private file work. The core promise is simple:

> Private tools that run entirely in your browser. No uploads. No accounts. Your files stay on your device.

V1 includes seven tools:

- Compress Image — JPG, PNG, and feature-detected WebP output.
- Resize Image — dimensions, aspect-ratio lock, presets, preview, download.
- Convert Image — JPG/PNG/WebP where browser encoding support exists.
- Merge PDF — local multi-PDF merge with reorder/remove controls.
- Extract PDF Pages — expressions such as `3-5,8,11-15`.
- CSV Viewer — Worker parsing, search, sort, column filter/visibility, pagination, filtered CSV export.
- JSON Formatter — file/paste input, pretty-print, minify, validate, copy, and download.

## Architecture and privacy

The production site is only static HTML, CSS, JavaScript, locally bundled dependencies, a CSV Web Worker, and a service worker. There is no backend, database, login, account, telemetry, analytics, runtime CDN, remote font, API key, or remote file-processing API.

Selected files are read into browser memory, processed locally, and exposed as downloadable `Blob` results. User files and generated results are not persisted by default. The service worker caches only a generated allowlist of application routes/assets; it does not runtime-cache arbitrary requests, user files, or Blob URLs.

The central catalogue is `src/registry.ts`. Homepage search, categories, route metadata, and tool discovery derive from that registry instead of separate hardcoded catalogues.

Heavy CSV parsing runs in `src/workers/csv.worker.ts`. PDF support uses a locally bundled lazy `pdf-lib` chunk. Image work uses browser canvas/image APIs.

## Safety limits

Browser RAM varies significantly across phones and desktops, so V1 uses conservative configurable thresholds from `src/safety.ts` rather than claiming unlimited file sizes. Current defaults are 100 MB per file, 250 MB aggregate PDF input, 50 MB CSV input, 250,000 CSV rows, and 1,000 PDF pages.

## Local development

```sh
npm ci
npm run dev
```

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e:cross-browser
npm audit --omit=dev
```

The release E2E matrix runs Chromium, Firefox, and WebKit against the production static build with one worker per browser. It covers real image/PDF/CSV/JSON processing and downloads, direct static routes, 100,000-row CSV stress, mobile layout, request-level privacy checks, service-worker update verification, and offline behavior where Playwright's browser harness can represent it accurately. Chromium also runs the CDP-backed installability/manifest assertion. Firefox verifies service-worker cached-route navigation offline. Playwright WebKit currently blocks forced-offline navigation, lazy chunks, and Workers before service-worker interception, so those two forced-offline cases are explicit WebKit skips rather than false passes. QA screenshots are generated under ignored `artifacts/qa/`.

## Production build

Repository Pages example:

```sh
BASE_PATH=/localtools/ npm run build
```

Custom-domain/root example:

```sh
BASE_PATH=/ npm run build
```

The production output is `dist/`. Tool HTML is emitted as real directory-index files such as `dist/image/compress/index.html`, so direct navigation and refresh work without server rewrite rules.

Set an absolute `SITE_URL` only when a real production origin is known. When supplied, the post-build step generates an absolute sitemap; without it, no sitemap is emitted, avoiding a fabricated canonical domain.

## GitHub Pages

`.github/workflows/pages.yml` derives the repository base path from `${{ github.event.repository.name }}`, runs install/lint/typecheck/unit/production E2E gates, creates a final build, uploads `dist`, and deploys with GitHub Pages. No application credentials are required.

## PWA and offline behavior

After an online prime, the homepage and all seven V1 tools are cached as an application allowlist and can run offline. Updates do not call `skipWaiting()` during install. A new worker waits, LocalTools shows `Update now`, and activation occurs only after the user chooses it; an updating state is shown before reload and a timeout message handles failure.

Installation is optional. The browser URL remains immediately useful without installing the PWA.

## Browser support philosophy

LocalTools uses progressive enhancement and feature detection. Chromium, Firefox, and Playwright WebKit are automated release browsers in this repository, and GitHub Pages deployment is blocked until all required matrix jobs pass. WebP encoding and install-related browser surfaces still depend on browser capability. Chromium alone runs the CDP-backed app-manifest installability assertion. Playwright WebKit's forced-offline emulation cannot currently verify service-worker route recovery or cold lazy-chunk/Worker loading, so those cases remain explicitly unverified rather than being reported as passes. Physical iOS Safari / Add to Home Screen remains a separate device-level verification target.

## Known limitations

- Password-protected or malformed PDFs may not be readable by `pdf-lib`.
- Image encoding behavior depends on the browser; PNG is treated as lossless and does not expose a fake JPEG-style quality setting.
- Very large files can exceed browser/device memory even below configured thresholds on constrained devices.
- V1 intentionally has no cloud persistence, account sync, OCR, audio/video processing, or AI/backend integration.
