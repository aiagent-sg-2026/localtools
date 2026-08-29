# LocalTools

LocalTools is a static, browser-first privacy tools PWA. Files are processed in browser memory and are never uploaded or persisted by default. The central registry in `src/registry.ts` is the single source of truth for the seven tools and their catalogue metadata. Do not duplicate tool listings in page code.

There is no backend, account, database, telemetry, runtime CDN, remote font, or external API. The service worker caches app assets only; never cache user files or Blob URLs. PWA updates must be visible and user-confirmed. Keep GitHub Pages base paths configurable through `BASE_PATH`.

Verified commands: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Use `npm run dev` for local work. Do not commit secrets or generated user data.

Definition of done includes direct-load routes, offline shell/tools after priming, no processing-time network requests, accessible responsive UI, safety limits, tests, and an evidence report at `/tmp/localtools-codex-final.txt`.
