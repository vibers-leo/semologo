import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
let pool: Pool | undefined;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

// Ask Firebase to validate the existing login token; never trust a client-supplied UID.
async function owner(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }), cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  const user = result.users?.[0];
  return user && !user.disabled && typeof user.localId === 'string' ? user.localId : null;
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
export async function PUT(request: Request) { return handle(request); }
export async function DELETE(request: Request) { return handle(request); }

async function handle(request: Request) {
  try {
    const uid = await owner(request);
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
      const items = await pool.query('SELECT item_id,brand_id,position,asset_snapshot FROM semologo.logo_wall_items WHERE wall_id=$1 ORDER BY position', [id]);
      return reply({ wall: { ...wall.rows[0], items: items.rows } });
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
    if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120 || !Array.isArray(body.brandIds) || body.brandIds.length > 100 || body.brandIds.some((b: unknown) => typeof b !== 'string' || !/^[\w가-힣-]{1,200}$/.test(b))) {
      return reply({ error: '제목과 최대 100개의 브랜드를 선택해 주세요.' }, 400);
    }
    if (request.method === 'PUT' && (!id || !Number.isInteger(body.version) || body.version < 1)) return reply({ error: 'ID와 저장 버전이 필요해요.' }, 400);
    const settings = body.settings ?? { background: 'auto', columns: 4 };
    if (!settings || !['auto', 'light', 'dark'].includes(settings.background) || ![2, 3, 4, 6].includes(settings.columns)) return reply({ error: '배경과 배치 설정을 확인해 주세요.' }, 400);
    const layout = { background: settings.background, columns: settings.columns };
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const brands = await db.query("SELECT id,payload FROM semologo.logo_posts WHERE id=ANY($1::text[]) AND status='published'", [body.brandIds]);
      const byId = new Map(brands.rows.map(b => [b.id, b.payload]));
      if (body.brandIds.some((b: string) => !byId.has(b))) { await db.query('ROLLBACK'); return reply({ error: '공개된 브랜드만 추가할 수 있어요.' }, 400); }
      const wallId = request.method === 'POST' ? randomUUID() : id!;
      let wall;
      if (request.method === 'POST') {
        wall = await db.query('INSERT INTO semologo.logo_walls(id,owner_id,title,settings) VALUES($1,$2,$3,$4) RETURNING id,title,version,settings', [wallId, uid, body.title.trim(), layout]);
      } else {
        wall = await db.query('UPDATE semologo.logo_walls SET title=$3,version=version+1,updated_at=now(),settings=$5 WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING id,title,version,settings', [wallId, uid, body.title.trim(), body.version, layout]);
        if (!wall.rowCount) { await db.query('ROLLBACK'); return reply({ error: '로고월이 변경됐거나 접근할 수 없어요. 다시 불러와 주세요.' }, 409); }
        await db.query('DELETE FROM semologo.logo_wall_items WHERE wall_id=$1', [wallId]);
      }
      for (let i = 0; i < body.brandIds.length; i++) {
        const brandId = body.brandIds[i];
        const brand = byId.get(brandId);
        // Freeze the selected metadata. Export will later materialize immutable assets.
        const snapshot = { name: brand.name_ko, logo_png: brand.logo_png, has_png: brand.has_png, light: brand.light || brand.light_logo || brand.dark_variant === 'white', source: brand.sources, captured_at: new Date().toISOString() };
        await db.query('INSERT INTO semologo.logo_wall_items(wall_id,item_id,brand_id,position,asset_snapshot) VALUES($1,$2,$3,$4,$5)', [wallId, randomUUID(), brandId, i, snapshot]);
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
