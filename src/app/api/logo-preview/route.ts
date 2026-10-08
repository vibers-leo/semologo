import { applyReviewedAssets } from '@/lib/reviewed-logo-assets';
import { prepareSvgPreview } from '@/lib/logo-svg-preview';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SUBMITTED_BRANDS } from '@/lib/submissions';
import { SIMPLE_ICONS_BRANDS } from '@/lib/simple-icons-submissions';
import { STREAMING_SUBMISSIONS } from '@/lib/streaming-submissions';
import { INDEX_REVIEW_BRANDS } from '@/lib/index-candidate-review-submissions';
import sharp from 'sharp';
import { CDN, VERSION } from '@/lib/cdn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const registered = new Map([...SUBMITTED_BRANDS, ...SIMPLE_ICONS_BRANDS, ...STREAMING_SUBMISSIONS, ...INDEX_REVIEW_BRANDS].map(b => [b.id, b]));
const failures = new Map<string, { at: number; reason: string }>();
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

function failureAt(id: string) { const f = failures.get(id); return f && Date.now() - f.at < 15_000; }

// Only our fixed CDN is accepted. No caller-supplied URL or local asset path.
async function render(id: string) {
  await acquire();
  try {
    const brand = applyReviewedAssets(registered.get(id) ?? {id,name_ko:id,name_en:id,category:''});
    const local = typeof brand?.logo_png === 'string' && brand.logo_png.startsWith('/submissions/') ? brand.logo_png : brand?.logo_svg;
    let input: Buffer;
    if (typeof local === 'string' && local.startsWith('/submissions/') && !local.includes('..') && !local.includes('\\') && /\.(png|svg)$/.test(local)) {
      input = await readFile(join(process.cwd(), 'public', local));
      if (input.length > 12_000_000) throw new Error('large');
    } else {
    const remoteFile = typeof brand.logo_png === "string" && /^(?:[\w-]+\/)*[\w.-]+\.png$/.test(brand.logo_png) && !brand.logo_png.includes("..") ? brand.logo_png : brand.svg_transparent || (id === "nhqv" ? "logo.png" : "logo.svg");
    const response = await fetch(`${CDN}/${encodeURIComponent(id)}/${remoteFile}?v=${VERSION}`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000) });
    if (!response.ok || !response.body) throw new Error(response.status === 404 ? 'missing' : 'upstream');
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
    const isPng = input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    if (!isPng && !isJpeg) input = prepareSvgPreview(input);
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
    const failure = failures.get(id);
    if (failure && Date.now() - failure.at < 15_000) throw new Error(failure.reason);
    let result = cache.get(id);
    if (!result) {
      let task = pending.get(id);
      if (!task) { task = render(id); pending.set(id, task); }
      try { result = await task; } finally { pending.delete(id); }
    }
    return new Response(new Uint8Array(result), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const reason = ['missing', 'unsupported', 'large', 'busy', 'upstream'].includes(raw) ? raw : 'temporary';
    if (!failures.has(id) || Date.now() - failures.get(id)!.at >= 15_000) console.warn('[logo-preview]', { id, reason });
    if (failures.size >= 256) failures.delete(failures.keys().next().value!);
    if (!failureAt(id)) failures.set(id, { at: Date.now(), reason });
    const retryable = ['busy', 'upstream', 'temporary'].includes(reason);
    return new Response(null, { status: retryable ? 503 : 404, headers: { 'Cache-Control': 'no-store', 'X-Logo-Preview-Error': reason, ...(retryable ? { 'Retry-After': '15' } : {}) } });
  }
}
