import {discoveryKind,subscriptionSources,sourceCatalog} from './subscription-sources.mjs';
import {snapshotFacts} from './subscription-discovery.mjs';
import {priceBatches} from './subscription-pricing-targets.mjs';
import {recheckPolicy} from './subscription-crosscheck.mjs';
import {touchWorker,statusReport} from './worker-status.mjs';
import {integrityKind} from './worker-integrity.mjs';
import {guidance,guidanceHash,guidanceKind,validateGuidanceInput} from './guidance-contract.mjs';
import {guidanceSnapshot} from './guidance-context.mjs';
import http from 'node:http';
import {intakeReview,decideReview} from './subscription-review.mjs';
import {priceView} from './pricing.mjs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {createStore} from './ncp-store.mjs';
import {verifyStoredResult,publishResult} from './artifacts.mjs';
import {STOM_BUNDLE_BYTES,parseStomBundle} from './stom-original-stage.mjs';
import {authenticate,scope,validateRequest,redactJob,verifyEvidence,Fault,demand,canonical,hash} from './core.mjs';
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;demand(size<=32768,413,'Body too large');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new Fault(400,'Invalid JSON');}}
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s||'');
export function claimKinds(config,p,b,offered,store){
 return Object.entries(config.projects[b.project]?.jobs||{}).filter(([kind,s])=>offered.includes(kind)&&(s.owners??[s.owner]).includes(p.workerId)&&(kind==='diagnostic'||store)&&(kind!==guidanceKind||b.guidanceProtocolVersion===1)).map(([k])=>k);
}
export function createServer(pool,config,{store}={}){
 return http.createServer({requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
 try{
 if(req.method==='GET'&&req.url==='/fleet/healthz'){try{const q=await pool.query("SELECT to_regclass('fleet.job') IS NOT NULL AS ready");return send(q.rows[0].ready?200:503,{ok:q.rows[0].ready});}catch{return send(503,{ok:false});}}
 const p=authenticate(req.headers.authorization,config.principals);
 const path=req.url.split('?')[0];
 if(path==='/fleet/subscription-review'||path==='/fleet/subscription-publications'){
 demand(['operator','cms'].includes(p.role),403,'CMS access required');const project='semosub';scope(p,project);
 if(req.method==='POST'&&path==='/fleet/subscription-review')return send(200,await decideReview(pool,p.tenant,project,await body(req)));
 demand(req.method==='GET',405,'GET required');
 if(path==='/fleet/subscription-publications'){const q=await pool.query('SELECT record_id,payload,published_at FROM fleet.subscription_publication WHERE tenant=$1 AND project=$2 ORDER BY record_id LIMIT 5000',[p.tenant,project]);return send(200,{records:q.rows});}
 const q=await pool.query(`SELECT r.*,p.payload previous_published,p.fact_hash published_hash,source.owner source_worker,validator.owner validation_worker,latest.source_job latest_source_job FROM fleet.subscription_revision r LEFT JOIN fleet.subscription_publication p USING(tenant,project,record_id) LEFT JOIN fleet.job source ON source.id=r.source_job LEFT JOIN fleet.job validator ON validator.id=r.validation_job LEFT JOIN LATERAL (SELECT o.source_job FROM fleet.subscription_observation o WHERE o.tenant=r.tenant AND o.project=r.project AND o.record_id=r.record_id ORDER BY o.observed_at DESC,o.source_job DESC LIMIT 1) latest ON true WHERE r.tenant=$1 AND r.project=$2 ORDER BY r.last_seen DESC,r.record_id LIMIT 500`,[p.tenant,project]);
 const report=await pool.query("SELECT payload FROM fleet.reference_cache WHERE key='collection-quality'");const sourceRows=await pool.query('SELECT DISTINCT ON(source_id) source_id,worker_id,checked_at,fetch_status,content_hash,payload FROM fleet.subscription_source_observation WHERE tenant=$1 AND project=$2 ORDER BY source_id,checked_at DESC',[p.tenant,project]);
 const brandRows=await pool.query("SELECT key,payload FROM fleet.reference_cache WHERE key LIKE 'semosub-brand-%'");const brands=Object.fromEntries(brandRows.rows.map(r=>[r.key.slice(14),r.payload]));
 return send(200,{records:q.rows,quality:report.rows[0]?.payload||null,sources:sourceCatalog.sources.map(source=>({...source,observation:sourceRows.rows.find(r=>r.source_id===source.id)||null,semologo:brands[source.brandId]||null})),sourceCoverage:{catalogVersion:sourceCatalog.version,registeredSources:sourceCatalog.sources.length,enabledSources:sourceCatalog.sources.filter(s=>s.enabled).length,observedSources:sourceRows.rows.length,fetchedSources:sourceRows.rows.filter(r=>r.fetch_status==='fetched').length,priceRecordCount:q.rows.filter(r=>r.payload.amount!==null).length,publication:'cms_approval_required',channels:{direct:'collecting',appStore:'not_observed',googlePlay:'not_observed'}}});
 }
 if(req.method==='GET'&&path==='/fleet/workers/me'){demand(p.role==='worker',403,'Worker required');await touchWorker(pool,p);return send(200,{workerId:p.workerId,tenant:p.tenant,projects:p.projects,artifactProxy:Boolean(store)});}
 if(req.method==='GET'&&path==='/fleet/workers/status'){demand(p.role==='operator',403,'Operator required');return send(200,await statusReport(pool,config,p));}
 const guidanceJob=path.match(/^\/fleet\/jobs\/([^/]+)\/guidance$/);
 if(req.method==='POST'&&guidanceJob){
  demand(p.role==='worker'&&uuid(guidanceJob[1]),403,'Worker required');const b=await body(req);demand(uuid(b.leaseToken),403,'Lease required');
  const q=await pool.query("SELECT * FROM fleet.job WHERE id=$1 AND tenant=$2 AND project=ANY($3) AND owner=$4 AND kind=$5 AND lease_token=$6 AND status='running' AND lease_until>clock_timestamp()",[guidanceJob[1],p.tenant,p.projects,p.workerId,guidanceKind,b.leaseToken]);
  demand(q.rowCount===1,403,'Active assigned guidance lease required');validateGuidanceInput(q.rows[0].input);
  return send(200,{guidance,guidanceHash,queueSnapshot:await guidanceSnapshot(pool,p)});
 }
 const bundleJob=path.match(/^\/fleet\/jobs\/([^/]+)\/stom-bundle$/);
 if(req.method==='GET'&&bundleJob){
  demand(store&&uuid(bundleJob[1])&&p.role==='worker'&&p.workerId===config.projects.spms3?.jobs['stom-original-stage']?.owner,403,'STOM stage worker required');scope(p,'spms3');
  demand(uuid(req.headers['x-fleet-lease']),403,'Stage lease required');
  const q=await pool.query("SELECT 1 FROM fleet.job WHERE id=$1 AND tenant=$2 AND project='spms3' AND kind='stom-original-stage' AND owner=$3 AND lease_token=$4 AND status='running' AND lease_until>clock_timestamp()",[bundleJob[1],p.tenant,p.workerId,req.headers['x-fleet-lease']]);
  demand(q.rowCount===1,403,'Active stage lease required');
  const bytes=await store.getStomBundle();parseStomBundle(bytes);
  res.writeHead(200,{'content-type':'application/zip','content-length':STOM_BUNDLE_BYTES,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes);return;
 }
 if(req.method==='POST'&&path==='/fleet/jobs'){
 const v=validateRequest(await body(req),p,config.projects);
 demand(v.kind==='diagnostic'||store,409,'Artifact store not enabled');
 const q=await pool.query(`INSERT INTO fleet.job(tenant,project,kind,request_key,input_hash,owner,commit_sha,input)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant,project,request_key) DO UPDATE SET request_key=EXCLUDED.request_key
 RETURNING *`,[p.tenant,v.project,v.kind,v.requestKey,v.inputHash,v.owner,v.commit,v.input]);
 demand(q.rows[0].input_hash===v.inputHash,409,'Request key conflict');return send(200,redactJob(q.rows[0]));
 }
 if(req.method==='GET'&&path==='/fleet/jobs'){
 const q=await pool.query('SELECT * FROM fleet.job WHERE tenant=$1 AND project=ANY($2) ORDER BY created_at DESC,id LIMIT 100',[p.tenant,p.projects]);
 return send(200,q.rows.map(redactJob));
 }
 if(req.method==='GET'&&path==='/fleet/subscriptions'){
 demand(p.role==='operator',403,'Operator required');
 const project=new URLSearchParams(req.url.split('?')[1]||'').get('project');scope(p,project);
 const q=await pool.query(`SELECT DISTINCT ON (record_id) record_id,producer,source_job,validation_job,validation_status,review_status,payload FROM fleet.subscription_observation WHERE tenant=$1 AND project=$2 ORDER BY record_id,observed_at DESC,source_job DESC LIMIT 5000`,[p.tenant,project]);
 const refs=await pool.query('SELECT key,payload FROM fleet.reference_cache');const cache=Object.fromEntries(refs.rows.map(r=>[r.key,r.payload]));
 return send(200,{schemaVersion:1,project,publicationApproved:false,collectionQuality:cache['collection-quality']||null,fx:cache.ecb||null,records:q.rows.map(r=>({...r,pricing:priceView(r.payload,cache.ecb),semologo:cache['semologo-'+r.payload.serviceSlug]||null}))});
 }
 if(req.method==='GET'&&path==='/fleet/events'){
 const params=new URLSearchParams(req.url.split('?')[1]||'');const after=params.get('after')||'0';
 demand(/^\d{1,18}$/.test(after),400,'Invalid cursor');
 const q=await pool.query('SELECT e.sequence,e.job_id,e.status,e.at FROM fleet.event e JOIN fleet.job j ON j.id=e.job_id WHERE j.tenant=$1 AND j.project=ANY($2) AND e.sequence>$3 ORDER BY e.sequence LIMIT 100',[p.tenant,p.projects,after]);return send(200,q.rows);
 }
 if(req.method==='POST'&&path==='/fleet/workers/claim'){
 demand(p.role==='worker',403,'Worker required');const b=await body(req);scope(p,b.project);
 const offered=b.kinds??['diagnostic'];demand(Array.isArray(offered)&&offered.length<=13&&offered.every(k=>['diagnostic','repository-check','subscription-research','subscription-validation','semologo-logo-collect','semologo-domain-discover','stom-original-preflight','stom-original-stage','stom-isolation-preflight','keyen-codex-collect','codex-guidance-review','worker-integrity-check','subscription-discovery'].includes(k)),400,'Invalid worker capabilities');
 const kinds=claimKinds(config,p,b,offered,store);
 const c=await pool.connect();try{await c.query('BEGIN');
 // Serialize all claims for this worker, including across different project scopes.
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[p.tenant+':'+p.workerId]);
 await c.query('SELECT fleet.expire()');
 const active=await c.query("SELECT 1 FROM fleet.job WHERE tenant=$1 AND owner=$2 AND status IN ('running','review_required') LIMIT 1",[p.tenant,p.workerId]);
 let jobs=[];
 if(!active.rowCount){const q=await c.query(`WITH candidate AS (SELECT id FROM fleet.job WHERE tenant=$1 AND project=$2 AND owner=$3 AND status='queued' AND kind=ANY($4) AND (kind<>'subscription-validation' OR NOT (input ? 'recheckPolicy') OR $5::boolean) AND (kind<>'subscription-validation' OR NOT (input ? 'sourceBatchId') OR $6::boolean) AND (kind<>'subscription-research' OR NOT (input ? 'batchId') OR $7::boolean) ORDER BY CASE WHEN kind='subscription-validation' THEN 0 ELSE 1 END,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
 UPDATE fleet.job j SET status='running',attempt=attempt+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds' FROM candidate c WHERE j.id=c.id RETURNING j.*`,[p.tenant,b.project,p.workerId,kinds,Number(b.subscriptionValidationProtocolVersion)>=2,Number(b.subscriptionValidationProtocolVersion)>=3,b.collectionProtocolVersion===2]);jobs=q.rows;}
 await c.query('COMMIT');return send(200,jobs[0]||null);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 const m=path.match(/^\/fleet\/jobs\/([^/]+)(?:\/(heartbeat|finish|artifacts))?$/);
 if(m){demand(uuid(m[1]),400,'Invalid job id');const q=await pool.query('SELECT * FROM fleet.job WHERE tenant=$1 AND project=ANY($2) AND id=$3',[p.tenant,p.projects,m[1]]);demand(q.rowCount,404,'Job not found');const job=q.rows[0];
 if(req.method==='GET'&&!m[2])return send(200,redactJob(job));
 demand(p.role==='worker'&&p.workerId===job.owner,403,'Assigned worker required');
 const b=await body(req);demand(uuid(b.leaseToken),400,'Lease token required');let result;
 if(req.method==='POST'&&m[2]==='artifacts'){
 demand(store&&['repository-check','subscription-research','subscription-validation','semologo-logo-collect','semologo-domain-discover','stom-original-preflight','stom-original-stage','stom-isolation-preflight','keyen-codex-collect','codex-guidance-review','worker-integrity-check','subscription-discovery'].includes(job.kind),409,'Artifact proxy not enabled');
 const active=await pool.query("SELECT 1 FROM fleet.job WHERE id=$1 AND tenant=$2 AND owner=$3 AND lease_token=$4 AND status='running' AND lease_until>clock_timestamp()",[job.id,p.tenant,p.workerId,b.leaseToken]);demand(active.rowCount,409,'Lease rejected');
 if(job.kind==='repository-check')demand(JSON.stringify(b.result?.requiredFiles)===JSON.stringify(config.projects[job.project]?.jobs[job.kind]?.requiredFiles),400,'Required files mismatch');
 return send(200,await publishResult(store,job,b.result));
 }
 if(req.method==='POST'&&m[2]==='heartbeat')result=await pool.query('SELECT fleet.heartbeat($1,$2,$3,$4,$5) AS ok',[p.tenant,job.project,job.id,p.workerId,b.leaseToken]);
 else if(req.method==='POST'&&m[2]==='finish'){
 demand(['succeeded','failed'].includes(b.status),400,'Invalid terminal status');
 let verified;
 if(b.status==='succeeded'){if(job.kind==='diagnostic')verifyEvidence(job,b.evidence);else {demand(store,409,'Artifact store not enabled');verified=await verifyStoredResult(store,job,b.evidence,config.projects[job.project]?.jobs[job.kind]?.requiredFiles);}}
 else demand(b.evidence?.code==='handler_failed',400,'Invalid failure evidence');
 const c=await pool.connect();try{await c.query('BEGIN');
 result=await c.query('SELECT fleet.finish($1,$2,$3,$4,$5,$6,$7) AS ok',[p.tenant,job.project,job.id,p.workerId,b.leaseToken,b.status,b.evidence]);
 demand(result.rows[0].ok,409,'Lease rejected');
 if(b.status==='succeeded'&&job.kind===discoveryKind)for(const snapshot of verified.snapshots){
  const contentHash=hash(canonical(snapshotFacts(snapshot)));
  await c.query(`INSERT INTO fleet.subscription_source_observation(tenant,project,source_id,source_job,worker_id,checked_at,fetch_status,content_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,[p.tenant,job.project,snapshot.sourceId,job.id,job.owner,snapshot.checkedAt,snapshot.fetchStatus,contentHash,{...snapshot,archiveKey:'semosub/knowledge/v1/archive/facts/'+contentHash+'.json',manifestKey:b.evidence.manifestKey}]);
 }
 if(b.status==='succeeded'&&job.kind===integrityKind)await c.query("INSERT INTO fleet.reference_cache(key,payload) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=clock_timestamp()",['worker-integrity-'+p.tenant+'-'+p.workerId,verified]);
 if(b.status==='succeeded'&&job.kind==='subscription-research'){
  const kind='subscription-validation',spec=config.projects[job.project]?.jobs[kind],owner=spec?.crossValidate?(job.owner==='win-01'?'win-02':'win-01'):spec?.owner;demand(owner,409,'Validator not configured');
  demand(owner!==job.owner&&config.principals.some(pr=>pr.role==='worker'&&pr.workerId===owner&&pr.tenant===p.tenant&&pr.projects.includes(job.project)),409,'Independent validator unavailable');
  const previous=await c.query('SELECT DISTINCT ON(record_id) record_id,payload,validation_status,validation_details FROM fleet.subscription_observation WHERE tenant=$1 AND project=$2 ORDER BY record_id,observed_at DESC,source_job DESC',[p.tenant,job.project]);
  const input={sourceJobId:job.id,bundle:verified.bundle,bundleHash:hash(canonical(verified.bundle)),recheckPolicy:recheckPolicy(verified.bundle,previous.rows,owner),...(job.input.batchId?{sourceBatchId:job.input.batchId}:{})};
  const inputHash=hash(canonical({kind,commit:job.commit_sha,input,workerId:owner}));
  await c.query(`INSERT INTO fleet.job(tenant,project,kind,request_key,input_hash,owner,commit_sha,input) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant,project,request_key) DO NOTHING`,[p.tenant,job.project,kind,'validate-'+job.id,inputHash,owner,job.commit_sha,input]);
 }
 if(b.status==='succeeded'&&job.kind==='subscription-validation'){
  const bundle=job.input.bundle;
  for(const record of bundle.records){
   const check=verified.report.recordChecks?.find(r=>r.recordId===record.recordId),status=check?.status||'needs_review',details=check?.independent||null;
   await intakeReview(c,p.tenant,job.project,record,{sourceJob:job.input.sourceJobId,validationJob:job.id,validationStatus:status,validationDetails:details});
   await c.query(`INSERT INTO fleet.subscription_observation(tenant,project,source_job,validation_job,record_id,producer,observed_at,payload,validation_status,validation_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(source_job,record_id) DO NOTHING`,[p.tenant,job.project,job.input.sourceJobId,job.id,record.recordId,bundle.producer,record.observedAt,record,status,details]);
  }
 }
 await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }else throw new Fault(404,'Not found');
 demand(result.rows[0].ok,409,'Lease rejected');await touchWorker(pool,p);return send(200,{ok:true});
 }
 throw new Fault(404,'Not found');
 }catch(e){send(e.status||500,{error:e.status?e.message:'Internal error'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 demand(process.env.FLEET_CONFIG&&process.env.FLEET_DATABASE_URL,500,'Configuration required');
 const config=JSON.parse(await readFile(process.env.FLEET_CONFIG,'utf8'));
 const pool=new pg.Pool({connectionString:process.env.FLEET_DATABASE_URL,max:5,connectionTimeoutMillis:5000,statement_timeout:10000});
 const store=process.env.FLEET_NCP_ENDPOINT?createStore():undefined;
 const server=createServer(pool,config,{store});server.listen(Number(process.env.FLEET_PORT||4781),'127.0.0.1');
 const shutdown=()=>server.close(()=>{store?.close();pool.end();});process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
