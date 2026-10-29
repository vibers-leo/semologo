import { randomUUID } from 'node:crypto';
import { trafficDb } from './traffic-db';

const metrics=['wall_plan','wall_create','wall_read','wall_preview','collection_request','collection_resume'];
const grantReference='operator-private-pilot-v1-20261029';
export const pilotPolicy={eligible:true,grantReference,durationDays:7,unitsPerMetric:25};
const select=`SELECT e.id,e.metric,e.state,e.period_start,e.period_end,e.hard_limit,
  coalesce(b.used_units,0) used_units,coalesce(b.reserved_units,0) reserved_units,
  greatest(0,e.hard_limit-coalesce(b.used_units,0)-coalesce(b.reserved_units,0)) remaining_units
  FROM semologo.api_entitlements e LEFT JOIN semologo.api_usage_balances b ON b.entitlement_id=e.id
  WHERE e.owner_id=$1 AND e.plan_reference=$2 ORDER BY e.metric`;
export async function developerPilotStatus(owner:string){
  const r=await trafficDb().query(select,[owner,grantReference]);
  return {pilot:{...pilotPolicy,provisioned:r.rows.length>0},grants:r.rows};
}
/** One explicit operator allowance, never a paid subscription or a quota reset. */
export async function provisionDeveloperPilot(owner:string){
  const db=await trafficDb().connect();
  try{
    await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5000ms'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-api-usage:'||$1,0))",[owner]);
    const existing=await db.query(select,[owner,grantReference]);
    if(existing.rows.length){
      if(existing.rows.length!==metrics.length || metrics.some(metric=>!existing.rows.some(row=>row.metric===metric)))throw new Error('pilot_configuration_conflict');
      await db.query('COMMIT');
      return {pilot:{...pilotPolicy,provisioned:true},grants:existing.rows,created:false};
    }
    const overlap=await db.query(`SELECT id FROM semologo.api_entitlements WHERE owner_id=$1 AND metric=ANY($2::text[])
      AND state='active' AND period_start<now()+interval '7 days' AND period_end>now() FOR UPDATE`,[owner,metrics]);
    if(overlap.rowCount)throw new Error('pilot_allowance_conflict');
    for(const metric of metrics){
      const id=randomUUID();
      await db.query(`INSERT INTO semologo.api_entitlements(id,owner_id,metric,plan_reference,period_start,period_end,hard_limit)
        VALUES($1,$2,$3,$4,now(),now()+interval '7 days',25)`,[id,owner,metric,grantReference]);
      await db.query('INSERT INTO semologo.api_usage_balances(entitlement_id) VALUES($1)',[id]);
    }
    const result=await db.query(select,[owner,grantReference]);
    await db.query('COMMIT');
    return {pilot:{...pilotPolicy,provisioned:true},grants:result.rows,created:true};
  }catch(error){await db.query('ROLLBACK');throw error;}
  finally{db.release();}
}
