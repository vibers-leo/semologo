import { developerApiEnabled, developerLoginOwner } from '@/lib/developer-api-auth';
import { trafficDb } from '@/lib/traffic-db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){
  if(!developerApiEnabled())return reply({error:'developer_unavailable'},503);
  try{
    const owner=await developerLoginOwner(request);
    if(!owner)return reply({error:'unauthorized'},401);
    const result=await trafficDb().query(`SELECT e.id,e.metric,e.plan_reference,e.state,e.period_start,e.period_end,e.hard_limit,
      coalesce(b.used_units,0) used_units,coalesce(b.reserved_units,0) reserved_units,
      greatest(0,e.hard_limit-coalesce(b.used_units,0)-coalesce(b.reserved_units,0)) remaining_units
      FROM semologo.api_entitlements e LEFT JOIN semologo.api_usage_balances b ON b.entitlement_id=e.id
      WHERE e.owner_id=$1 ORDER BY e.period_start DESC LIMIT 100`,[owner]);
    return reply({entitlements:result.rows,automaticOverage:false,billingEnabled:false,unit:'service-operation; prices are not activated'});
  }catch(error){return error instanceof Error && error.message==='pilot_invite_required'?reply({error:'pilot_invite_required'},403):reply({error:'developer_unavailable'},503);}
}
