import sharp from 'sharp';
import type { Brand } from './brands';
import { CDN } from './cdn';
import { logoWallPngCandidates } from './logo-png-source';
import { GET as recoverPng } from '@/app/api/logo-preview/route';

export async function cdnPng(brand: Brand, explicitVariant = false, deadline = Date.now()+60000): Promise<Buffer> {
  const id = brand.id;
  const root = new URL(CDN);
  for (const candidate of explicitVariant ? [String(brand.preview_png)] : logoWallPngCandidates(brand)) {
    if(Date.now()>=deadline)throw new Error('asset deadline');
    // Only fetch this brand's known CDN directory; never arbitrary snapshot URLs.
    let url: URL;
    try { url = new URL(candidate); } catch { continue; }
    if (url.origin !== root.origin || !url.pathname.startsWith(`${root.pathname}/${encodeURIComponent(id)}/`)) continue;
    const relativeFile=decodeURIComponent(url.pathname.slice(`${root.pathname}/${encodeURIComponent(id)}/`.length));
    if(brand.rejected_asset_files?.includes(relativeFile)){if(explicitVariant)throw new Error('rejected selected asset');continue;}
    try {
      const r = await fetch(url.href, { headers:{'User-Agent':'SemoLogo-logo-wall/1.0 (+https://semologo.com/)','Referer':'https://semologo.com/'}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(Math.max(1,Math.min(6000,deadline-Date.now()))) });
      if (!r.ok || !r.body) continue;
      const reader = r.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2_000_000) throw new Error('large'); chunks.push(part.value); } } finally { await reader.cancel(); }
      const png = Buffer.concat(chunks);
      if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) continue;
      // Ensure the exported asset actually decodes, and cap decompression work.
      return await sharp(png, { limitInputPixels: 16_000_000 }).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).timeout({ seconds: 3 }).png().toBuffer();
    } catch { /* Try another known asset path, never a caller-provided URL. */ }
  }
  if (explicitVariant) throw new Error('missing selected variant');
  if(Date.now()>=deadline)throw new Error('asset deadline');
  const recovered = await recoverPng(new Request(`http://localhost/api/logo-preview/?id=${encodeURIComponent(id)}`));
  if (!recovered.ok) throw new Error('missing');
  return Buffer.from(await recovered.arrayBuffer());
}
