export type Category = 'Images' | 'PDF' | 'Data' | 'Developer';

export type Tool = {
  id: string;
  name: string;
  description: string;
  category: Category;
  route: string;
  icon: string;
  keywords: string[];
  accepted: string[];
  offline: true;
  capabilities: string[];
  status: 'ready';
  faq: string;
  formats: string;
  popular?: boolean;
};

export const TOOLS: Tool[] = [
  {
    id: 'compress-image',
    name: 'Compress Image',
    description: 'Reduce picture size while keeping it looking sharp.',
    category: 'Images',
    route: '/image/compress/',
    icon: '◌',
    keywords: ['compress', 'compressor', 'reduce', 'shrink', 'picture', 'photo', 'image', 'size', 'optimize', 'downsize'],
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
    offline: true,
    capabilities: ['JPG', 'PNG', 'WebP'],
    status: 'ready',
    faq: 'PNG is re-encoded losslessly by the browser; quality applies to JPEG and WebP.',
    formats: 'JPG, PNG, WebP',
    popular: true,
  },
  {
    id: 'resize-image',
    name: 'Resize Image',
    description: 'Change image dimensions without accidental stretching.',
    category: 'Images',
    route: '/image/resize/',
    icon: '↗',
    keywords: ['resize', 'dimensions', 'scale', 'width', 'height'],
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
    offline: true,
    capabilities: ['Aspect lock', 'Presets'],
    status: 'ready',
    faq: 'The aspect lock derives the paired dimension from the original image ratio.',
    formats: 'JPG, PNG, WebP',
  },
  {
    id: 'convert-image',
    name: 'Convert Image',
    description: 'Switch between JPG, PNG, and WebP in a click.',
    category: 'Images',
    route: '/image/convert/',
    icon: '⇄',
    keywords: ['convert', 'format', 'jpg', 'jpeg', 'png', 'webp', 'image'],
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
    offline: true,
    capabilities: ['JPG', 'PNG', 'WebP'],
    status: 'ready',
    faq: 'WebP is offered only when this browser can encode it.',
    formats: 'JPG, PNG, WebP',
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Join PDFs in the order you choose.',
    category: 'PDF',
    route: '/pdf/merge/',
    icon: '▤',
    keywords: ['merge', 'join', 'combine', 'pdf'],
    accepted: ['application/pdf'],
    offline: true,
    capabilities: ['Reorder', 'Remove'],
    status: 'ready',
    faq: 'Files are copied in the order shown before you merge.',
    formats: 'PDF',
    popular: true,
  },
  {
    id: 'extract-pdf',
    name: 'Extract PDF Pages',
    description: 'Save selected pages from a PDF as a new file.',
    category: 'PDF',
    route: '/pdf/extract/',
    icon: '▥',
    keywords: ['extract', 'split', 'pages', 'pdf'],
    accepted: ['application/pdf'],
    offline: true,
    capabilities: ['Page ranges', 'Validation'],
    status: 'ready',
    faq: 'Use comma-separated pages and forward ranges such as 1-3,5.',
    formats: 'PDF',
  },
  {
    id: 'csv-viewer',
    name: 'CSV Viewer',
    description: 'Explore large CSVs with search, sort, filters, and export.',
    category: 'Data',
    route: '/data/csv-viewer/',
    icon: '▦',
    keywords: ['csv', 'spreadsheet', 'table', 'data', 'filter', 'comma'],
    accepted: ['text/csv', 'text/plain'],
    offline: true,
    capabilities: ['Worker parsing', 'Search and export'],
    status: 'ready',
    faq: 'The configurable safety limit prevents unbounded browser memory use.',
    formats: 'CSV, UTF-8 text',
    popular: true,
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Pretty-print, minify, validate, and download JSON.',
    category: 'Developer',
    route: '/developer/json-formatter/',
    icon: '{}',
    keywords: ['json', 'format', 'pretty', 'minify', 'validate', 'developer'],
    accepted: ['application/json', 'text/plain'],
    offline: true,
    capabilities: ['Pretty', 'Minify'],
    status: 'ready',
    faq: 'Validation checks the input without changing it.',
    formats: 'JSON',
    popular: true,
  },
];

export function normalizeBase(base = '/') {
  const value = base.trim();
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export function normalizePath(path: string, base = '/') {
  const clean = (path.startsWith('/') ? path : `/${path}`).split(/[?#]/, 1)[0].replace(/index\.html$/, '');
  const prefix = normalizeBase(base);
  const relative = prefix === '/' ? clean : clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
  const normalized = relative.replace(/^\/+|\/+$/g, '');
  return `/${normalized}/`.replace('//', '/');
}

export function toolForPath(path: string, base = '/') {
  const prefix = normalizeBase(base);
  if (prefix !== '/' && !path.startsWith(prefix)) return null;
  const normalized = normalizePath(path, prefix);
  return TOOLS.find((tool) => normalized === tool.route) ?? null;
}

export const routeFor = (tool: Tool, base = '/') => {
  const prefix = normalizeBase(base);
  return `${prefix === '/' ? '' : prefix.slice(0, -1)}${tool.route}`;
};

export function searchTools(query: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return TOOLS;
  return TOOLS.filter((tool) => {
    const text = `${tool.name} ${tool.description} ${tool.category} ${tool.keywords.join(' ')} ${tool.formats} ${tool.capabilities.join(' ')}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
