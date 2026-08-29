export async function decodeImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('This image could not be decoded.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function validateDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) {
    throw Error('Width and height must be whole numbers from 1 to 12,000 pixels.');
  }
}

export async function renderImage(file: File, width: number, height: number, type: string, quality = 0.82) {
  validateDimensions(width, height);
  const image = await decodeImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas is unavailable in this browser.');
  context.drawImage(image, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    const callback = (blob: Blob | null) => blob ? resolve(blob) : reject(Error('This browser could not create that output.'));
    if (type === 'image/png') canvas.toBlob(callback, type);
    else canvas.toBlob(callback, type, quality);
  });
}

export const extFor = (type: string) => type.split('/')[1].replace('jpeg', 'jpg');
export const usesLossyQuality = (type: string) => type === 'image/jpeg' || type === 'image/webp';
export const lockedHeight = (width: number, originalWidth: number, originalHeight: number) => Math.max(1, Math.round(width * originalHeight / originalWidth));
export const lockedWidth = (height: number, originalWidth: number, originalHeight: number) => Math.max(1, Math.round(height * originalWidth / originalHeight));
export const supportedImageTypes = () => [
  'image/jpeg',
  'image/png',
  ...(document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp') ? ['image/webp'] : []),
];
