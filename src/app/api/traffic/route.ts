import { createHash } from 'node:crypto';
import { trafficDb } from '@/lib/traffic-db';
import { normalizeTraffic } from '@/lib/traffic-validation';
export const dynamic = 'force-dynamic';
const reply = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
const buckets = new Map<string, { at: number; count: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = ['https://semologo.com', 'https://www.semologo.com'];
  if (process.env.NODE_ENV !== 'production') allowed.push(new URL(request.url).origin);
  if (!origin || !allowed.includes(origin)) return reply(403);
  if (Number(request.headers.get('content-length') || 0) > 8192) return reply(413);
  const now = Date.now();
  // Only a short-lived hash is kept for abuse control; neither IP nor hash is stored in PostgreSQL.
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const hash = createHash('sha256').update(`${Math.floor(now / 60000)}:${ip}`).digest('hex');
  if (buckets.size > 10000) buckets.clear();
  const bucket = buckets.get(hash) || { at: now, count: 0 };
  if (++bucket.count > 120) return reply(429);
  buckets.set(hash, bucket);
  for (const [key, value] of buckets) if (now - value.at > 60000) buckets.delete(key);
  try {
    if (!request.body) return reply(400);
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) return reply(413); chunks.push(part.value); } } finally { await reader.cancel(); }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.length > 8192) return reply(413);
    const b = normalizeTraffic(JSON.parse(text));
    if (!b) return reply(400);
    if (b.path.startsWith('/admin')) return reply(204);
    const db = await trafficDb().connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [b.session]);
      const count = await db.query('SELECT count(*)::int n FROM semologo.traffic_events WHERE session_id=$1 AND created_at>now()-interval \'1 day\'', [b.session]);
      if (count.rows[0].n >= 500) { await db.query('ROLLBACK'); return reply(429); }
      await db.query(`INSERT INTO semologo.traffic_sessions(session_id,attribution,device,browser) VALUES($1,$2,$3,$4) ON CONFLICT(session_id) DO UPDATE SET last_seen=now()`, [b.session, JSON.stringify(b.attribution), /Mobile|Android/i.test(request.headers.get('user-agent') || '') ? '모바일' : '데스크톱', /Edg/i.test(request.headers.get('user-agent') || '') ? 'Edge' : /Chrome/i.test(request.headers.get('user-agent') || '') ? 'Chrome' : /Firefox/i.test(request.headers.get('user-agent') || '') ? 'Firefox' : 'Safari / 기타']);
      await db.query('INSERT INTO semologo.traffic_events(session_id,event,path,params) VALUES($1,$2,$3,$4)', [b.session, b.event, b.path, JSON.stringify(b.params)]);
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
    return reply(204);
  } catch { return reply(503); }
}
