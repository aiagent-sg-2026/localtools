import { decodeImage, extFor, renderImage, supportedImageTypes, usesLossyQuality } from './image';
import { scanImageMetadata } from './image-metadata';
import { SAFETY, formatBytes, validateFiles } from './safety';
import { button, dropzone, el, privacy, seo, setError } from './ui';
import type { Tool } from './registry';
import { download } from './utils';

export function renderMetadataCleaner(tool: Tool, finish: (main: HTMLElement, title: string) => void, clearUrls: () => void, rememberUrl: (url: string) => string) {
  const main = el('main', 'tool-page');
  const panel = el('section', 'panel');
  panel.append(el('div', 'eyebrow', tool.category), el('h1', undefined, tool.name), el('p', 'lede', tool.description));
  panel.insertAdjacentHTML('beforeend', privacy);

  const dz = dropzone(tool.accepted.join(',')); panel.append(dz.wrap);
  const previewRow = el('div', 'preview-row hidden');
  const preview = el('img', 'preview') as HTMLImageElement; preview.alt = 'Selected image preview';
  const info = el('span'); previewRow.append(preview, info); panel.append(previewRow);

  const scanBox = el('div', 'metadata-scan hidden'); panel.append(scanBox);
  const controls = el('div', 'controls');
  const formatLabel = el('label', undefined, 'Output format');
  const format = el('select') as HTMLSelectElement;
  supportedImageTypes().forEach((type) => format.add(new Option(type.split('/')[1].toUpperCase(), type)));
  formatLabel.append(format); controls.append(formatLabel);
  const qualityLabel = el('label', undefined, 'Quality');
  const quality = el('input') as HTMLInputElement; quality.type = 'range'; quality.min = '1'; quality.max = '100'; quality.value = '92';
  const qualityNote = el('small', undefined, '92'); qualityLabel.append(quality, qualityNote); controls.append(qualityLabel); panel.append(controls);
  const note = el('p', 'lede', 'The cleaned file is rebuilt from visible pixels. JPEG/WebP output is re-encoded and may change file size or compression slightly.'); panel.append(note);

  const actions = el('div', 'button-row');
  const clean = button('Remove metadata', 'primary'); clean.disabled = true;
  const reset = button('Reset'); actions.append(clean, reset); panel.append(actions);
  const error = el('div', 'error hidden'); panel.append(error);
  const result = el('div', 'result hidden'); panel.append(result);

  let file: File | null = null;
  let dimensions = { width: 0, height: 0 };
  let output: Blob | null = null;

  const updateQuality = () => qualityLabel.classList.toggle('hidden', !usesLossyQuality(format.value));
  format.addEventListener('change', updateQuality);
  quality.addEventListener('input', () => { qualityNote.textContent = quality.value; });
  updateQuality();

  dz.input.addEventListener('change', async () => {
    clearUrls(); file = dz.input.files?.[0] || null; result.classList.add('hidden'); scanBox.classList.add('hidden');
    if (!file) return;
    try {
      validateFiles([file], tool.accepted, SAFETY.maxFileBytes);
      const image = await decodeImage(file);
      dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      const detected = scanImageMetadata(new Uint8Array(await file.arrayBuffer()), file.type);
      preview.src = rememberUrl(URL.createObjectURL(file)); previewRow.classList.remove('hidden');
      info.textContent = `${file.name} · ${formatBytes(file.size)} · ${dimensions.width}×${dimensions.height}`;
      const supported = supportedImageTypes();
      format.value = supported.includes(file.type) ? file.type : 'image/png'; updateQuality();
      scanBox.replaceChildren(
        el('strong', undefined, detected.length ? 'Metadata detected' : 'No common metadata blocks detected'),
        el('span', undefined, detected.length ? detected.join(' · ') : 'You can still rebuild the image to produce a fresh metadata-minimized copy.'),
      );
      scanBox.classList.remove('hidden'); clean.disabled = false; setError(error);
    } catch (cause) {
      setError(error, cause instanceof Error ? cause.message : 'Could not inspect this image.'); clean.disabled = true;
    }
  });

  clean.addEventListener('click', async () => {
    if (!file) return;
    clean.disabled = true; clean.textContent = 'Cleaning…';
    try {
      output = await renderImage(file, dimensions.width, dimensions.height, format.value, Number(quality.value) / 100);
      const after = scanImageMetadata(new Uint8Array(await output.arrayBuffer()), output.type || format.value);
      if (after.length) throw Error(`The browser output still contains metadata blocks: ${after.join(', ')}. No download was created.`);
      result.replaceChildren(
        el('strong', undefined, 'Metadata cleanup verified'),
        el('span', undefined, `No common privacy metadata blocks detected · ${formatBytes(output.size)} · ${dimensions.width}×${dimensions.height}`),
      );
      const save = button('Download cleaned image', 'primary');
      save.onclick = () => download(output!, `${file!.name.replace(/\.[^.]+$/, '')}-clean.${extFor(format.value)}`);
      result.append(save); result.classList.remove('hidden'); setError(error);
    } catch (cause) {
      setError(error, cause instanceof Error ? cause.message : 'Could not clean this image.');
    } finally {
      clean.disabled = false; clean.textContent = 'Remove metadata';
    }
  });

  reset.addEventListener('click', () => {
    clearUrls(); file = null; output = null; dz.input.value = ''; preview.removeAttribute('src'); previewRow.classList.add('hidden'); scanBox.classList.add('hidden'); result.classList.add('hidden'); clean.disabled = true; setError(error);
  });

  panel.insertAdjacentHTML('beforeend', seo(tool)); main.append(panel); finish(main, tool.name);
}
