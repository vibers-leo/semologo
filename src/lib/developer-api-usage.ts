import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { McpPrincipal } from './developer-api-auth';
import { trafficDb } from './traffic-db';

// Service usage units only. Prices, currency and payment approvals are not inferred.
const tools: Record<string, { metric: string; scopes: string[]; writes: boolean }> = {
  prepare_logo_wall: { metric:'wall_plan', scopes:['walls:read'], writes:false },
  create_logo_wall: { metric:'wall_create', scopes:['walls:write'], writes:true },
  get_logo_wall: { metric:'wall_read', scopes:['walls:read'], writes:false },
  preview_logo_wall: { metric:'wall_preview', scopes:['walls:read'], writes:false },
  collect_missing_logo_wall: { metric:'collection_request', scopes:['walls:write','collection:request'], writes:true },
  resume_logo_wall: { metric:'collection_resume', scopes:['walls:write','collection:request'], writes:true },
};
const canonical = (value: unknown): string => Array.isArray(value) ? '['+value.map(canonical).join(',')+']' : value && typeof value==='object' ? '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}' : JSON.stringify(value) ?? 'null';
const safeFailures = new Set(['invalid_collection','collection_not_found','collection_needs_explicit_names','collection_rate_limited','too_many_missing_logos','invalid_style','invalid_selection','invalid_settings','invalid_names','invalid_sector','invalid_origin','invalid_count','invalid_title','invalid_partial','unknown_selection_field','choose_names_or_sector','selection_needs_review','wall_not_found','invalid_wall_id']);
type UsageEvent = { id:string; entitlement_id?:string; request_hash:string; state:string; result_json: {kind:'value'|'read';value?:unknown;fingerprint?:string}|null; error_code?:string };
async function transaction<T>(fn: (db:PoolClient)=>Promise<T>):Promise<T> {
  const db=await trafficDb().connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout='5000ms'");
    const result=await fn(db);
    await db.query('COMMIT');
    return result;
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
async function reserve(principal:McpPrincipal,metric:string,key:string,hash:string,writes:boolean) {
  return transaction(async db=>{
    // Owner lock serializes retries and different keys competing for one allowance.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-api-usage:'||$1,0))",[principal.owner]);
    const live=await db.query(`SELECT id FROM semologo.api_keys WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL AND expires_at>now()`,[principal.keyId,principal.owner]);
    if(!live.rowCount)throw new Error('api_scope_denied');
    const previous=await db.query<UsageEvent>('SELECT id,entitlement_id,request_hash,state,result_json,error_code FROM semologo.api_usage_events WHERE owner_id=$1 AND request_key=$2 FOR UPDATE',[principal.owner,key]);
    if(previous.rowCount){
      const event=previous.rows[0];
      if(event.request_hash!==hash)throw new Error('api_idempotency_conflict');
      if(event.state==='reserved')throw new Error('api_request_in_progress');
      if(event.state==='indeterminate')throw new Error('api_request_indeterminate');
      if(event.state==='voided')throw new Error(event.error_code&&safeFailures.has(event.error_code)?event.error_code:'api_result_not_replayable');
      if(!writes){
        const liveGrant=await db.query(`SELECT id FROM semologo.api_entitlements WHERE id=$1 AND owner_id=$2
          AND state='active' AND period_start<=now() AND period_end>now()`,[event.entitlement_id,principal.owner]);
        if(!liveGrant.rowCount)throw new Error('api_entitlement_required');
        if(event.result_json?.kind==='read'){
          const retry=await db.query(`UPDATE semologo.api_usage_events SET read_replay_count=read_replay_count+1
            WHERE id=$1 AND owner_id=$2 AND read_replay_count<1 AND finished_at>now()-interval '2 minutes' RETURNING id`,[event.id,principal.owner]);
          if(!retry.rowCount)throw new Error('api_result_not_replayable');
        }
      }
      return {event,replay:true};
    }
    const grants=await db.query(`SELECT id,hard_limit FROM semologo.api_entitlements WHERE owner_id=$1 AND metric=$2
      AND state='active' AND period_start<=now() AND period_end>now() ORDER BY period_start DESC LIMIT 2 FOR UPDATE`,[principal.owner,metric]);
    if(grants.rowCount!==1)throw new Error(grants.rowCount?'api_usage_unavailable':'api_entitlement_required');
    const grant=grants.rows[0];
    await db.query('INSERT INTO semologo.api_usage_balances(entitlement_id) VALUES($1) ON CONFLICT DO NOTHING',[grant.id]);
    const balance=await db.query(`UPDATE semologo.api_usage_balances SET reserved_units=reserved_units+1
      WHERE entitlement_id=$1 AND used_units+reserved_units<$2 RETURNING entitlement_id`,[grant.id,grant.hard_limit]);
    if(!balance.rowCount)throw new Error('api_quota_exceeded');
    const result=await db.query<UsageEvent>(`INSERT INTO semologo.api_usage_events(id,owner_id,api_key_id,entitlement_id,metric,request_key,request_hash,reserved_units,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,1,'reserved') RETURNING id,request_hash,state,result_json`,[randomUUID(),principal.owner,principal.keyId,grant.id,metric,key,hash]);
    return {event:result.rows[0],replay:false};
  });
}
async function settle(owner:string,id:string,units:0|1,state:'succeeded'|'voided',result:unknown,error?:string) {
  return transaction(async db=>{
    const rows=await db.query(`SELECT entitlement_id,state FROM semologo.api_usage_events WHERE id=$1 AND owner_id=$2 FOR UPDATE`,[id,owner]);
    if(rows.rowCount!==1)throw new Error('api_usage_unavailable');
    if(rows.rows[0].state==='succeeded'||rows.rows[0].state==='voided')return;
    if(rows.rows[0].state!=='reserved')throw new Error('api_request_indeterminate');
    const balance=await db.query(`UPDATE semologo.api_usage_balances SET reserved_units=reserved_units-1,used_units=used_units+$2
      WHERE entitlement_id=$1 AND reserved_units>=1 RETURNING entitlement_id`,[rows.rows[0].entitlement_id,units]);
    if(!balance.rowCount)throw new Error('api_usage_unavailable');
    await db.query(`UPDATE semologo.api_usage_events SET state=$3,charged_units=$4,result_json=$5,error_code=$6,finished_at=now()
      WHERE id=$1 AND owner_id=$2`,[id,owner,state,units,result===null?null:JSON.stringify(result),error??null]);
  });
}
function cacheResult(result:unknown,writes:boolean) {
  const value=result as Record<string,unknown>|null;
  const json=JSON.stringify(result)??'null';
  // Bounded metadata replies can be replayed exactly without executing another read.
  // Images get one short-lived retry and must render the identical wall/version.
  if(!writes&&(typeof value?.previewPngBase64==='string'||Buffer.byteLength(json)>131072))return {kind:'read',fingerprint:createHash('sha256').update(json).digest('hex')};
  if(Buffer.byteLength(json)<=131072)return {kind:'value',value:JSON.parse(json)};
  // Preserve the committed resource IDs even for exceptionally large selection plans.
  const compact:Record<string,unknown>={replayed:true,detailsTruncated:true};
  if(typeof value?.created==='boolean')compact.created=value.created;
  for(const k of ['wallId','sessionId','editorPath','status','nextAction'])if(typeof value?.[k]==='string')compact[k]=(value[k] as string).slice(0,k==='editorPath'?2048:k==='nextAction'?500:100);
  if(value?.wall&&typeof value.wall==='object'){
    const wall=value.wall as Record<string,unknown>;
    compact.wall={id:typeof wall.id==='string'?wall.id.slice(0,100):undefined,version:typeof wall.version==='number'?wall.version:undefined};
  }
  if(Buffer.byteLength(JSON.stringify(compact))>131072)return {kind:'value',value:{replayed:true,detailsTruncated:true}};
  return {kind:'value',value:compact};
}
/** Explicit allowance + durable reservation; no actual payment or automatic overage. */
export async function meteredMcpTool(principal:McpPrincipal,name:string,args:unknown,request:Request,fn:()=>Promise<unknown>):Promise<unknown> {
  if(principal.kind==='pilot')return fn();
  const policy=tools[name];
  if(!principal.keyId||!policy||policy.scopes.some(s=>!principal.scopes.includes(s)))throw new Error('api_scope_denied');
  const header=request.headers.get('idempotency-key');
  if(header&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(header))throw new Error('api_idempotency_conflict');
  if(policy.writes&&!header)throw new Error('api_idempotency_required');
  const key=header??randomUUID();
  const hash=createHash('sha256').update(canonical({name,args})).digest('hex');
  let reservation;
  try { reservation=await reserve(principal,policy.metric,key,hash,policy.writes); }
  catch(error){
    const code=error instanceof Error?error.message:'';
    if(code.startsWith('api_')||safeFailures.has(code))throw error;
    throw new Error('api_usage_unavailable');
  }
  if(reservation.replay){
    const cached=reservation.event.result_json;
    if(cached?.kind==='read'&&!policy.writes){
      const result=await fn();
      if(createHash('sha256').update(JSON.stringify(result)??'null').digest('hex')!==cached.fingerprint)throw new Error('api_idempotency_conflict');
      return result;
    }
    if(cached?.kind==='value')return cached.value;
    throw new Error('api_result_not_replayable');
  }
  let result;
  try { result=await fn(); }
  catch(error){
    const code=error instanceof Error&&safeFailures.has(error.message)?error.message:'tool_unavailable';
    try {
      if(!policy.writes||safeFailures.has(code))await settle(principal.owner,reservation.event.id,0,'voided',null,code);
      else await trafficDb().query(`UPDATE semologo.api_usage_events SET state='indeterminate',error_code='tool_unavailable'
        WHERE id=$1 AND owner_id=$2 AND state='reserved'`,[reservation.event.id,principal.owner]);
    } catch { throw new Error('api_usage_unavailable'); }
    throw error;
  }
  const value=result as Record<string,unknown>|null;
  // A successful plan is read-only and naturally has created:false. That is
  // not a free failed creation, and must still consume its operation allowance.
  const units=policy.writes&&(value?.created===false||value?.replayed===true)?0:1;
  try { await settle(principal.owner,reservation.event.id,units,'succeeded',cacheResult(result,policy.writes)); }
  catch { throw new Error('api_usage_unavailable'); } // Reserved/committed receipt remains; never repeat an uncertain write.
  return result;
}
