import {createHash,randomUUID} from 'node:crypto';
import {trafficDb} from './traffic-db';
import {parseWallSelection} from './logo-wall-selection';
import {prepareLogoWall,publicWallPlan,generateLogoWall} from './logo-wall-generation';
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':(JSON.stringify(v)??'null');
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Reuse the human-priority collection queue. Collection does not certify or publish an asset. */
export async function collectLogoWall(request:Request,owner:string,args:unknown,resume=false){
  if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('invalid_collection');
  const a=args as Record<string,unknown>;const db=await trafficDb().connect();
  try{
    await db.query('BEGIN');
    // Serialize per-account intake/rate checks and simultaneous resume calls.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['logo-wall-intake:'+owner]);
    let session;
    if(resume){
      if(Object.keys(a).some(k=>k!=='id')||typeof a.id!=='string'||!/^[a-f0-9-]{36}$/i.test(a.id))throw new Error('invalid_collection');
      session=(await db.query('SELECT * FROM semologo.logo_wall_collection_sessions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[a.id,owner])).rows[0];
      if(!session)throw new Error('collection_not_found');
    }else{
      const input=parseWallSelection(a);
      if(!input.names)throw new Error('collection_needs_explicit_names');
      const key=digest(canonical(input));
      const existing=await db.query('SELECT * FROM semologo.logo_wall_collection_sessions WHERE owner_id=$1 AND request_key=$2 FOR UPDATE',[owner,key]);
      session=existing.rows[0];
      if(!session){
        const count=await db.query("SELECT count(*)::int n FROM semologo.logo_wall_collection_sessions WHERE owner_id=$1 AND created_at>now()-interval '1 hour'",[owner]);
        if(count.rows[0].n>=5)throw new Error('collection_rate_limited');
        session=(await db.query('INSERT INTO semologo.logo_wall_collection_sessions(id,owner_id,request_key,input) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),owner,key,input])).rows[0];
      }
    }
    if(session.status==='complete'){
      const ownWall=(await db.query('SELECT version FROM semologo.logo_walls WHERE id=$1 AND owner_id=$2',[session.wall_id,owner])).rows[0];
      if(!ownWall){await db.query('COMMIT');return {sessionId:session.id,status:'review_required',reason:'wall_deleted',wallId:null};}
      await db.query('COMMIT');return {sessionId:session.id,status:'complete',wallId:session.wall_id,editorPath:`/logo-walls/?wall=${encodeURIComponent(session.wall_id)}`,replayed:true};
    }
    const prepared=await prepareLogoWall(session.input);const plan=publicWallPlan(prepared);
    const missing=plan.unresolved.filter(x=>x.reason==='not_found');const ambiguous=plan.unresolved.filter(x=>x.reason!=='not_found');
    if(missing.length>10)throw new Error('too_many_missing_logos');
    const requests=[];
    for(const m of missing){
      const name=m.query.trim();
      const r=await db.query(`INSERT INTO semologo.logo_request_queue(id,request_key,message,requested_name,requester_hash,status,priority)
        VALUES($1,$2,$3,$4,$5,'pending',100) ON CONFLICT(request_key) DO UPDATE SET
        priority=GREATEST(semologo.logo_request_queue.priority,100),
        status=CASE WHEN semologo.logo_request_queue.status IN ('failed','cancelled','published') THEN 'pending' ELSE semologo.logo_request_queue.status END,updated_at=now() RETURNING id,status,published_brand_id`,
        [randomUUID(),digest(name.toLocaleLowerCase('ko-KR')),name+' 로고 수집 · MCP 로고월'+(session.input.style?' · '+JSON.stringify(session.input.style):''),name,digest('mcp:'+owner)]);
      requests.push({name,id:r.rows[0].id,status:r.rows[0].status});
    }
    const signature=digest(canonical(plan.items));
    let appliedSignature=session.applied_signature;
    let wallId=session.wall_id,wallVersion=session.wall_version,conflict=false;
    if(wallId){
      const current=(await db.query('SELECT version FROM semologo.logo_walls WHERE id=$1 AND owner_id=$2',[wallId,owner])).rows[0];
      if(!current||current.version!==wallVersion)conflict=true;
    }
    let status=missing.length||ambiguous.length?'collecting':'complete';
    let generationError:string|undefined;
    if(ambiguous.length||conflict)status='review_required';
    else if(plan.items.length&&signature!==appliedSignature){
      const r=await generateLogoWall(request,owner,{...session.input,allowPartial:true},true,{client:db,...(wallId?{update:{id:wallId,version:wallVersion}}:{})});
      const data=await r.json();
      if(r.ok){wallId=data.wall.id;wallVersion=data.wall.version;appliedSignature=signature;}
      else {status='review_required';generationError=data.error||'generation_unavailable';if(r.status>=500)throw new Error('collection_unavailable');}
    }
    await db.query('UPDATE semologo.logo_wall_collection_sessions SET status=$3,request_ids=$4,wall_id=$5,wall_version=$6,applied_signature=$7,updated_at=now() WHERE id=$1 AND owner_id=$2',[session.id,owner,status,JSON.stringify(requests),wallId,wallVersion,appliedSignature]);
    await db.query('COMMIT');
    return {sessionId:session.id,status,wallId,editorPath:wallId?`/logo-walls/?wall=${encodeURIComponent(wallId)}`:null,requests,unresolved:plan.unresolved,manualEditConflict:conflict,generationError,visualStyle:plan.visualStyle,styleExceptions:plan.items.filter(x=>x.styleIssues?.length).map(x=>({brandId:x.brandId,issues:x.styleIssues})),
      nextAction:status==='complete'?'preview_logo_wall':status==='review_required'?'review_candidates_or_manual_edits':'resume_logo_wall after collection is reviewed and published',
      publication:'Existing collection and review pipeline; this tool never publishes unverified files',backgroundResume:false,retryAfterSeconds:30};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
