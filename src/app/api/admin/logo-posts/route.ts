import { trafficAdmin, trafficDb } from '@/lib/traffic-db';
import { cmsBrand } from '@/lib/cms-brand';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
  try {
    if (!await trafficAdmin(request)) return reply({ error: '관리자 로그인이 필요해요.' }, 403);
    const u = new URL(request.url); const q = (u.searchParams.get('q') || '').trim().slice(0,120);
    const status = u.searchParams.get('status') || 'published';
    if (!['draft','published','archived'].includes(status)) return reply({ error: '게시 상태를 확인해 주세요.' },400);
    const raw = Number(u.searchParams.get('page') || 1); const page = Number.isFinite(raw) ? Math.max(1,Math.min(10000,Math.floor(raw))) : 1;
    const db = trafficDb(); const args=[status,q];
    const where="p.status=$1 AND ($2='' OR strpos(lower(coalesce(p.payload->>'name_ko','')||' '||coalesce(p.payload->>'name_en','')||' '||p.id),lower($2))>0)";
    const [rows,count]=await Promise.all([
      db.query(`SELECT p.id,p.payload,p.status,p.updated_at,jsonb_build_object('label',v.label,'year',v.introduced_year,'review_status',v.review_status) logo_version FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE ${where} ORDER BY p.updated_at DESC,p.id LIMIT 50 OFFSET $3`,[...args,(page-1)*50]),
      db.query(`SELECT count(*)::int total FROM semologo.logo_posts p WHERE ${where}`,args),
    ]);
    return reply({posts:rows.rows.map(r=>({...cmsBrand(r.id,r.payload),status:r.status,updated_at:r.updated_at,logo_version:r.logo_version})),total:count.rows[0].total,page});
  } catch { return reply({error:'로고 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'},503); }
}
export async function PATCH(request: Request) {
  try {
    if (!await trafficAdmin(request)) return reply({error:'관리자 로그인이 필요해요.'},403);
    const input=await request.json();
    if (typeof input.id!=='string' || !/^[\p{L}\p{N}._-]{1,200}$/u.test(input.id) || !['draft','published','archived'].includes(input.status)) return reply({error:'로고와 게시 상태를 확인해 주세요.'},400);
    // Only change publication state. Assets and human review decisions remain intact.
    const r=await trafficDb().query(`UPDATE semologo.logo_posts SET status=$2,payload=jsonb_set(payload,'{status}',to_jsonb($2::text)),updated_at=now() WHERE id=$1 RETURNING id`,[input.id,input.status]);
    return r.rowCount===1 ? reply({ok:true}) : reply({error:'로고를 찾지 못했어요.'},404);
  } catch { return reply({error:'게시 상태를 저장하지 못했어요. 다시 시도해 주세요.'},503); }
}
