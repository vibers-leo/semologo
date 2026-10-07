import { Pool } from 'pg';
let pool: Pool | undefined;
export function trafficDb() {
  if (!process.env.DB_VIBERS_MAIN_URL) throw new Error('Traffic storage unavailable');
  return pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000, idleTimeoutMillis: 10000 });
}
export async function trafficAdmin(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return false;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) return false;
  const u = (await r.json()).users?.[0];
  return !!u && !u.disabled && u.emailVerified === true && u.email?.toLowerCase() === 'juuuno1116@gmail.com';
}
