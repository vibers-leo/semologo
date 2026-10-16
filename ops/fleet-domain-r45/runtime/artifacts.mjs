import {discoveryKind} from './subscription-sources.mjs';
import {validateDiscovery,snapshotFacts} from './subscription-discovery.mjs';
import {crosscheckReport} from './subscription-crosscheck.mjs';
import {integrityKind,validateIntegrityResult} from './worker-integrity.mjs';
import {validateGuidanceResult} from './guidance-contract.mjs';
import {validateResult as validateKeyenResult} from './keyen-codex-collector.mjs';
import {bundleSchema} from './knowledge-contract.mjs';
import {validatePilot} from './pilot-validator.mjs';
import {canonical,hash,demand} from './core.mjs';
import {sources as semologoSources} from './semologo-collector.mjs';
import {MAX_LOGO_SVG_BYTES,MAX_LOGO_COMPRESSED_BYTES} from './semologo-collector.mjs';
import {MAX_DOMAINS,validDomain,firstPartyUrl} from './semologo-domain-discover.mjs';
import {gunzipSync} from 'node:zlib';
const slug=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(s);
export function prefix(job){
 demand(slug(job.tenant)&&slug(job.project)&&/^[a-f0-9-]{36}$/.test(job.id)&&Number.isInteger(job.attempt)&&job.attempt>0,400,'Invalid artifact scope');
 return `automation/v1/tenants/${job.tenant}/projects/${job.project}/runs/${job.id}/${job.attempt}/`;
}
export function validateResult(job,result){
 demand(result?.schemaVersion===1&&result.jobId===job.id&&result.project===job.project&&result.commit===job.commit_sha&&result.kind===job.kind,400,'Result identity mismatch');
 if(job.kind===discoveryKind){validateDiscovery(job,result);return;}
 if(job.kind===integrityKind){validateIntegrityResult(job,result);return;}
 if(job.kind==='codex-guidance-review'){validateGuidanceResult(job,result);return;}
 if(job.kind==='keyen-codex-collect'){validateKeyenResult(job,result);return;}
 if(job.kind==='semologo-logo-collect'){
  const source=semologoSources.get(job.input.sourceId);
  demand(source&&result.sourceId===source.id&&result.nameKo===source.nameKo&&result.sourcePage===source.sourcePage&&result.assetUrl===source.assetUrl,400,'Logo source mismatch');
  demand(result.reviewStatus==='PENDING'&&typeof result.collectedAt==='string'&&Number.isFinite(Date.parse(result.collectedAt)),400,'Invalid logo review state');
  const compressed=result.originalGzipBase64!==undefined;
  demand(compressed?result.originalBase64===undefined:result.originalBytes===undefined,400,'Ambiguous logo payload');
  const encoded=compressed?result.originalGzipBase64:result.originalBase64;
  demand(typeof encoded==='string'&&encoded.length<=(compressed?60000:27000)&&/^[A-Za-z0-9+/]*={0,2}$/.test(encoded),400,'Invalid logo payload');
  const payload=Buffer.from(encoded,'base64');
  demand(payload.toString('base64')===encoded&&payload.length>0&&payload.length<=(compressed?MAX_LOGO_COMPRESSED_BYTES:20000),400,'Invalid logo encoding');
  let raw=payload;
  if(compressed){
   demand(Number.isInteger(result.originalBytes)&&result.originalBytes>20000&&result.originalBytes<=MAX_LOGO_SVG_BYTES,400,'Invalid SVG original size');
   try{raw=gunzipSync(payload,{maxOutputLength:MAX_LOGO_SVG_BYTES});}catch{demand(false,400,'Invalid bounded SVG gzip');}
   demand(raw.length===result.originalBytes,400,'SVG size mismatch');
  }
  demand(raw.length>0&&raw.length<=MAX_LOGO_SVG_BYTES&&/<svg(?:\s|>)/i.test(raw.toString('utf8',0,1000)),400,'Invalid SVG original');
  const actual=hash(raw);
  demand(result.sha256===actual&&result.sourceChanged===(actual!==source.expectedSha256),400,'Logo hash mismatch');return;
 }
 if(job.kind==='semologo-domain-discover'){
  demand(result.reviewStatus==='PENDING'&&typeof result.checkedAt==='string'&&Number.isFinite(Date.parse(result.checkedAt)),400,'Invalid domain review state');
  demand(Array.isArray(result.results)&&result.results.length===job.input.domains.length&&result.results.length<=MAX_DOMAINS,400,'Domain result count mismatch');
  const allowed=new Set(['candidate_review_required','no_logo_signal','robots_unavailable','robots_disallowed','page_unavailable','failed']);
  for(const [index,row] of result.results.entries()){
   demand(row&&row.domain===job.input.domains[index]&&validDomain(row.domain)&&allowed.has(row.status),400,'Domain result mismatch');
   if(row.status==='candidate_review_required')demand(Array.isArray(row.logoCandidates)&&row.logoCandidates.length>=1&&row.logoCandidates.length<=3,400,'Logo candidate missing');
   if(row.logoCandidates!==undefined)demand(Array.isArray(row.logoCandidates)&&row.logoCandidates.length<=3&&row.logoCandidates.every(url=>typeof url==='string'&&url===firstPartyUrl(url,`https://${row.domain}/`,row.domain)),400,'Invalid candidate URL');
   if(row.pageUrl!==undefined)demand(row.pageUrl===`https://${row.domain}/`,400,'Invalid source page');
   if(row.name!==undefined)demand(typeof row.name==='string'&&row.name.length<=120,400,'Invalid site name');
   if(row.errorCode!==undefined)demand(row.status==='failed'&&typeof row.errorCode==='string'&&row.errorCode.length<=60,400,'Invalid domain error');
  }
  return;
 }
 if(job.kind==='subscription-research'){
  bundleSchema.parse(result.bundle);demand(result.bundle.producer===job.owner,400,'Collector identity mismatch');return;
 }
 if(job.kind==='subscription-validation'){
  demand(hash(canonical(job.input.bundle))===job.input.bundleHash&&result.sourceJobId===job.input.sourceJobId,400,'Research identity mismatch');
  const expected=job.input.recheckPolicy?crosscheckReport(job,result.independentEvidence,result.report?.checkedAt):validatePilot(Buffer.from(canonical(job.input.bundle)),job.input.sourceBatchId);
  const {checkedAt,...actual}=result.report||{};const {checkedAt:ignored,...facts}=expected;
  demand(typeof checkedAt==='string'&&Number.isFinite(Date.parse(checkedAt))&&canonical(actual)===canonical(facts),400,'Validation report mismatch');return;
 }
 demand(job.kind==='repository-check'&&result.commitPresent===true&&result.requiredFiles?.length>0&&result.requiredFiles.length<=32,400,'Invalid repository evidence');
 demand(result.requiredFiles.every(p=>typeof p==='string'&&p.length<256&&!p.startsWith('/')&&!p.split('/').includes('..'))&&new Set(result.requiredFiles).size===result.requiredFiles.length,400,'Invalid paths');
}
export async function publishResult(store,job,result){
 validateResult(job,result);
 if(job.kind===discoveryKind)for(const snapshot of result.snapshots){
  const facts=Buffer.from(canonical(snapshotFacts(snapshot))),sha=hash(facts),key='semosub/knowledge/v1/archive/facts/'+sha+'.json';
  let existing;try{existing=await store.get(key,65536);}catch(error){if(error?.name!=='NoSuchKey'&&error?.$metadata?.httpStatusCode!==404)throw error;}
  if(!existing){await store.put(key,facts);existing=await store.get(key,65536);}
  demand(hash(existing)===sha,409,'Source fact archive mismatch');
 }
 const bytes=Buffer.from(canonical(result));demand(bytes.length<=65536,400,'Result too large');
 const sha256=hash(bytes),base=prefix(job),resultKey=base+sha256+'.json';
 await store.put(resultKey,bytes);
 demand(hash(await store.get(resultKey,65536))===sha256,409,'Result readback mismatch');
 const manifest={schemaVersion:1,jobId:job.id,attempt:job.attempt,commit:job.commit_sha,inputHash:job.input_hash,workerId:job.owner,resultKey,sha256,size:bytes.length};
 const manifestBytes=Buffer.from(canonical(manifest)),manifestHash=hash(manifestBytes),manifestKey=base+manifestHash+'.manifest.json';
 await store.put(manifestKey,manifestBytes);
 demand(hash(await store.get(manifestKey,8192))===manifestHash,409,'Manifest readback mismatch');
 if(job.kind==='codex-guidance-review'){
  const replyBase=`automation/v1/projects/worker-fleet/improvements/replies/${job.owner}/${job.id}/`;
  const replyManifest=Buffer.from(canonical({schemaVersion:1,status:'artifact_verified',jobId:job.id,workerId:job.owner,guidanceId:result.guidanceId,reportKey:replyBase+'report.json',sha256,manifestKey,manifestHash,requiresCentralReview:true,applied:false}));
  await store.put(replyBase+'report.json',bytes);demand(hash(await store.get(replyBase+'report.json',65536))===sha256,409,'Reply readback mismatch');
  await store.put(replyBase+'manifest.json',replyManifest);demand(hash(await store.get(replyBase+'manifest.json',8192))===hash(replyManifest),409,'Reply manifest mismatch');
 }
 return {manifestKey,manifestHash};
}
export async function verifyStoredResult(store,job,evidence,requiredFiles){
 demand(evidence&&/^[a-f0-9]{64}$/.test(evidence.manifestHash),400,'Manifest hash required');
 demand(evidence.manifestKey===prefix(job)+evidence.manifestHash+'.manifest.json',400,'Manifest scope mismatch');
 const bytes=await store.get(evidence.manifestKey,8192);demand(hash(bytes)===evidence.manifestHash,400,'Manifest hash mismatch');
 let m;try{m=JSON.parse(bytes);}catch{demand(false,400,'Invalid manifest JSON');}
 demand(m.schemaVersion===1&&m.jobId===job.id&&m.attempt===job.attempt&&m.commit===job.commit_sha&&m.inputHash===job.input_hash&&m.workerId===job.owner,400,'Manifest identity mismatch');
 demand(/^[a-f0-9]{64}$/.test(m.sha256)&&m.resultKey===prefix(job)+m.sha256+'.json'&&Number.isInteger(m.size)&&m.size>0&&m.size<=65536,400,'Invalid manifest result');
 const resultBytes=await store.get(m.resultKey,65536);demand(resultBytes.length===m.size&&hash(resultBytes)===m.sha256,400,'Result integrity mismatch');
 let result;try{result=JSON.parse(resultBytes);}catch{demand(false,400,'Invalid result JSON');}
 validateResult(job,result);if(job.kind==='repository-check')demand(canonical(result.requiredFiles)===canonical(requiredFiles),400,'Required files mismatch');
 return result;
}
