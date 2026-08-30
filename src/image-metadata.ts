export type ImageMetadataKind = 'EXIF' | 'XMP' | 'IPTC / Photoshop' | 'Comment' | 'Text metadata' | 'Timestamp';

const decoder = new TextDecoder('latin1');
const unique = (items: ImageMetadataKind[]) => [...new Set(items)];

export function scanImageMetadata(bytes: Uint8Array, mimeType: string): ImageMetadataKind[] {
  if (mimeType === 'image/jpeg' || isJpeg(bytes)) return scanJpeg(bytes);
  if (mimeType === 'image/png' || isPng(bytes)) return scanPng(bytes);
  if (mimeType === 'image/webp' || isWebp(bytes)) return scanWebp(bytes);
  return [];
}

function isJpeg(bytes: Uint8Array) { return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8; }
function isPng(bytes: Uint8Array) { return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]); }
function isWebp(bytes: Uint8Array) { return bytes.length >= 12 && decoder.decode(bytes.slice(0, 4)) === 'RIFF' && decoder.decode(bytes.slice(8, 12)) === 'WEBP'; }

function scanJpeg(bytes: Uint8Array) {
  const found: ImageMetadataKind[] = [];
  if (!isJpeg(bytes)) return found;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    const payload = bytes.slice(offset + 2, offset + length);
    const head = decoder.decode(payload.slice(0, 80));
    if (marker === 0xe1 && head.startsWith('Exif\0\0')) found.push('EXIF');
    if (marker === 0xe1 && head.includes('http://ns.adobe.com/xap/1.0/')) found.push('XMP');
    if (marker === 0xed) found.push('IPTC / Photoshop');
    if (marker === 0xfe) found.push('Comment');
    offset += length;
  }
  return unique(found);
}

function scanPng(bytes: Uint8Array) {
  const found: ImageMetadataKind[] = [];
  if (!isPng(bytes)) return found;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    if (offset + 12 + length > bytes.length) break;
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    if (type === 'eXIf') found.push('EXIF');
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') found.push('Text metadata');
    if (type === 'tIME') found.push('Timestamp');
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return unique(found);
}

function scanWebp(bytes: Uint8Array) {
  const found: ImageMetadataKind[] = [];
  if (!isWebp(bytes)) return found;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = decoder.decode(bytes.slice(offset, offset + 4));
    const length = readUint32LE(bytes, offset + 4);
    if (type === 'EXIF') found.push('EXIF');
    if (type === 'XMP ') found.push('XMP');
    offset += 8 + length + (length % 2);
  }
  return unique(found);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}
function readUint32LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}
