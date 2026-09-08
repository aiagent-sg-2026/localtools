import { bytesToHex } from '../hash';

type HashRequest = { id: number; buffer: ArrayBuffer };
type HashResponse = { id: number; hash?: string; error?: string };

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, buffer } = event.data;
  try {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const response: HashResponse = { id, hash: bytesToHex(digest) };
    self.postMessage(response);
  } catch (cause) {
    const response: HashResponse = { id, error: cause instanceof Error ? cause.message : 'SHA-256 calculation failed.' };
    self.postMessage(response);
  }
};
