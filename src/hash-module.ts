import { checksumText, isSha256, normalizeSha256 } from './hash';
import { SAFETY, formatBytes } from './safety';
import { button, dropzone, el, privacy, seo, setError } from './ui';
import type { Tool } from './registry';
import { download } from './utils';

type HashItem = { file: File; hash: string; state: 'queued' | 'reading' | 'hashing' | 'done' | 'error'; error?: string };
type WorkerResponse = { id: number; hash?: string; error?: string };

function hashBuffer(buffer: ArrayBuffer, id: number) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('./workers/hash.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (event.data.id !== id) return reject(Error('Hash worker response did not match the requested file.'));
      if (event.data.hash) resolve(event.data.hash);
      else reject(Error(event.data.error || 'SHA-256 calculation failed.'));
    };
    worker.onerror = () => { worker.terminate(); reject(Error('SHA-256 worker failed.')); };
    worker.postMessage({ id, buffer }, [buffer]);
  });
}

export function renderHashTool(tool: Tool, finish: (main: HTMLElement, title: string) => void) {
  const main = el('main', 'tool-page');
  const panel = el('section', 'panel');
  panel.append(el('div', 'eyebrow', tool.category), el('h1', undefined, tool.name), el('p', 'lede', tool.description));
  panel.insertAdjacentHTML('beforeend', privacy);

  const dz = dropzone('', true); panel.append(dz.wrap);
  const error = el('div', 'error hidden'); panel.append(error);
  const list = el('div', 'hash-list'); panel.append(list);
  const progressWrap = el('div', 'hash-progress hidden');
  const progress = el('progress') as HTMLProgressElement;
  const progressText = el('span'); progressWrap.append(progress, progressText); panel.append(progressWrap);

  const verifyLabel = el('label', undefined, 'Expected SHA-256 (optional)');
  const expected = el('input') as HTMLInputElement;
  expected.type = 'text'; expected.autocomplete = 'off'; expected.spellcheck = false;
  expected.placeholder = 'Paste a 64-character SHA-256 checksum'; verifyLabel.append(expected); panel.append(verifyLabel);
  const verifyStatus = el('div', 'hash-verify hidden'); verifyStatus.setAttribute('aria-live', 'polite'); panel.append(verifyStatus);

  const actions = el('div', 'button-row');
  const calculate = button('Calculate SHA-256', 'primary'); calculate.disabled = true;
  const copyAll = button('Copy all'); copyAll.disabled = true;
  const saveAll = button('Download .sha256'); saveAll.disabled = true;
  const reset = button('Reset'); actions.append(calculate, copyAll, saveAll, reset); panel.append(actions);
  const status = el('div', 'csv-status', 'Choose one or more files.'); status.setAttribute('aria-live', 'polite'); panel.append(status);

  let items: HashItem[] = [];
  let running = false;
  const doneItems = () => items.filter((item) => item.state === 'done' && item.hash);

  const updateVerification = () => {
    const raw = expected.value.trim();
    if (!raw) { verifyStatus.className = 'hash-verify hidden'; verifyStatus.textContent = ''; return; }
    if (!isSha256(raw)) { verifyStatus.className = 'hash-verify error'; verifyStatus.textContent = 'Expected hash must contain exactly 64 hexadecimal characters.'; return; }
    const normalized = normalizeSha256(raw);
    const done = doneItems();
    if (!done.length) { verifyStatus.className = 'hash-verify'; verifyStatus.textContent = 'Hash the selected files to verify this checksum.'; return; }
    const matches = done.filter((item) => item.hash === normalized);
    if (matches.length) {
      verifyStatus.className = 'hash-verify success';
      verifyStatus.textContent = `Match: ${matches.map((item) => item.file.name).join(', ')}`;
    } else if (done.length === items.length) {
      verifyStatus.className = 'hash-verify error'; verifyStatus.textContent = 'No selected file matches this SHA-256 checksum.';
    } else {
      verifyStatus.className = 'hash-verify'; verifyStatus.textContent = 'Verification will finish after all selected files are hashed.';
    }
  };

  const copyValue = async (value: string) => {
    if (!navigator.clipboard?.writeText) throw Error('Clipboard access is unavailable in this browser.');
    await navigator.clipboard.writeText(value);
  };

  const render = () => {
    list.replaceChildren();
    items.forEach((item, index) => {
      const row = el('div', 'hash-row');
      const details = el('div', 'hash-details');
      details.append(el('strong', undefined, item.file.name), el('small', undefined, formatBytes(item.file.size)));
      const state = el('span', 'hash-state');
      state.textContent = item.state === 'queued' ? 'Ready' : item.state === 'reading' ? 'Reading…' : item.state === 'hashing' ? 'Hashing…' : item.state === 'error' ? `Error: ${item.error || 'Failed'}` : 'SHA-256';
      details.append(state); row.append(details);
      if (item.hash) {
        const hash = el('code', 'hash-value', item.hash);
        const copy = button('Copy hash', 'remove'); copy.disabled = running;
        copy.onclick = async () => { try { await copyValue(item.hash); status.textContent = `Copied SHA-256 for ${item.file.name}.`; } catch (cause) { setError(error, cause instanceof Error ? cause.message : 'Could not copy hash.'); } };
        row.append(hash, copy);
      } else if (!running) {
        const remove = button('Remove', 'remove');
        remove.onclick = () => { items.splice(index, 1); render(); };
        row.append(remove);
      }
      list.append(row);
    });
    const completed = doneItems().length;
    progress.max = Math.max(items.length, 1); progress.value = completed;
    progressText.textContent = `${completed} of ${items.length} file${items.length === 1 ? '' : 's'} hashed`;
    progressWrap.classList.toggle('hidden', !items.length);
    calculate.disabled = running || !items.length || items.every((item) => item.state === 'done');
    copyAll.disabled = running || !completed; saveAll.disabled = running || !completed; dz.input.disabled = running;
    updateVerification();
  };

  dz.input.onchange = () => {
    const files = Array.from(dz.input.files || []); if (!files.length) return;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some((file) => file.size > SAFETY.maxFileBytes)) { setError(error, `Each file must be smaller than ${formatBytes(SAFETY.maxFileBytes)}.`); return; }
    if (total > SAFETY.maxAggregateBytes) { setError(error, `Selected files must total less than ${formatBytes(SAFETY.maxAggregateBytes)}.`); return; }
    items = files.map((file) => ({ file, hash: '', state: 'queued' }));
    status.textContent = `${items.length} file${items.length === 1 ? '' : 's'} ready. SHA-256 runs locally in this browser.`;
    setError(error); render();
  };

  calculate.onclick = async () => {
    if (running || !items.length) return;
    running = true; setError(error); status.textContent = 'Calculating SHA-256 locally…'; render();
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]; if (item.state === 'done') continue;
      try {
        item.state = 'reading'; render();
        const buffer = await item.file.arrayBuffer();
        item.state = 'hashing'; render();
        item.hash = await hashBuffer(buffer, index); item.state = 'done';
      } catch (cause) {
        item.state = 'error'; item.error = cause instanceof Error ? cause.message : 'SHA-256 calculation failed.';
      }
      render();
    }
    running = false;
    const failures = items.filter((item) => item.state === 'error').length;
    status.textContent = failures ? `Finished with ${failures} failed file${failures === 1 ? '' : 's'}.` : `SHA-256 complete for ${doneItems().length} file${doneItems().length === 1 ? '' : 's'}.`;
    render();
  };

  expected.addEventListener('input', updateVerification);
  copyAll.onclick = async () => {
    try { await copyValue(checksumText(doneItems().map((item) => ({ name: item.file.name, hash: item.hash })))); status.textContent = 'Copied SHA-256 checksum list.'; }
    catch (cause) { setError(error, cause instanceof Error ? cause.message : 'Could not copy checksum list.'); }
  };
  saveAll.onclick = () => download(new Blob([checksumText(doneItems().map((item) => ({ name: item.file.name, hash: item.hash })))], { type: 'text/plain;charset=utf-8' }), 'localtools.sha256');
  reset.onclick = () => { items = []; dz.input.value = ''; expected.value = ''; running = false; list.replaceChildren(); progressWrap.classList.add('hidden'); verifyStatus.className = 'hash-verify hidden'; calculate.disabled = true; copyAll.disabled = true; saveAll.disabled = true; status.textContent = 'Choose one or more files.'; setError(error); };

  panel.insertAdjacentHTML('beforeend', seo(tool)); main.append(panel); finish(main, tool.name);
}
