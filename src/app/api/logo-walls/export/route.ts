import { Pool } from 'pg';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { logoOwner } from '@/lib/logo-owner';
import { logoWallZip } from '@/lib/logo-wall-zip';
import { logoWallBundle, logoWallInlineHtml } from '@/lib/logo-wall-html';
import { logoWallPreview } from '@/lib/logo-wall-preview';
import { logoPngCandidates } from '@/lib/logo-png-source';
import { logoWallAsset } from '@/lib/cms-brand';
import type { Brand } from '@/lib/brands';
import { CDN, VERSION } from '@/lib/cdn';
import type { CardBackground } from '@/lib/logo-wall-layout';
import { GET as recoverPng } from '@/app/api/logo-preview/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let pool: Pool | undefined;
let active = 0;
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (error: string, status: number, details?: unknown) => Response.json({ error, details }, { status, headers: privateHeaders });

async function cdnPng(brand: Brand, explicitVariant = false): Promise<Buffer> {
  const id = brand.id;
  const root = new URL(CDN);
  for (const candidate of explicitVariant ? [String(brand.preview_png)] : logoPngCandidates(brand)) {
    // Only fetch this brand's known CDN directory; never arbitrary snapshot URLs.
    let url: URL;
    try { url = new URL(candidate); } catch { continue; }
    if (url.origin !== root.origin || !url.pathname.startsWith(`${root.pathname}/${encodeURIComponent(id)}/`)) continue;
    try {
      const r = await fetch(url.href, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000) });
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
  const recovered = await recoverPng(new Request(`http://localhost/api/logo-preview/?id=${encodeURIComponent(id)}`));
  if (!recovered.ok) throw new Error('missing');
  return Buffer.from(await recovered.arrayBuffer());
}

export async function GET(request: Request) {
  let acquired = false;
  try {
    const uid = await logoOwner(request);
    if (!uid) return reply('로그인 후 이용해 주세요.', 401);
    const id = new URL(request.url).searchParams.get('id');
    if (!id || !/^[\w-]{1,100}$/.test(id)) return reply('로고월을 선택해 주세요.', 400);
    if (!process.env.DB_VIBERS_MAIN_URL) return reply('저장 서비스를 준비 중이에요.', 503);
    pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
    // Fetch one consistent wall version with ordered items in a single statement.
    const result = await pool.query(`SELECT w.id,w.title,w.version,w.settings,
      COALESCE(jsonb_agg(jsonb_build_object('brand_id',i.brand_id,'snapshot',i.asset_snapshot,'catalog',p.payload) ORDER BY i.position) FILTER(WHERE i.item_id IS NOT NULL),'[]'::jsonb) AS items
      FROM semologo.logo_walls w LEFT JOIN semologo.logo_wall_items i ON i.wall_id=w.id LEFT JOIN semologo.logo_posts p ON p.id=i.brand_id
      WHERE w.id=$1 AND w.owner_id=$2 GROUP BY w.id`, [id, uid]);
    if (!result.rowCount) return reply('로고월을 찾을 수 없어요.', 404);
    const wall = result.rows[0];
    if (!wall.items.length || wall.items.length > 100) return reply('1~100개의 로고를 선택해 주세요.', 400);
    if (active >= 1) return reply('다른 로고월을 준비 중이에요. 잠시 후 다시 시도해 주세요.', 503);
    active++; acquired = true;
    const privateIds = wall.items.map((i: { snapshot: { user_logo_id?: string } }) => i.snapshot.user_logo_id).filter(Boolean);
    const personal = await pool.query('SELECT id,png FROM semologo.personal_logos WHERE owner_id=$1 AND id=ANY($2::text[])', [uid, privateIds]);
    const own = new Map<string, Buffer>(personal.rows.map(r => [r.id, r.png]));
    const files: { name: string; data: Uint8Array }[] = []; const entries: { id: string; name?: string; file: string; light: boolean; scale?: number; cardBackground?: CardBackground; variantKey?: string; sha256: string; captured_at?: string }[] = []; const missing: string[] = [];
    let bytes = 0; let index = 0; const deadline = Date.now() + 60_000;
    // Two workers bound upstream requests and CPU; output order is fixed below.
    const output: ({ name: string; data: Buffer; entry: typeof entries[number] } | undefined)[] = new Array(wall.items.length);
    await Promise.all([0,1].map(async () => {
      while (index < wall.items.length) {
        const n = index++; const item = wall.items[n]; const logoId = item.snapshot.user_logo_id || item.brand_id;
        try {
          if (Date.now() > deadline) throw new Error('export timeout');
          if (typeof logoId !== 'string' || !/^[\w가-힣-]{1,200}$/.test(logoId)) throw new Error('invalid');
          const brand = logoWallAsset(logoId, item.catalog || {}, item.snapshot);
          if (!item.snapshot.user_logo_id && brand.hidden) throw new Error('review required');
          const data = item.snapshot.user_logo_id ? own.get(logoId) : await cdnPng(brand, Boolean(item.snapshot.variant_key));
          if (!data) throw new Error('missing');
          bytes += data.length; if (bytes > 25_000_000) throw new Error('large export');
          const filename = `logos/${String(n + 1).padStart(3, '0')}-${logoId}.png`;
          output[n] = { name: filename, data, entry: { id: logoId, name: item.snapshot.name, file: filename, light: Boolean(brand.light), scale: item.snapshot.scale || 100, cardBackground: item.snapshot.card_background, variantKey: item.snapshot.variant_key, sha256: createHash('sha256').update(data).digest('hex'), captured_at: item.snapshot.captured_at } };
        } catch { missing.push(item.snapshot.name || logoId || String(n + 1)); }
      }
    }));
    if (missing.length) return reply('일부 로고를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.', 422, missing);
    for (const file of output) { if (!file) throw new Error('incomplete'); files.push({ name: file.name, data: file.data }); entries.push(file.entry); }
    const og = await logoWallPreview(wall.settings ?? {}, output.map(file => ({ data: file!.data, ...file!.entry })));
    if (new URL(request.url).searchParams.get('format') === 'preview') {
      const images = Object.fromEntries(output.map(file => [file!.name, `data:image/png;base64,${file!.data.toString('base64')}`]));
      return Response.json({ version: wall.version, settings: wall.settings, logos: entries, title: wall.title, html: logoWallInlineHtml(wall.title, wall.settings ?? {}, entries, images), image: `data:image/png;base64,${og.toString('base64')}`, count: entries.length }, { headers: privateHeaders });
    }
    const bundle = logoWallBundle(wall.title, wall.settings ?? {}, entries);
    const manifest = { format_version: 2, wall: { id: wall.id, title: wall.title, version: wall.version, settings: wall.settings }, exported_at: new Date().toISOString(), cdn_version: VERSION, logos: entries };
    files.push({ name: 'index.html', data: Buffer.from(bundle.html) });
    files.push({ name: 'styles.css', data: Buffer.from(bundle.css) });
    files.push({ name: 'script.js', data: Buffer.from(bundle.javascript) });
    files.push({ name: 'og-preview.png', data: og });
    files.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });
    files.push({ name: 'README.txt', data: Buffer.from('ZIP을 모두 풀고 index.html을 열면 로고월이 보여요. HTML 파일만 옮기지 말고 logos 폴더, styles.css, script.js를 함께 보관해 주세요.\n\n포함 파일\n- index.html: 바로 열어보는 로고월\n- styles.css: 배치와 애니메이션을 수정하는 CSS\n- script.js: 재생·일시정지 동작\n- manifest.json: 로고 순서, 크기, 배경, 배치 설정과 SHA-256 정보\n- og-preview.png: 1200×630 정적 미리보기 이미지(OG용)\n- logos/*.png: 로고별 PNG 이미지\n\n웹사이트: 위 파일을 같은 폴더 구조로 업로드하거나 HTML/CSS를 사이트에 맞게 옮겨 주세요.\n디자인·발표: og-preview.png 또는 logos 폴더의 PNG를 사용해 주세요.\n애니메이션은 index.html에서 재생되며 PNG 미리보기는 정적 이미지예요.\n이미지를 내려받아 자신의 서비스에 보관하면 세모로고 접속과 관계없이 사용할 수 있어요.\n각 브랜드의 상표와 사용 조건은 해당 권리자에게 있어요.\n') });
    return new Response(new Uint8Array(logoWallZip(files)), { headers: { ...privateHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="logo-wall-${wall.id}.zip"` } });
  } catch { return reply('다운로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.', 503); }
  finally { if (acquired) active--; }
}
