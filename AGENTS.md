# LocalTools repository rules

LocalTools is a fully static, browser-first privacy toolbox. Production must remain useful without any backend, account, database, API key, telemetry, runtime CDN, remote font, or remote file-processing service.

`src/registry.ts` is the single source of truth for the tool catalogue. Add a new tool through the registry plus its module/page/tests; do not create independent homepage/navigation/search catalogues.

User files must be processed locally in browser memory and must not be uploaded or silently persisted. Never cache user-selected files, generated results, Blob URLs, or arbitrary runtime requests in the service worker. Treat file content and filenames as untrusted input; do not render them as raw HTML or execute uploaded text.

The site must build as real static directory routes and support configurable `BASE_PATH` for GitHub Pages or a root custom domain. PWA updates must wait and require explicit user activation; offline support must include all V1 routes/tools after priming.

Release commands are:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `BASE_PATH=/localtools/ npm run build`
- `npm run test:e2e:cross-browser`
- `npm audit --omit=dev`

Definition of done requires green unit gates and the required Chromium/Firefox/WebKit production E2E matrix, direct-route refresh, real local file-processing journeys, 100k CSV stress, browser-appropriate offline evidence, network-privacy assertions, mobile/accessibility checks, service-worker update verification, reproducible static build checks, accurate README, clean Git status, and no secrets. Browser-specific skips must describe a real harness/capability limit and must never be used to hide a product failure.
