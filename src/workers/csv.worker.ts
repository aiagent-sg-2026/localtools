import Papa from 'papaparse';
export type CsvRequest = { type: 'parse'; text: string };
export type CsvResponse = { type: 'state'; state: 'processing' | 'parsed' } | { type: 'done'; rows: string[][] } | { type: 'error'; message: string };
self.onmessage = (event: MessageEvent<CsvRequest>) => {
  try {
    self.postMessage({ type: 'state', state: 'processing' } satisfies CsvResponse);
    const result = Papa.parse<string[]>(event.data.text, { skipEmptyLines: true, dynamicTyping: false });
    const firstError = result.errors[0];
    if (firstError) throw Error(`CSV parse error on row ${(firstError.row ?? 0) + 1}: ${firstError.message}`);
    self.postMessage({ type: 'state', state: 'parsed' } satisfies CsvResponse);
    self.postMessage({ type: 'done', rows: result.data } satisfies CsvResponse);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Could not parse this CSV.' } satisfies CsvResponse);
  }
};
