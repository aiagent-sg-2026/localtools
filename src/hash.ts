export type ChecksumEntry = { name: string; hash: string };

export function bytesToHex(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeSha256(value: string) {
  return value.trim().toLowerCase().replace(/^sha-?256\s*:\s*/i, '').replace(/\s+/g, '');
}

export function isSha256(value: string) {
  return /^[a-f0-9]{64}$/.test(normalizeSha256(value));
}

export function checksumText(entries: ChecksumEntry[]) {
  return entries.map(({ name, hash }) => `${hash}  ${name.replace(/[\r\n]+/g, ' ')}`).join('\n') + (entries.length ? '\n' : '');
}
