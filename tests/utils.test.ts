import { describe, expect, it } from 'vitest';
import { lockedHeight, lockedWidth, validateDimensions } from '../src/image';
import { TOOLS, normalizePath, routeFor, searchTools, toolForPath } from '../src/registry';
import { csvToText, csvRows, filterCsvRows, jsonError, jsonOperation, parsePageExpression, sortCsvRows } from '../src/utils';

describe('registry and routes', () => {
  it('has exactly seven unique tools, routes, and ids', () => { expect(TOOLS).toHaveLength(7); expect(new Set(TOOLS.map((x) => x.id)).size).toBe(7); expect(new Set(TOOLS.map((x) => x.route)).size).toBe(7); });
  it('has required metadata and exactly four popular tools', () => { expect(TOOLS.every((x) => x.description && x.accepted.length && x.formats && x.faq && x.offline && x.status === 'ready')).toBe(true); expect(TOOLS.filter((x) => x.popular).map((x) => x.name)).toEqual(['Compress Image', 'Merge PDF', 'CSV Viewer', 'JSON Formatter']); });
  it('normalizes root and production paths', () => { expect(normalizePath('/localtools/', '/localtools/')).toBe('/'); expect(normalizePath('/localtools/image/compress/index.html', '/localtools/')).toBe('/image/compress/'); expect(toolForPath('/localtools/image/compress/', '/localtools/')?.id).toBe('compress-image'); expect(routeFor(TOOLS[0], '/localtools/')).toBe('/localtools/image/compress/'); });
  it('tokenizes natural search terms', () => { expect(searchTools('reduce picture size').map((x) => x.id)).toEqual(['compress-image']); });
});

describe('image helpers', () => {
  it('locks aspect ratio both directions', () => { expect(lockedHeight(1000, 4000, 2000)).toBe(500); expect(lockedWidth(500, 4000, 2000)).toBe(1000); });
  it('accepts boundary dimensions', () => { expect(() => validateDimensions(1, 12000)).not.toThrow(); });
  it.each([[0, 2], [2, 0], [12001, 2], [2, 12001], [1.5, 2]])('rejects unsafe dimensions %s×%s', (w, h) => { expect(() => validateDimensions(w, h)).toThrow(); });
});

describe('PDF page expressions', () => {
  it.each([['1', [1]], ['1-5', [1, 2, 3, 4, 5]], ['1,3,5', [1, 3, 5]], ['3-5,8,11-15', [3, 4, 5, 8, 11, 12, 13, 14, 15]]])('parses %s', (input, expected) => expect(parsePageExpression(input, 20)).toEqual(expected));
  it('deduplicates selected pages', () => expect(parsePageExpression('1,1-2', 2)).toEqual([1, 2]));
  it.each(['', '0', '5-2', 'abc', '1,,2', '999'])('rejects invalid expression %s', (input) => expect(() => parsePageExpression(input, 10)).toThrow());
});

describe('CSV parser/filter/export', () => {
  it('handles commas, escaped quotes, blanks, UTF8, and CRLF', () => expect(csvRows('name,note\r\nAda,"hello, world"\r\n\r\nZoë,"say ""hi"""')).toEqual([['name', 'note'], ['Ada', 'hello, world'], ['Zoë', 'say "hi"']]));
  it('handles quoted newlines', () => expect(csvRows('a,b\n"line\none",ok')).toEqual([['a', 'b'], ['line\none', 'ok']]));
  it('rejects malformed quotes and trailing text', () => { expect(() => csvRows('a,b\n"oops')).toThrow(); expect(() => csvRows('a,b\n"ok"bad')).toThrow(); });
  it('filters globally and by column', () => { const rows = [['Ada', 'London'], ['Lin', 'Tokyo']]; expect(filterCsvRows(rows, 'ada')).toEqual([rows[0]]); expect(filterCsvRows(rows, '', 1, 'tok')).toEqual([rows[1]]); });
  it('sorts numeric-looking values', () => expect(sortCsvRows([['10'], ['2']], 0, 1)).toEqual([['2'], ['10']]));
  it('exports safe quoted CSV', () => expect(csvToText(['name', 'note'], [['Zoë', 'hello, "world"']])).toBe('name,note\nZoë,"hello, ""world"""'));
});

describe('JSON operations and diagnostics', () => {
  it('pretty prints and minifies without mutation on validation', () => { const source = '{"a":1}'; expect(jsonOperation(source, 'pretty')).toBe('{\n  "a": 1\n}'); expect(jsonOperation('{ "a": 1 }', 'minify')).toBe('{"a":1}'); expect(jsonOperation(source, 'validate')).toBe(source); });
  it('reports line and column for positioned errors', () => expect(jsonError(new SyntaxError('Unexpected token at position 8'), '{\n  "a": 1\n}')).toContain('line 2, column 7'));
  it('rejects malformed JSON', () => expect(() => jsonOperation('{bad', 'validate')).toThrow());
});
