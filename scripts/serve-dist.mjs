import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const base = normalizeBase(process.env.BASE_PATH || '/');
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost')).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (!isWithinBase(pathname)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const relative = base === '/' ? pathname.slice(1) : pathname.slice(base.length);
  const requested = path.resolve(root, relative || 'index.html');
  if (requested !== root && !requested.startsWith(root + path.sep)) {
    response.writeHead(404).end('Not found');
    return;
  }

  let file = requested;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  const type = mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const body = fs.readFileSync(file);
  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Length': body.byteLength,
    'Content-Type': type,
  });
  if (request.method !== 'HEAD') response.end(body);
  else response.end();
});

server.listen(port, '127.0.0.1', () => console.log('dist server ' + port + ' ' + base));

function normalizeBase(value) {
  const trimmed = value.trim();
  return !trimmed || trimmed === '/' ? '/' : '/' + trimmed.replace(/^\/+|\/+$/g, '') + '/';
}

function isWithinBase(pathname) {
  return base === '/' ? pathname.startsWith('/') : pathname === base.slice(0, -1) || pathname.startsWith(base);
}
