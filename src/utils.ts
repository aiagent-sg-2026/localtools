export const $ = <T extends Element>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]!));

export function parsePageExpression(input: string, total: number) {
  if (!input.trim()) throw Error('Enter pages such as 3-5,8,11-15.');
  const pages: number[] = [];
  for (const part of input.split(',')) {
    if (!/^\d+(?:-\d+)?$/.test(part)) throw Error(`Invalid page segment “${part}”.`);
    const values = part.split('-').map(Number);
    const start = values[0];
    const end = values[1] ?? start;
    if (start < 1 || end < 1 || start > total || end > total || end < start) {
      throw Error(`Pages must be between 1 and ${total}; ranges must go forward.`);
    }
    for (let page = start; page <= end; page += 1) pages.push(page);
  }
  return [...new Set(pages)];
}

export function csvRows(text: string, delimiter = ',') {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;

  const finishRow = () => {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
    cell = '';
    closedQuote = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell === '') {
      quoted = true;
    } else if (closedQuote && character !== delimiter && character !== '\n' && character !== '\r') {
      throw Error('Malformed CSV: unexpected text after a closing quote.');
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
      closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      finishRow();
    } else {
      cell += character;
    }
  }
  if (quoted) throw Error('Malformed CSV: an opening quote has no closing quote.');
  if (cell !== '' || row.length) finishRow();
  return rows;
}

export const detectDelimiter = (text: string) => [',', ';', '\t'].sort((a, b) => (
  text.split('\n')[0].split(b).length - text.split('\n')[0].split(a).length
))[0];

export function filterCsvRows(rows: string[][], query = '', column: number | null = null, value = '') {
  const normalizedQuery = query.toLocaleLowerCase();
  const normalizedValue = value.toLocaleLowerCase();
  return rows.filter((row) => {
    const matchesSearch = !normalizedQuery || row.some((cell) => cell.toLocaleLowerCase().includes(normalizedQuery));
    const matchesColumn = column === null || (row[column] ?? '').toLocaleLowerCase().includes(normalizedValue);
    return matchesSearch && matchesColumn;
  });
}

export function sortCsvRows(rows: string[][], column: number, direction: 1 | -1) {
  return [...rows].sort((left, right) => direction * (left[column] ?? '').localeCompare(right[column] ?? '', undefined, { numeric: true }));
}

export function csvToText(headers: string[], rows: string[][]) {
  const quote = (value: string) => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n');
}

export function jsonError(error: unknown, input = '') {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (!positionMatch) return message;
  const position = Number(positionMatch[1]);
  const before = input.slice(0, position);
  const line = before.split('\n').length;
  const column = position - (before.lastIndexOf('\n') + 1) + 1;
  return `${message} (line ${line}, column ${column})`;
}

export function jsonOperation(input: string, operation: 'pretty' | 'minify' | 'validate') {
  const parsed = JSON.parse(input);
  return operation === 'pretty' ? JSON.stringify(parsed, null, 2) : operation === 'minify' ? JSON.stringify(parsed) : input;
}
