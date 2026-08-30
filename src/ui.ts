import type { Tool } from './registry';

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
export const button = (label: string, cls = 'secondary') => { const node = el('button', cls, label); node.type = 'button'; return node; };
export function setError(container: HTMLElement, message = '') { container.textContent = message; container.className = message ? 'error' : 'error hidden'; }
export const privacy = '<p class="privacy">🔒 Private processing. Your files are processed locally in this browser. Nothing is uploaded.</p>';
export function dropzone(accept: string, multiple = false) {
  const wrap = el('label', 'drop'); const input = el('input') as HTMLInputElement;
  input.type = 'file'; input.accept = accept; input.multiple = multiple;
  wrap.tabIndex = 0; wrap.setAttribute('role', 'button'); wrap.setAttribute('aria-label', multiple ? 'Choose or drop files' : 'Choose or drop a file');
  wrap.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  wrap.append(input, el('strong', undefined, multiple ? 'Drop files here or choose files' : 'Drop a file here or choose a file'), el('span', undefined, 'Your files stay in this browser'));
  const setActive = (on: boolean) => wrap.classList.toggle('drop-active', on);
  for (const event of ['dragenter', 'dragover']) wrap.addEventListener(event, (event) => { event.preventDefault(); setActive(true); });
  for (const event of ['dragleave', 'drop']) wrap.addEventListener(event, (event) => { event.preventDefault(); setActive(false); });
  wrap.addEventListener('drop', (event) => {
    const files = (event as DragEvent).dataTransfer?.files;
    if (!files?.length) return;
    const data = new DataTransfer(); Array.from(files).forEach((file) => data.items.add(file));
    input.files = data.files; input.dispatchEvent(new Event('change'));
  });
  return { wrap, input };
}
export function seo(tool: Tool) { return `<p class="seo-details"><strong>What this tool does:</strong> ${escapeHtml(tool.description)} <strong>Local processing/privacy:</strong> files never leave this browser. <strong>Supported formats:</strong> ${tool.formats}. <strong>FAQ:</strong> ${escapeHtml(tool.faq)}</p>`; }
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }
