import { developerApiEnabled, developerLoginOwner, issueDeveloperKey } from '@/lib/developer-api-auth';
import { trafficDb } from '@/lib/traffic-db';
import { readWallRequest } from '@/lib/logo-wall-request';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } });
async function handle(request: Request) {
  if (!developerApiEnabled()) return reply({ error:'developer_unavailable' },503);
  try {
    const owner = await developerLoginOwner(request);
    if (!owner) return reply({ error:'unauthorized' },401);
    if (request.method === 'GET') {
      const keys = await trafficDb().query(`SELECT id,name,key_prefix,scopes,created_at,expires_at,revoked_at,last_used_at
        FROM semologo.api_keys WHERE owner_id=$1
        ORDER BY (revoked_at IS NULL AND expires_at>now()) DESC,created_at DESC LIMIT 100`,[owner]);
      return reply({ keys:keys.rows });
    }
    if (request.method === 'POST') {
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({ error:'unsupported_media_type' },415);
      let input;
      try { input=JSON.parse(await readWallRequest(request,4096)); }
      catch (error) { return reply({ error:error instanceof Error && error.message==='request_too_large'?'request_too_large':'invalid_key_request' },error instanceof Error && error.message==='request_too_large'?413:400); }
      return reply(await issueDeveloperKey(owner,input),201);
    }
    const id=new URL(request.url).searchParams.get('id');
    if (!id || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) return reply({ error:'invalid_key_id' },400);
    const result=await trafficDb().query(`UPDATE semologo.api_keys SET revoked_at=coalesce(revoked_at,now())
      WHERE id=$1 AND owner_id=$2 RETURNING id`,[id,owner]);
    return result.rowCount ? reply({ revoked:true,id }) : reply({ error:'key_not_found' },404);
  } catch (error) {
    const code=error instanceof Error?error.message:'';
    if(code==='pilot_invite_required')return reply({error:code},403);
    return code==='invalid_key_request'?reply({error:code},400):code==='api_key_limit'?reply({error:code},429):reply({error:'developer_unavailable'},503);
  }
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
