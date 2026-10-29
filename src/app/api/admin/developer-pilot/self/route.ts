import { developerApiEnabled } from '@/lib/developer-api-auth';
import { developerPilotStatus, provisionDeveloperPilot } from '@/lib/developer-api-pilot';
import { logoOwner } from '@/lib/logo-owner';
import { trafficAdmin } from '@/lib/traffic-db';
import { readWallRequest } from '@/lib/logo-wall-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function handle(request:Request){
  if(!developerApiEnabled() || process.env.SEMOLOGO_PILOT_GRANTS_ENABLED!=='1')return reply({error:'developer_unavailable'},503);
  try{
    if(!await trafficAdmin(request))return reply({error:'pilot_invite_required'},403);
    const owner=await logoOwner(request);
    if(!owner)return reply({error:'unauthorized'},401);
    if(request.method==='GET')return reply(await developerPilotStatus(owner));
    const contentType=request.headers.get('content-type');
    if(contentType && contentType.split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'unsupported_media_type'},415);
    const raw=await readWallRequest(request,1024);let body;
    try{body=JSON.parse(raw||'{}');}catch{return reply({error:'invalid_pilot_request'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return reply({error:'invalid_pilot_request'},400);
    return reply(await provisionDeveloperPilot(owner));
  }catch(error){
    const code=error instanceof Error?error.message:'';
    if(code==='pilot_allowance_conflict'||code==='pilot_configuration_conflict')return reply({error:code},409);
    if(code==='request_too_large')return reply({error:code},413);
    return reply({error:'developer_unavailable'},503);
  }
}
export const GET=handle;
export const POST=handle;
