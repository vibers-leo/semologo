import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { logoOwner } from '@/lib/logo-owner';
import { logoWallLayout } from '@/lib/logo-wall-layout';
import { cmsBrand, logoWallAsset } from '@/lib/cms-brand';
import { fetchVariants, type Brand } from '@/lib/brands';
import { wallVariant } from '@/lib/logo-wall-variant';

export const dynamic = 'force-dynamic';
let pool: Pool | undefined;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
export async function PUT(request: Request) { return handle(request); }
export async function DELETE(request: Request) { return handle(request); }

async function handle(request: Request) {
  try {
    const uid = await logoOwner(request);
    if (!uid) return reply({ error: '로그인 후 이용해 주세요.' }, 401);
    if (!process.env.DB_VIBERS_MAIN_URL) return reply({ error: '저장 서비스를 준비 중이에요.' }, 503);
    pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 3, connectionTimeoutMillis: 5000 });
    const id = new URL(request.url).searchParams.get('id');
    if (request.method === 'GET') {
      if (!id) {
        const list = await pool.query('SELECT id,title,settings,version,updated_at FROM semologo.logo_walls WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100', [uid]);
        return reply({ walls: list.rows });
      }
      const wall = await pool.query('SELECT id,title,settings,version,updated_at FROM semologo.logo_walls WHERE id=$1 AND owner_id=$2', [id, uid]);
      if (!wall.rowCount) return reply({ error: '로고월을 찾을 수 없어요.' }, 404);
      const items = await pool.query('SELECT i.item_id,i.brand_id,i.position,i.asset_snapshot,p.payload FROM semologo.logo_wall_items i LEFT JOIN semologo.logo_posts p ON p.id=i.brand_id WHERE i.wall_id=$1 ORDER BY i.position', [id]);
      const restored = items.rows.map(item => {
        if (!item.payload || item.asset_snapshot.user_logo_id || item.asset_snapshot.variant_key) { const { payload: _, ...ownItem } = item; return ownItem; }
        const asset = logoWallAsset(item.brand_id, item.payload, item.asset_snapshot);
        return { item_id: item.item_id, brand_id: item.brand_id, position: item.position, asset_snapshot: { ...item.asset_snapshot, logo_png: asset.logo_png, logo_svg: asset.logo_svg, has_png: asset.has_png, preview_png: asset.preview_png, light: asset.light } };
      });
      return reply({ wall: { ...wall.rows[0], items: restored } });
    }
    if (request.method === 'DELETE') {
      if (!id) return reply({ error: '로고월 ID가 필요해요.' }, 400);
      const deleted = await pool.query('DELETE FROM semologo.logo_walls WHERE id=$1 AND owner_id=$2 RETURNING id', [id, uid]);
      return deleted.rowCount ? reply({ deleted: id }) : reply({ error: '로고월을 찾을 수 없어요.' }, 404);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 64_000) return reply({ error: '로고월 데이터가 너무 커요.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: '요청 내용을 확인해 주세요.' }, 400); }
    if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) return reply({ error: '제목을 입력해 주세요.' }, 400);
    const choices: { brandId: string; scale?: number; variantKey?: string; cardBackground?: string }[] = body.items ?? (Array.isArray(body.brandIds) ? body.brandIds.map((brandId: string) => ({ brandId })) : null);
    if (!Array.isArray(choices) || choices.length > 100 || choices.some(b => !b || typeof b.brandId !== 'string' || !/^[\w가-힣-]{1,200}$/.test(b.brandId) || (b.variantKey !== undefined && (typeof b.variantKey !== 'string' || !/^[\w가-힣.-]{1,200}$/.test(b.variantKey))) || (b.scale !== undefined && (!Number.isFinite(b.scale) || b.scale < 50 || b.scale > 150)) || (b.cardBackground !== undefined && !['inherit','white','light','dark'].includes(b.cardBackground)))) return reply({ error: '최대 100개의 로고와 배경을 선택해 주세요.' }, 400);
    if (new Set(choices.map(b => `${b.brandId}:${b.variantKey || ''}`)).size !== choices.length) return reply({ error: '같은 변형은 한 번만 추가할 수 있어요. 다른 변형을 골라 주세요.' }, 400);
    const brandIds = choices.map(b => b.brandId);
    if (request.method === 'PUT' && (!id || !Number.isInteger(body.version) || body.version < 1)) return reply({ error: 'ID와 저장 버전이 필요해요.' }, 400);
    let layout;
    try { layout = logoWallLayout(body.settings); } catch { return reply({ error: '로고월 배치 설정을 확인해 주세요.' }, 400); }
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const brands = await db.query("SELECT id,payload FROM semologo.logo_posts WHERE id=ANY($1::text[]) AND status='published'", [brandIds]);
      const byId = new Map<string, Brand & { user_logo_id?: string }>(brands.rows.map(b => [b.id, cmsBrand(b.id, b.payload)]));
      const personal = await db.query('SELECT id,name FROM semologo.personal_logos WHERE owner_id=$1 AND id=ANY($2::text[])', [uid, brandIds]);
      for (const b of personal.rows) byId.set(b.id, { id: b.id, name_ko: b.name, name_en: '', category: '', user_logo_id: b.id });
      if (brandIds.some((b: string) => !byId.has(b) || byId.get(b)?.hidden)) { await db.query('ROLLBACK'); return reply({ error: '검수된 공개 브랜드 또는 내 계정에 등록한 로고만 추가할 수 있어요.' }, 400); }
      // Resolve variant keys against the reviewed server manifest; ignore caller asset URLs.
      const assets = [];
      for (const choice of choices) {
        const brand = byId.get(choice.brandId)!;
        if (!choice.variantKey) { assets.push(brand); continue; }
        const manifest = brand.user_logo_id ? null : await fetchVariants(choice.brandId);
        const variant = manifest?.variants.find(v => v.key === choice.variantKey);
        const asset = variant ? wallVariant(brand, variant) : null;
        if (!asset) { await db.query('ROLLBACK'); return reply({ error: '선택한 로고 변형을 찾을 수 없어요. 다시 선택해 주세요.' }, 400); }
        assets.push({ ...asset, user_logo_id: undefined });
      }
      const wallId = request.method === 'POST' ? randomUUID() : id!;
      let wall;
      if (request.method === 'POST') {
        wall = await db.query('INSERT INTO semologo.logo_walls(id,owner_id,title,settings) VALUES($1,$2,$3,$4) RETURNING id,title,version,settings', [wallId, uid, body.title.trim(), layout]);
      } else {
        wall = await db.query('UPDATE semologo.logo_walls SET title=$3,version=version+1,updated_at=now(),settings=$5 WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING id,title,version,settings', [wallId, uid, body.title.trim(), body.version, layout]);
        if (!wall.rowCount) { await db.query('ROLLBACK'); return reply({ error: '로고월이 변경됐거나 접근할 수 없어요. 다시 불러와 주세요.' }, 409); }
        await db.query('DELETE FROM semologo.logo_wall_items WHERE wall_id=$1', [wallId]);
      }
      for (let i = 0; i < choices.length; i++) {
        const brandId = choices[i].brandId;
        const brand = assets[i];
        // Freeze the selected metadata. Export will later materialize immutable assets.
        const snapshot = { scale: choices[i].scale || 100, variant_key: choices[i].variantKey, variant_label: 'variantLabel' in brand ? brand.variantLabel : undefined, card_background: choices[i].cardBackground || 'inherit', user_logo_id: brand.user_logo_id, name: brand.name_ko, logo_png: brand.logo_png, preview_png: brand.preview_png, logo_svg: brand.logo_svg, has_png: brand.has_png, light: brand.light || brand.light_logo || brand.dark_variant === 'white', source: brand.sources, captured_at: new Date().toISOString() };
        await db.query('INSERT INTO semologo.logo_wall_items(wall_id,item_id,brand_id,position,asset_snapshot) VALUES($1,$2,$3,$4,$5)', [wallId, randomUUID(), brand.user_logo_id ? null : brandId, i, snapshot]);
      }
      await db.query('COMMIT');
      return reply({ wall: wall.rows[0] }, request.method === 'POST' ? 201 : 200);
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  } catch (error) {
    // Log codes only: request tokens, URLs and database credentials must stay private.
    const failure = error as { name?: string; code?: string; cause?: { code?: string } };
    console.error('logo-walls operation failed', { name: failure?.name, code: failure?.code ?? failure?.cause?.code });
    return reply({ error: '지금 저장 서비스에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.' }, 503);
  }
}
