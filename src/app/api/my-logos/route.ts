import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import sharp from 'sharp';
import { logoOwner } from '@/lib/logo-owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let pool: Pool | undefined;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
let activeUploads = 0;

export async function GET(request: Request) {
  try {
    const uid = await logoOwner(request);
    if (!uid) return reply({ error: '로그인 후 이용해 주세요.' }, 401);
    if (!process.env.DB_VIBERS_MAIN_URL) return reply({ error: '저장 서비스를 준비 중이에요.' }, 503);
    pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const result = await pool.query('SELECT png FROM semologo.personal_logos WHERE id=$1 AND owner_id=$2', [id, uid]);
      if (!result.rowCount) return reply({ error: '로고를 찾을 수 없어요.' }, 404);
      return new Response(new Uint8Array(result.rows[0].png), { headers: { ...headers, 'Content-Type': 'image/png' } });
    }
    const result = await pool.query('SELECT id,name FROM semologo.personal_logos WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 20', [uid]);
    return reply({ logos: result.rows });
  } catch { return reply({ error: '내 로고를 불러오지 못했어요. 다시 시도해 주세요.' }, 503); }
}

export async function POST(request: Request) {
  let acquired = false;
  try {
    const uid = await logoOwner(request);
    if (!uid) return reply({ error: '로그인 후 이용해 주세요.' }, 401);
    if (!process.env.DB_VIBERS_MAIN_URL) return reply({ error: '저장 서비스를 준비 중이에요.' }, 503);
    if (activeUploads >= 2) return reply({ error: '다른 파일을 처리하고 있어요. 잠시 후 다시 시도해 주세요.' }, 503);
    activeUploads++; acquired = true;
    if (!request.body) return reply({ error: '파일을 선택해 주세요.' }, 400);
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 3_000_000) return reply({ error: '2MB 이하의 PNG 파일을 선택해 주세요.' }, 413);
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
    const name = form.get('name'); const file = form.get('file');
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || !(file instanceof File)) return reply({ error: '로고 이름과 PNG 파일을 확인해 주세요.' }, 400);
    if (file.size > 2_000_000) return reply({ error: '2MB 이하의 PNG 파일을 선택해 주세요.' }, 413);
    const input = Buffer.from(await file.arrayBuffer());
    if (!input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return reply({ error: 'PNG 형식의 파일을 선택해 주세요.' }, 400);
    let png: Buffer;
    try { png = await sharp(input, { limitInputPixels: 16_000_000 }).resize(640, 320, { fit: 'inside', withoutEnlargement: true }).timeout({ seconds: 3 }).png().toBuffer(); }
    catch { return reply({ error: '이 이미지를 읽을 수 없어요. 다른 PNG 파일을 선택해 주세요.' }, 400); }
    if (png.length > 256_000) return reply({ error: '이미지가 너무 복잡해요. 크기를 줄여 다시 올려주세요.' }, 413);
    pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`semologo-personal:${uid}`]);
      const hash = createHash('sha256').update(png).digest('hex');
      const existing = await db.query('SELECT id,name FROM semologo.personal_logos WHERE owner_id=$1 AND sha256=$2', [uid, hash]);
      if (existing.rowCount) { await db.query('COMMIT'); return reply({ logo: existing.rows[0], existing: true }); }
      const count = await db.query('SELECT count(*)::int AS n FROM semologo.personal_logos WHERE owner_id=$1', [uid]);
      if (count.rows[0].n >= 20) { await db.query('ROLLBACK'); return reply({ error: '내 로고는 최대 20개까지 등록할 수 있어요.' }, 409); }
      const result = await db.query('INSERT INTO semologo.personal_logos(id,owner_id,name,png,sha256) VALUES($1,$2,$3,$4,$5) RETURNING id,name', [`user-logo-${randomUUID()}`, uid, name.trim(), png, hash]);
      await db.query('COMMIT'); return reply({ logo: result.rows[0] }, 201);
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  } catch { return reply({ error: '로고를 등록하지 못했어요. 다시 시도해 주세요.' }, 503); }
  finally { if (acquired) activeUploads--; }
}
