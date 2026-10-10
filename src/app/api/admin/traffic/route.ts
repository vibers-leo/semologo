import { trafficAdmin, trafficDb } from '@/lib/traffic-db';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
  try {
    if (!await trafficAdmin(request)) return reply({ error: '관리자 로그인이 필요해요.' }, 403);
    const u = new URL(request.url); const raw = Number(u.searchParams.get('days') || 7); const days = Number.isFinite(raw) ? Math.max(1, Math.min(90, Math.floor(raw))) : 7;
    const q = (u.searchParams.get('q') || '').slice(0, 120); const db = trafficDb();
    const args = [days, q];
    const sessions = await db.query(`SELECT s.*, (SELECT json_agg(t ORDER BY t.created_at) FROM (SELECT event,path,params,created_at FROM semologo.traffic_events e WHERE e.session_id=s.session_id ORDER BY created_at DESC LIMIT 100) t) events FROM semologo.traffic_sessions s WHERE last_seen>now()-$1::int*interval '1 day' AND ($2='' OR strpos(s.attribution::text,$2)>0 OR EXISTS(SELECT 1 FROM semologo.traffic_events e WHERE e.session_id=s.session_id AND strpos(e.params::text,$2)>0)) ORDER BY last_seen DESC LIMIT 100`, args);
    const summary = await db.query(`SELECT event,count(*)::int count FROM semologo.traffic_events WHERE created_at>now()-$1::int*interval '1 day' GROUP BY event`, [days]);
    const searches = await db.query(`SELECT params->>'search_term' term,count(*)::int count FROM semologo.traffic_events WHERE event='search_submitted' AND created_at>now()-$1::int*interval '1 day' GROUP BY term ORDER BY count DESC LIMIT 20`, [days]);
    const downloads = await db.query(`SELECT params->>'brand_id' brand,count(*)::int count FROM semologo.traffic_events WHERE event='logo_downloaded' AND created_at>now()-$1::int*interval '1 day' GROUP BY brand ORDER BY count DESC LIMIT 20`, [days]);
    const count = await db.query(`SELECT count(*)::int count FROM semologo.traffic_sessions WHERE last_seen>now()-$1::int*interval '1 day'`, [days]);
    const bookmarks = await db.query(`SELECT
      count(*) FILTER (WHERE event='bookmark_help_opened')::int help_opens,
      count(DISTINCT session_id) FILTER (WHERE event='bookmark_help_opened')::int interested_sessions,
      count(*) FILTER (WHERE event='bookmark_link_copied')::int link_copies,
      count(DISTINCT session_id) FILTER (WHERE event='page_view' AND params->>'entry_source'='bookmark')::int link_visit_sessions
      FROM semologo.traffic_events WHERE created_at>now()-$1::int*interval '1 day'`, [days]);
    return reply({ bookmarks: bookmarks.rows[0], sessions: sessions.rows, summary: summary.rows, searches: searches.rows, downloads: downloads.rows, visitors: count.rows[0].count, days });
  } catch { return reply({ error: '접속 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503); }
}
