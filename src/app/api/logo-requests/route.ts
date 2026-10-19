import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

let pool: Pool | undefined;
function db() {
  if (!process.env.DB_VIBERS_MAIN_URL) return null;
  return pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 3, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
}
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function isAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return false;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }), cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const user = (await response.json()).users?.[0];
    return Boolean(user && !user.disabled && user.email === 'juuuno1116@gmail.com');
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  if (!await isAdmin(request)) return reply({ error: '관리자 로그인 후 확인해 주세요.' }, 403);
  const database = db();
  if (!database) return reply({ error: '요청 목록을 불러오지 못했어요.' }, 503);
  try {
    const result = await database.query(`SELECT id,message,requested_name,official_url,status,priority,request_count,
      fleet_job_id,published_brand_id,created_at FROM semologo.logo_request_queue
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'discovering' THEN 1 WHEN 'review_required' THEN 2 ELSE 3 END,
      priority DESC,request_count DESC,created_at ASC LIMIT 200`);
    return reply({ requests: result.rows });
  } catch { return reply({ error: '요청 목록을 불러오지 못했어요.' }, 503); }
}

function requestName(message: string) {
  const withoutUrl = message.replace(/https?:\/\/\S+/gi, '').trim();
  const namedLogo = withoutUrl.match(/^(.+?)\s+(?:(?:의\s*)?로고(?:를|가|도)?|logo)(?:\s|$)/i);
  if (namedLogo?.[1]?.trim()) return namedLogo[1].trim().replace(/의$/, '').slice(0, 120);
  const clean = withoutUrl.replace(/(?:^|\s)(?:의\s*)?로고(?:를|가|도)?(?=\s|$)|\blogo\b/gi, ' ')
    .replace(/(?:수집|등록|추가|찾아|올려|구해)(?:해|해줘|주세요|주실\s*수\s*있나요)?/g, ' ')
    .replace(/(?:주세요|부탁해요|부탁드립니다|필요해요|원해요|요청해요)$/g, ' ')
    .replace(/[?!.,]+$/g, '').replace(/\s+/g, ' ').trim();
  return (clean || withoutUrl || message).slice(0, 120);
}

export async function POST(request: NextRequest) {
  const database = db();
  if (!database) return reply({ error: '지금 요청을 저장할 수 없어요. 잠시 후 다시 보내 주세요.' }, 503);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 2000) return reply({ error: '요청을 조금 짧게 적어 주세요.' }, 413);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return reply({ error: '요청 내용을 확인해 주세요.' }, 400); }
  const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
    ? data.message.replace(/\s+/g, ' ').trim() : '';
  if (message.length < 2 || message.length > 240) return reply({ error: '필요한 로고를 2~240자로 알려 주세요.' }, 400);
  const urlMatch = message.match(/https?:\/\/[^\s]+/i);
  let officialUrl: string | null = null;
  if (urlMatch) {
    try {
      const url = new URL(urlMatch[0].replace(/[.,!?]+$/, ''));
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname.length <= 253) officialUrl = url.origin;
    } catch { /* Keep the message even if its URL is malformed. */ }
  }
  const name = requestName(message);
  const key = createHash('sha256').update(name.toLocaleLowerCase('ko-KR')).digest('hex');
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
  const requesterHash = createHash('sha256').update(`${process.env.DB_VIBERS_MAIN_URL}:${ip}`).digest('hex');
  try {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const recent = await client.query('SELECT count(*)::int AS n FROM semologo.logo_request_queue WHERE requester_hash=$1 AND created_at > now() - interval \'1 hour\'', [requesterHash]);
      if (recent.rows[0].n >= 5) { await client.query('ROLLBACK'); return reply({ error: '요청을 많이 보내셨어요. 한 시간 뒤에 다시 남겨 주세요.' }, 429); }
      const result = await client.query(`INSERT INTO semologo.logo_request_queue
        (id,request_key,message,requested_name,official_url,requester_hash)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(request_key) DO UPDATE SET
          request_count=semologo.logo_request_queue.request_count+1,
          priority=GREATEST(semologo.logo_request_queue.priority,100),
          official_url=COALESCE(semologo.logo_request_queue.official_url,EXCLUDED.official_url),
          updated_at=now()
        RETURNING id,status,published_brand_id`, [randomUUID(), key, message, name, officialUrl, requesterHash]);
      await client.query('COMMIT');
      return reply({ ok: true, id: result.rows[0].id, status: result.rows[0].status, brandId: result.rows[0].published_brand_id }, 201);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) {
    const failure = error as { code?: string; name?: string };
    console.error('logo request save failed', { code: failure.code, name: failure.name });
    return reply({ error: '지금 요청을 저장할 수 없어요. 잠시 후 다시 보내 주세요.' }, 503);
  }
}
