# LocalTools

LocalTools is a static PWA of seven private browser tools: Compress Image, Resize Image, Convert Image, Merge PDF, Extract PDF Pages, CSV Viewer, and JSON Formatter.

## Privacy and browser philosophy

There is no backend, account, upload, cloud, analytics, telemetry, remote font, runtime CDN, or API key. Files are read and processed in browser memory, then offered as a Blob download. User documents are not persisted by default. The service worker caches app assets only. Safety thresholds are intentionally conservative and can be found in `src/safety.ts`.

## Architecture

Vite + TypeScript + semantic HTML + vanilla TS + modern CSS. `src/registry.ts` is the catalogue SSOT. Shared shell, privacy, safety, download, error, and utility helpers are used by route modules. `pdf-lib` and `papaparse` are bundled/lazy loaded locally; image work uses native Canvas APIs.

## Development and release

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

GitHub Pages can use `BASE_PATH=/localtools/ npm run build`; the workflow uploads `dist` without credentials. A future custom domain can use the default root base. The app supports offline navigation after an online prime and has a visible, user-confirmed update flow.

## Known limitations

Browser codec availability varies, PDF files must be readable by pdf-lib, and CSV display intentionally renders the first 100 matching rows while retaining data in memory. iOS real-device behavior is UNVERIFIED; a 390×844 browser viewport is covered by automated checks.
