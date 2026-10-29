import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { logoOwner } from './logo-owner';
import { trafficAdmin, trafficDb } from './traffic-db';

export const developerScopes = ['walls:read','walls:write','collection:request'] as const;
export type DeveloperScope = typeof developerScopes[number];
export type McpPrincipal = { owner: string; kind: 'pilot' | 'api_key'; keyId?: string; scopes: string[] };
const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
export const developerApiEnabled = () => process.env.SEMOLOGO_DEVELOPER_API_ENABLED === '1';
export function developerKeyHash(token: string) {
  const pepper = process.env.SEMOLOGO_API_KEY_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) throw new Error('api_storage_unavailable');
  return createHmac('sha256', pepper).update(token).digest('hex');
}
export async function resolveMcpPrincipal(request: Request): Promise<McpPrincipal | null> {
  const token = bearer(request);
  if (!token) return null;
  if (!token.startsWith('slk_')) {
    if (process.env.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED !== '1') return null;
    const owner = await logoOwner(request);
    const allowed=(process.env.SEMOLOGO_MCP_PILOT_OWNER_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
    return owner && allowed.includes(owner) ? { owner, kind: 'pilot', scopes: [...developerScopes] } : null;
  }
  if (!developerApiEnabled() || !/^slk_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await trafficDb().query(`SELECT id,owner_id,scopes FROM semologo.api_keys
    WHERE key_hash=$1 AND revoked_at IS NULL AND expires_at>now()`, [developerKeyHash(token)]);
  const key = result.rows[0];
  if (!key || !Array.isArray(key.scopes) || key.scopes.some((s: string) => !developerScopes.includes(s as DeveloperScope))) return null;
  await trafficDb().query(`UPDATE semologo.api_keys SET last_used_at=now()
    WHERE id=$1 AND (last_used_at IS NULL OR last_used_at<now()-interval '1 minute')`, [key.id]);
  return { owner: key.owner_id, kind: 'api_key', keyId: key.id, scopes: key.scopes };
}
/** Key management accepts the existing verified user login, never an API key. */
export async function developerLoginOwner(request: Request) {
  if (!developerApiEnabled() || bearer(request)?.startsWith('slk_')) return null;
  const owner=await logoOwner(request);
  if(owner && process.env.SEMOLOGO_DEVELOPER_PILOT_ONLY==='1' && !await trafficAdmin(request))throw new Error('pilot_invite_required');
  return owner;
}
export async function issueDeveloperKey(owner: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_key_request');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(k => !['name','scopes'].includes(k))) throw new Error('invalid_key_request');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const scopes = body.scopes === undefined ? ['walls:read','walls:write'] : body.scopes;
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) || !Array.isArray(scopes) || !scopes.length || scopes.length > 3 || new Set(scopes).size !== scopes.length || scopes.some(s => !developerScopes.includes(s))) throw new Error('invalid_key_request');
  const token = 'slk_' + randomBytes(32).toString('base64url');
  const digest = developerKeyHash(token);
  const db = await trafficDb().connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout='5000ms'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-api-keys:'||$1,0))", [owner]);
    const limits = await db.query(`SELECT count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now())::int active,
      count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int issued FROM semologo.api_keys WHERE owner_id=$1`, [owner]);
    if (limits.rows[0].active >= 5 || limits.rows[0].issued >= 20) throw new Error('api_key_limit');
    const result = await db.query(`INSERT INTO semologo.api_keys(id,owner_id,name,key_hash,key_prefix,scopes,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+interval '90 days')
      RETURNING id,name,key_prefix,scopes,created_at,expires_at,revoked_at,last_used_at`, [randomUUID(),owner,name,digest,token.slice(0,12),scopes]);
    await db.query('COMMIT');
    return { key: result.rows[0], token }; // The full token is returned only once.
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
