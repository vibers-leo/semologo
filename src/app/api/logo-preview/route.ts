import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INDEX_REVIEW_BRANDS } from '@/lib/index-candidate-review-submissions';
import sharp from 'sharp';
import { CDN, VERSION } from '@/lib/cdn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cache = new Map<string, Uint8Array>();
const pending = new Map<string, Promise<Uint8Array>>();
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < 2) { active++; return; }
  if (waiting.length >= 30) throw new Error('busy');
  await new Promise<void>(resolve => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next(); else active--;
}

// Only our fixed CDN is accepted. No caller-supplied URL or local asset path.
async function render(id: string) {
  await acquire();
  try {
    const local = INDEX_REVIEW_BRANDS.find(b => b.id === id)?.logo_svg;
    let input: Buffer;
    if (typeof local === 'string' && /^\/submissions\/index-candidates\/[A-Z0-9_-]+\.svg$/.test(local)) {
      input = await readFile(join(process.cwd(), 'public', local));
      if (input.length > 2_000_000) throw new Error('large');
    } else {
    const response = await fetch(`${CDN}/${encodeURIComponent(id)}/logo.svg?v=${VERSION}`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000) });
    if (!response.ok || !response.body) throw new Error('missing');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000) throw new Error('large');
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    input = Buffer.concat(chunks);
    }
    const svg = input.toString('utf8');
    const references = [...svg.matchAll(/\b(?:[\w-]+:)?href\s*=\s*["']([^"']*)["']|url\(\s*["']?([^)'"\s]*)/gi)];
    if (!/<svg\b/i.test(svg) || /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b/i.test(svg) || references.some(m => !(m[1] ?? m[2]).trim().startsWith('#'))) throw new Error('unsupported');
    const png = await sharp(input, { limitInputPixels: 16_000_000 }).resize(320, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).timeout({ seconds: 3 }).png().toBuffer();
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(id, png);
    return png;
  } finally { release(); }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[\w가-힣-]{1,200}$/.test(id)) return new Response(null, { status: 400 });
  try {
    let result = cache.get(id);
    if (!result) {
      let task = pending.get(id);
      if (!task) { task = render(id); pending.set(id, task); }
      try { result = await task; } finally { pending.delete(id); }
    }
    return new Response(new Uint8Array(result), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    const busy = error instanceof Error && error.message === 'busy';
    return new Response(null, { status: busy ? 503 : 404, headers: { 'Cache-Control': 'no-store', ...(busy ? { 'Retry-After': '2' } : {}) } });
  }
}
