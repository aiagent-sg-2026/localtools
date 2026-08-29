import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const base = normalizeBase(process.env.BASE_PATH || '/');
const pageNames = ['image/compress', 'image/resize', 'image/convert', 'pdf/merge', 'pdf/extract', 'data/csv-viewer', 'developer/json-formatter'];
for (const name of pageNames) {
  const flat = path.join(root, `${name}.html`);
  const directory = path.join(root, name);
  if (fs.existsSync(flat)) { fs.mkdirSync(directory, { recursive: true }); fs.renameSync(flat, path.join(directory, 'index.html')); }
}
for (const file of walk(root).filter((entry) => entry.endsWith('.html'))) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replaceAll('src="/', `src="${base}`).replaceAll('href="/', `href="${base}`);
  content = content.replaceAll(`${base}${base.slice(1)}`, base).replaceAll(`${base}${base}`, base);
  fs.writeFileSync(file, content);
}
const htmlRoutes = ['/', ...pageNames.map((name) => `/${name}/`)];
const routePaths = htmlRoutes.flatMap((route) => {
  const full = base.replace(/\/$/, '') + route;
  return route === '/' ? [full] : [full, full.replace(/\/$/, '')];
});
const htmlIndexFiles = ['index.html', ...pageNames.map((name) => `${name}/index.html`)].map((file) => path.join(root, file));
const assetFiles = walk(root).filter((file) => file.startsWith(path.join(root, 'assets') + path.sep)).concat(['favicon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'robots.txt'].map((file) => path.join(root, file))).filter((file) => fs.existsSync(file)).sort();
const cacheInputs = [...htmlIndexFiles, ...assetFiles].map((file) => ({ path: base + path.relative(root, file).replaceAll(path.sep, '/'), content: fs.readFileSync(file) })).sort((a, b) => a.path.localeCompare(b.path));
const identity = crypto.createHash('sha256').update(base);
for (const input of cacheInputs) identity.update(input.path).update(input.content);
const version = `localtools-${identity.digest('hex').slice(0, 24)}`;
const assetPaths = cacheInputs.map((input) => input.path);
const fallback = base + 'index.html';
const sw = `const VERSION=${JSON.stringify(version)},BASE=${JSON.stringify(base)},FALLBACK=${JSON.stringify(fallback)},ROUTES=${JSON.stringify(routePaths)},ASSETS=${JSON.stringify(assetPaths)};\n` +
  'const isKnownRoute=(url)=>ROUTES.includes(url.pathname),isKnownAsset=(url)=>ASSETS.includes(url.pathname);\n' +
  'self.addEventListener("install",event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll([...ASSETS,...ROUTES]))));\n' +
  'self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\n' +
  'self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();if(event.data?.type==="GET_VERSION"&&event.ports[0])event.ports[0].postMessage(VERSION)});\n' +
  'self.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==self.location.origin)return;if(request.mode==="navigate"&&isKnownRoute(url)){event.respondWith(fetch(request).catch(()=>caches.match(request).then(hit=>hit||caches.match(FALLBACK))))}else if(isKnownAsset(url)){event.respondWith(caches.match(request).then(hit=>hit||fetch(request)))}});\n';
fs.writeFileSync(path.join(root, 'sw.js'), sw);
const manifestPath = path.join(root, 'manifest.webmanifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.start_url = base; manifest.scope = base;
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: icon.src.startsWith('/') ? base.replace(/\/$/, '') + icon.src : icon.src }));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const sitemapPath = path.join(root, 'sitemap.xml');
if (process.env.SITE_URL) { const site = new URL(process.env.SITE_URL); if (!['http:', 'https:'].includes(site.protocol)) throw Error('SITE_URL must be an absolute HTTP(S) URL.'); const origin = site.href.replace(/\/$/, ''); const locs = htmlRoutes.map((route) => origin + base.replace(/\/$/, '') + route); fs.writeFileSync(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`).join('')}</urlset>`); } else if (fs.existsSync(sitemapPath)) fs.rmSync(sitemapPath);
function normalizeBase(value) { const trimmed = value.trim(); return !trimmed || trimmed === '/' ? '/' : `/${trimmed.replace(/^\/+|\/+$/g, '')}/`; }
function escapeXml(value) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character])); }
function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { const current = path.join(directory, entry.name); return entry.isDirectory() ? walk(current) : [current]; }); }
