import { trafficAdmin, trafficDb } from '@/lib/traffic-db';
import { fetchBrand } from '@/lib/brands';
import queue from '@/lib/svg-audit-review-queue.json';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const statuses = new Set(['failed', 'candidate-needs-review', 'existing-png-review', 'manual-review', 'opaque-awaiting-review']);
const counts = Object.fromEntries(['all', ...statuses].map(status =>
  [status, status === 'all' ? queue.total : queue.items.filter(item => item.status === status).length]));
type Review = { decision: 'replace' | 'recollect' | 'keep' | null; at: string };

export async function GET(request: Request) {
  try {
    if (!await trafficAdmin(request)) return reply({ error: '관리자 로그인이 필요해요.' }, 403);
    const params = new URL(request.url).searchParams;
    if (params.get('kind') === 'variants') {
      const id = params.get('id');
      if (id && !/^[\p{L}\p{N}._-]{1,200}$/u.test(id)) return reply({ error: '로고를 확인해 주세요.' }, 400);
      const rows = await trafficDb().query(`SELECT id,payload->'asset_review' decisions FROM semologo.logo_posts
        WHERE payload ? 'asset_review' AND ($1::text IS NULL OR id=$1) ORDER BY updated_at DESC LIMIT 200`, [id]);
      return reply({ variants: rows.rows.flatMap(row => Object.entries(row.decisions || {})
        .filter((entry): entry is [string, Review] => !!entry[1] && typeof entry[1] === 'object')
        .map(([file, review]) => ({ id: row.id, file, ...review }))) });
    }
    const status = params.get('status') || 'all';
    if (status !== 'all' && !statuses.has(status)) return reply({ error: '검토 분류를 확인해 주세요.' }, 400);
    const q = (params.get('q') || '').trim().toLocaleLowerCase().slice(0, 120);
    const rawPage = Number(params.get('page') || 1);
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.min(10000, Math.floor(rawPage))) : 1;
    const matches = queue.items.filter(item => (status === 'all' || item.status === status)
      && (!q || `${item.id} ${item.name_ko} ${item.name_en}`.toLocaleLowerCase().includes(q)));
    const items = matches.slice((page - 1) * 50, page * 50);
    const ids = items.map(item => item.id);
    const decisions = ids.length ? await trafficDb().query(`SELECT id,payload->'audit_review' review
      FROM semologo.logo_posts WHERE id=ANY($1::text[])`, [ids]) : { rows: [] };
    const byId = new Map(decisions.rows.map(row => [row.id, row.review]));
    return reply({ items: items.map(item => ({ ...item, review: byId.get(item.id) || null })), total: matches.length, page, counts });
  } catch {
    return reply({ error: '검토 목록을 불러오지 못했어요.' }, 503);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!await trafficAdmin(request)) return reply({ error: '관리자 로그인이 필요해요.' }, 403);
    const input = await request.json();
    const id = input?.id;
    const file = input?.file || '';
    const decision = input?.decision;
    if (typeof id !== 'string' || !/^[\p{L}\p{N}._-]{1,200}$/u.test(id)
      || typeof file !== 'string' || file.length > 240 || file.includes('..') || file.startsWith('/')
      || (file && !/^[A-Za-z0-9_./:-]+$/.test(file))
      || !['replace', 'recollect', 'keep', null].includes(decision)) return reply({ error: '검토 대상을 확인해 주세요.' }, 400);
    if (!file && !queue.items.some(item => item.id === id)) return reply({ error: '전수 점검 목록에 없는 로고예요.' }, 404);
    const db = trafficDb();
    let found = await db.query('SELECT id FROM semologo.logo_posts WHERE id=$1', [id]);
    if (!found.rowCount) {
      const brand = await fetchBrand(id);
      if (!brand || brand.hidden || brand.id !== id) return reply({ error: '로고를 찾지 못했어요.' }, 404);
      await db.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2::jsonb,'published') ON CONFLICT(id) DO NOTHING", [id, JSON.stringify(brand)]);
      found = await db.query('SELECT id FROM semologo.logo_posts WHERE id=$1', [id]);
    }
    if (!found.rowCount) return reply({ error: '로고를 찾지 못했어요.' }, 404);
    const value: Review = { decision, at: new Date().toISOString() };
    if (file) {
      await db.query(`UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{asset_review}',
        COALESCE(payload->'asset_review','{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb),true),updated_at=now() WHERE id=$1`,
      [id, file, JSON.stringify(value)]);
    } else {
      await db.query("UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{audit_review}',$2::jsonb,true),updated_at=now() WHERE id=$1",
        [id, JSON.stringify(value)]);
    }
    return reply({ ok: true, review: value });
  } catch {
    return reply({ error: '검토 선택을 저장하지 못했어요.' }, 503);
  }
}
