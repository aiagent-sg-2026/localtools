import { expect, test, type Download, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';

const rawBase = process.env.E2E_BASE_PATH || '/localtools/';
const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
const routes = [
  'image/compress/', 'image/resize/', 'image/convert/',
  'pdf/merge/', 'pdf/extract/', 'data/csv-viewer/', 'developer/json-formatter/',
];

async function imageBuffer(page: Page, width = 120, height = 60) {
  const bytes = await page.evaluate(async ({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#176b5b'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff'; context.fillRect(10, 10, Math.max(1, width / 3), Math.max(1, height / 3));
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { width, height });
  return Buffer.from(bytes);
}

async function imageDimensions(page: Page, bytes: Buffer, type = 'image/png') {
  return page.evaluate(async ({ bytes, type }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type });
    const bitmap = await createImageBitmap(blob);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }, { bytes: Array.from(bytes), type });
}

async function pdfBuffer(widths: number[]) {
  const doc = await PDFDocument.create();
  widths.forEach((width, index) => {
    const page = doc.addPage([width, 400 + index]);
    page.drawText(`page-${width}`);
  });
  return Buffer.from(await doc.save());
}

async function downloadBytes(page: Page, buttonName: string | RegExp) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  return bytesFromDownload(download);
}

async function bytesFromDownload(download: Download) {
  const file = await download.path();
  if (!file) throw new Error('Download path unavailable');
  return fs.readFileSync(file);
}

async function controllerVersion(page: Page) {
  return page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return null;
    return new Promise<string>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => reject(new Error('version timeout')), 3000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(String(event.data)); };
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  });
}

async function primeServiceWorker(page: Page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }
}

function qa(page: Page, name: string) {
  return page.screenshot({ path: path.join('artifacts/qa', `${name}.png`), fullPage: true });
}

test.beforeAll(() => fs.mkdirSync('artifacts/qa', { recursive: true }));

test('homepage communicates privacy, four popular tools, seven category tools, search, and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Useful tools. Quietly local.' })).toBeVisible();
  await expect(page.getByText('No uploads. No accounts. Your files stay on your device.')).toBeVisible();
  await expect(page.locator('.popular .tool-card')).toHaveCount(4);
  await expect(page.locator('.category:not(.popular) .tool-card')).toHaveCount(7);
  for (const name of ['Compress Image', 'Merge PDF', 'CSV Viewer', 'JSON Formatter']) {
    await expect(page.locator('.popular').getByText(name, { exact: true })).toBeVisible();
  }
  await page.getByPlaceholder('Try “reduce picture size”').fill('reduce picture size');
  await expect(page.getByText('Compress Image', { exact: true }).first()).toBeVisible();
  await qa(page, 'homepage-desktop');
  expect(errors).toEqual([]);
});

test('all seven production directory routes load directly, reload, and unknown route is 404', async ({ page, request }) => {
  for (const route of routes) {
    const staticResponse = await request.get(`${base}${route}`);
    const staticHtml = await staticResponse.text();
    expect(staticResponse.status()).toBe(200);
    expect(staticHtml).toContain('apple-mobile-web-app-capable');
    expect(staticHtml).toContain('apple-touch-icon');
    expect(staticHtml).not.toContain('JPG, PNG, WebP, PDF, CSV, or JSON depending on the tool.');
    const response = await page.goto(`${base}${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/Private processing/)).toBeVisible();
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
  }
  expect((await request.get(`${base}not-a-route/`)).status()).toBe(404);
});

test('image compressor, resizer, and converter create valid local downloadable images', async ({ page }) => {
  const png = await imageBuffer(page, 120, 60);

  await page.goto(`${base}image/compress/`);
  await page.evaluate(({ bytes }) => {
    const file = new File([new Uint8Array(bytes)], 'fixture.png', { type: 'image/png' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    document.querySelector('.drop')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { bytes: Array.from(png) });
  await expect(page.locator('img.preview')).toBeVisible();
  await expect(page.getByText(/120×60/)).toBeVisible();
  await page.getByLabel('Output format').selectOption('image/png');
  await expect(page.getByText(/PNG output is lossless/)).toBeVisible();
  await page.getByRole('button', { name: 'Process image' }).click();
  await expect(page.getByText(/Saved|Larger by/)).toBeVisible();
  const compressed = await downloadBytes(page, 'Download');
  expect(compressed.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(await imageDimensions(page, compressed)).toEqual({ width: 120, height: 60 });
  await qa(page, 'image-result');

  await page.goto(`${base}image/resize/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Resize preset').selectOption('0.5');
  await expect(page.getByLabel('Width (px)')).toHaveValue('60');
  await expect(page.getByLabel('Height (px)')).toHaveValue('30');
  await page.getByLabel('Resize preset').selectOption('1');
  await page.getByLabel('Width (px)').fill('60');
  await expect(page.getByLabel('Height (px)')).toHaveValue('30');
  await page.getByRole('button', { name: 'Process image' }).click();
  const resized = await downloadBytes(page, 'Download');
  expect(await imageDimensions(page, resized)).toEqual({ width: 60, height: 30 });

  await page.goto(`${base}image/convert/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Output format').selectOption('image/png');
  await expect(page.getByText(/PNG output is lossless/)).toBeVisible();
  await expect(page.getByText('Quality', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Process image' }).click();
  const converted = await downloadBytes(page, 'Download');
  expect(converted.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('PDF merge reorders/removes and PDF extract preserves requested page order in downloads', async ({ page }) => {
  await page.goto(`${base}pdf/merge/`);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer([310]) },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer([320, 321]) },
    { name: 'c.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer([330]) },
  ]);
  await expect(page.getByText('a.pdf ·', { exact: false })).toBeVisible();
  expect(await page.locator('button.remove').evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44))).toBe(true);
  await page.getByRole('button', { name: 'Remove' }).nth(1).click();
  await page.getByRole('button', { name: 'Down' }).first().click();
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  const mergedBytes = await downloadBytes(page, 'Download merged PDF');
  const merged = await PDFDocument.load(mergedBytes);
  expect(merged.getPageCount()).toBe(2);
  expect(merged.getPages().map((item) => Math.round(item.getWidth()))).toEqual([330, 310]);
  await qa(page, 'pdf-selected');

  await page.goto(`${base}pdf/extract/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'four.pdf', mimeType: 'application/pdf', buffer: await pdfBuffer([300, 301, 302, 303]) });
  await page.getByPlaceholder('3,1-2').fill('3,1-2');
  await page.getByRole('button', { name: 'Extract pages' }).click();
  const extractedBytes = await downloadBytes(page, 'Download extracted PDF');
  const extracted = await PDFDocument.load(extractedBytes);
  expect(extracted.getPageCount()).toBe(3);
  expect(extracted.getPages().map((item) => Math.round(item.getWidth()))).toEqual([302, 300, 301]);
  await page.getByPlaceholder('3,1-2').fill('999');
  await page.getByRole('button', { name: 'Extract pages' }).click();
  await expect(page.locator('.error')).toContainText('between 1 and 4');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not pdf') });
  await expect(page.locator('.error')).toContainText('could not be opened');
});

test('CSV worker handles quoted UTF-8 data, sorting, filtering, columns, pagination, and filtered export', async ({ page }) => {
  const csv = [
    'name,note,kind',
    'Zoë,"hello, world",person',
    ...Array.from({ length: 150 }, (_, index) => `row-${String(index).padStart(3, '0')},value-${index},data`),
  ].join('\n');
  await page.goto(`${base}data/csv-viewer/`);
  await page.evaluate(() => {
    const state = window as Window & { __csvStates?: string[] }; state.__csvStates = [];
    const node = document.querySelector('.csv-status')!;
    new MutationObserver(() => state.__csvStates!.push(node.textContent || '')).observe(node, { childList: true, subtree: true, characterData: true });
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.csv-status')).toHaveText('CSV ready.');
  const csvStates = await page.evaluate(() => (window as Window & { __csvStates?: string[] }).__csvStates || []);
  expect(csvStates).toEqual(expect.arrayContaining(['Loading CSV…', 'Processing CSV…', 'CSV ready.']));
  await expect(page.getByText(/151 rows · 3 columns/)).toBeVisible();

  await page.getByPlaceholder('Search rows').fill('Zoë');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByPlaceholder('Search rows').fill('');
  await page.locator('select').selectOption('2');
  await page.getByPlaceholder('Column filter').fill('person');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const exported = await downloadBytes(page, 'Export filtered rows');
  const exportedText = exported.toString('utf8');
  expect(exportedText).toContain('name,note,kind');
  expect(exportedText).toContain('Zoë,"hello, world",person');

  await page.getByText('Show / hide columns').click();
  await page.locator('.checkbox-panel input').nth(1).uncheck();
  await expect(page.locator('thead th')).toHaveCount(2);
  await page.locator('.checkbox-panel input').nth(1).check();
  await expect(page.locator('thead th')).toHaveCount(3);

  await page.getByPlaceholder('Column filter').fill('');
  await page.locator('select').selectOption('');
  await page.getByRole('button', { name: 'name' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(51);
  await qa(page, 'csv-populated');
});

test('JSON formatter loads a file, validates without mutation, pretty-prints, minifies, copies, downloads, and clears', async ({ page, context }, testInfo) => {
  const chromiumClipboard = testInfo.project.name === 'chromium';
  if (chromiumClipboard) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  } else {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as typeof window & { __localtoolsCopied?: string }).__localtoolsCopied = value;
          },
        },
      });
    });
  }
  await page.goto(`${base}developer/json-formatter/`);
  const text = page.locator('textarea');
  await page.locator('input[type=file]').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"local","n":1}') });
  await expect(text).toHaveValue('{"hello":"local","n":1}');
  const beforeValidate = await text.inputValue();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Valid JSON.')).toBeVisible();
  expect(await text.inputValue()).toBe(beforeValidate);

  await page.getByRole('button', { name: 'Pretty-print' }).click();
  await expect(text).toContainText('');
  expect(await text.inputValue()).toContain('\n  "hello": "local"');
  await page.getByRole('button', { name: 'Minify' }).click();
  await expect(text).toHaveValue('{"hello":"local","n":1}');
  await page.getByRole('button', { name: 'Copy' }).click();
  if (chromiumClipboard) {
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('{"hello":"local","n":1}');
  } else {
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __localtoolsCopied?: string }).__localtoolsCopied)).toBe('{"hello":"local","n":1}');
  }
  const downloaded = await downloadBytes(page, 'Download');
  expect(JSON.parse(downloaded.toString('utf8'))).toEqual({ hello: 'local', n: 1 });

  await text.fill('{\n  "a": 1,\n  bad\n}');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.locator('.error')).toContainText(/line \d+, column \d+/i);
  await text.fill('{"ok":true}');
  await qa(page, 'json-populated');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(text).toHaveValue('');
});

test('390x844 mobile layout has no page overflow, accessible control sizing, and a mobile homepage capture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await qa(page, 'homepage-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const route of routes) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const button = page.locator('button').first();
    if (await button.count()) expect(await button.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const field = page.locator('input:not([type="range"]), select, textarea').first();
    if (await field.count()) expect(parseFloat(await field.evaluate((node) => getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  }
});

test('offline navigation serves all cached routes where the browser harness supports it', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === 'webkit', 'Playwright WebKit offline emulation blocks navigation before service-worker interception; offline local processing is covered separately.');
  await primeServiceWorker(page);
  await context.setOffline(true);
  try {
    for (const route of ['', ...routes]) {
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await expect(page.locator('h1')).toBeVisible();
    }
  } finally {
    await context.setOffline(false);
  }
});

test('offline mode still processes representative image, PDF, CSV, and JSON work', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === 'webkit', 'Playwright WebKit offline emulation blocks lazy chunks and Workers before service-worker interception.');
  const png = await imageBuffer(page, 80, 40);
  const pdf = await pdfBuffer([300, 301]);
  await primeServiceWorker(page);

  const toolPages: Page[] = [];
  for (const route of ['image/compress/', 'pdf/extract/', 'data/csv-viewer/', 'developer/json-formatter/']) {
    const toolPage = await context.newPage();
    await toolPage.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    await expect(toolPage.locator('h1')).toBeVisible();
    expect(await toolPage.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    toolPages.push(toolPage);
  }

  await context.setOffline(true);
  try {
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    const [imagePage, pdfPage, csvPage, jsonPage] = toolPages;

    await imagePage.locator('input[type=file]').setInputFiles({ name: 'offline.png', mimeType: 'image/png', buffer: png });
    await imagePage.getByRole('button', { name: 'Process image' }).click();
    await expect(imagePage.getByText(/Saved|Larger by/)).toBeVisible();

    await pdfPage.locator('input[type=file]').setInputFiles({ name: 'offline.pdf', mimeType: 'application/pdf', buffer: pdf });
    await pdfPage.getByPlaceholder('3,1-2').fill('2');
    await pdfPage.getByRole('button', { name: 'Extract pages' }).click();
    await expect(pdfPage.getByText('1 page ready')).toBeVisible();

    await csvPage.locator('input[type=file]').setInputFiles({ name: 'offline.csv', mimeType: 'text/csv', buffer: Buffer.from('name,value\nlocal,1\nprivate,2') });
    await expect(csvPage.getByText(/2 rows · 2 columns/)).toBeVisible();
    await csvPage.getByPlaceholder('Search rows').fill('private');
    await expect(csvPage.locator('tbody tr')).toHaveCount(1);

    await jsonPage.locator('textarea').fill('{"offline":true}');
    await jsonPage.getByRole('button', { name: 'Pretty-print' }).click();
    expect(await jsonPage.locator('textarea').inputValue()).toContain('\n  "offline": true');
  } finally {
    await context.setOffline(false);
    await Promise.all(toolPages.map((toolPage) => toolPage.close()));
  }
});

test('representative image, PDF, and CSV processing makes no cross-origin or mutating requests', async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  const png = await imageBuffer(page, 64, 32);
  const pdf = await pdfBuffer([300, 301]);
  await page.goto(`${base}image/compress/`);
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));

  await page.locator('input[type=file]').setInputFiles({ name: 'private.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Process image' }).click();
  await expect(page.getByText(/Saved|Larger by/)).toBeVisible();

  await page.goto(`${base}pdf/extract/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'private.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByPlaceholder('3,1-2').fill('1');
  await page.getByRole('button', { name: 'Extract pages' }).click();
  await expect(page.getByText('1 page ready')).toBeVisible();

  await page.goto(`${base}data/csv-viewer/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'private.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n3,4') });
  await expect(page.getByText(/2 rows · 2 columns/)).toBeVisible();

  const origin = new URL(page.url()).origin;
  const crossOrigin = requests.filter((item) => new URL(item.url).origin !== origin);
  const mutating = requests.filter((item) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(item.method));
  expect(crossOrigin).toEqual([]);
  expect(mutating).toEqual([]);
  fs.writeFileSync('/tmp/localtools-network-gets.txt', requests.filter((item) => item.method === 'GET').map((item) => new URL(item.url).pathname).join('\n'));
});

test('CSV 100k-row worker stress remains operational', async ({ page }, testInfo) => {
  const csv = `id,value,group\n${Array.from({ length: 100_000 }, (_, index) => `${index},value-${index},${index % 2 ? 'odd' : 'even'}`).join('\n')}`;
  const started = Date.now();
  await page.goto(`${base}data/csv-viewer/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'stress.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const stressTimeout = testInfo.project.name === 'webkit' ? 75_000 : 30_000;
  await expect(page.getByText(/100000 rows · 3 columns/)).toBeVisible({ timeout: stressTimeout });
  const elapsed = Date.now() - started;
  testInfo.annotations.push({ type: 'csv-stress-ms', description: String(elapsed) });
  fs.writeFileSync('/tmp/localtools-csv-stress-ms.txt', String(elapsed));
  await page.getByPlaceholder('Search rows').fill('value-99999');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByPlaceholder('Search rows').fill('');
  await page.locator('select').selectOption('2');
  await page.getByPlaceholder('Column filter').fill('odd');
  await expect(page.getByText(/50000 shown/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(100);
});

test('manifest, icons, and service worker form a Chromium-recognized installable app surface', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium-only: uses Chrome DevTools Protocol Page.getAppManifest.');
  await primeServiceWorker(page);
  const manifestResponse = await request.get(`${base}manifest.webmanifest`);
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe(base);
  expect(manifest.icons.map((item: { sizes: string }) => item.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  const session = await page.context().newCDPSession(page);
  const appManifest = await session.send('Page.getAppManifest');
  expect(appManifest.errors).toEqual([]);
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});

test('service worker N→N+1 waits, shows Update now, activates only after user click, and reloads', async ({ page }) => {
  await primeServiceWorker(page);
  const oldVersion = await controllerVersion(page);
  expect(oldVersion).toMatch(/^localtools-/);
  const swPath = 'dist/sw.js';
  const original = fs.readFileSync(swPath, 'utf8');
  const nextVersion = 'localtools-update-e2e-fixed';
  const changed = original.replace(/localtools-[a-f0-9]+/, nextVersion);
  expect(changed).not.toBe(original);
  fs.writeFileSync(swPath, changed);
  try {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('registration missing');
      await registration.update();
      await new Promise<void>((resolve, reject) => {
        if (registration.waiting) return resolve();
        const timeout = window.setTimeout(() => reject(new Error('waiting worker timeout')), 10_000);
        const inspect = () => {
          if (registration.waiting) { clearTimeout(timeout); resolve(); }
        };
        const watch = (worker: ServiceWorker | null) => worker?.addEventListener('statechange', inspect);
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
      });
    });
    expect(await controllerVersion(page)).toBe(oldVersion);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
    const banner = page.locator('.update-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Update now' })).toBeVisible();
    await qa(page, 'update-available');

    const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10_000 });
    await banner.getByRole('button', { name: 'Update now' }).click();
    await expect(page.locator('.update-state')).toContainText('Updating LocalTools', { timeout: 1_000 });
    await navigation;
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    expect(await controllerVersion(page)).toBe(nextVersion);
  } finally {
    fs.writeFileSync(swPath, original);
  }
});
