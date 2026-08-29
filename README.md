# LocalTools

LocalTools is a static, browser-first privacy PWA with seven tools: Compress Image, Resize Image, Convert Image, Merge PDF, Extract PDF Pages, CSV Viewer, and JSON Formatter. Files are processed in browser memory; nothing is uploaded or persisted by default.

There is no backend, account, database, telemetry, runtime CDN, remote font, or external API. The service worker caches only the app shell and known assets/routes. Safety thresholds are defined in `src/safety.ts` (100 MB per file, 250 MB PDF aggregate, 50 MB CSV, 250,000 CSV rows, 1,000 PDF pages).

## Development and release verification

```sh
npm ci
npm run lint
npm run typecheck
npm test
BASE_PATH=/localtools/ npm run build
npm run test:e2e
npm audit --omit=dev
```

`npm run test:e2e` builds production at `/localtools/`, serves it with the strict static server, and runs Chromium with one worker. It verifies direct routes, local image/PDF/CSV/JSON flows, responsive layout, screenshots in ignored `artifacts/qa/`, offline shell behavior, and privacy-safe processing. GitHub Pages runs the same checks before uploading `dist`; `BASE_PATH` remains configurable.

Physical iOS, Firefox, and WebKit behavior is UNVERIFIED. Browser codec availability varies, and PDFs must be readable by pdf-lib.
