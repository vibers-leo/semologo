/** Bound even chunked requests before parsing; never buffer an unlimited body. */
export async function readWallRequest(request: Request, limit = 16000) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('request_too_large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
