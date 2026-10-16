import {collectDiscovery} from './subscription-discovery.mjs';
import {workerIntegrity} from './worker-integrity.mjs';
import {reviewGuidance} from './guidance-review.mjs';
import {failureEvidence} from './failure-evidence.mjs';
import {collectKeyenCodex} from './keyen-codex-collector.mjs';
import {runtimeVersion} from './version.mjs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {diagnostic,demand} from './core.mjs';
import {subscriptionResearch,subscriptionValidation} from './knowledge-jobs.mjs';
import {repositoryCheck} from './handlers.mjs';
import {collectSemologoLogo} from './semologo-collector.mjs';
import {discoverSemologoDomains} from './semologo-domain-discover.mjs';
import {stomOriginalPreflight} from './stom-original-preflight.mjs';
import {stomOriginalStage} from './stom-original-stage.mjs';
import {stomIsolationPreflight} from './stom-isolation-preflight.mjs';
import {publishResult} from './artifacts.mjs';
import {createStore} from './ncp-store.mjs';
export function client(base,token){
 const url=new URL(base);demand(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)),400,'HTTPS required');
 demand(!url.username&&!url.password&&!url.search&&!url.hash,400,'Invalid API URL');
 return async(path,method='GET',data)=>{
 const response=await fetch(new URL(path,url),{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(path.endsWith('/artifacts')?65000:10000),redirect:'error'});
 if(!response.ok)throw new Error(`Fleet HTTP ${response.status}`);return response.json();
 };
}
export async function runOnce(api,project,{config={},store,heartbeatMs=20000,timeoutMs=60000,handler=repositoryCheck,researchHandler=subscriptionResearch,validationHandler=subscriptionValidation}={}){
 const kinds=['diagnostic','subscription-research','subscription-validation','semologo-logo-collect'];if(project==='semologo')kinds.push('semologo-domain-discover');if(config.repositories?.[project])kinds.push('repository-check');if(project==='spms3'&&(config.originalProgramDirs?.spms3||process.platform==='win32'))kinds.push('stom-original-preflight');if(project==='spms3'&&process.platform==='win32')kinds.push('stom-original-stage','stom-isolation-preflight');
 if(project==='keyen-ai')kinds.push('keyen-codex-collect');
 if(project==='semosub')kinds.push('codex-guidance-review','worker-integrity-check','subscription-discovery');
 const job=await api('/fleet/workers/claim','POST',{project,kinds,guidanceProtocolVersion:1,subscriptionValidationProtocolVersion:3,collectionProtocolVersion:2});if(!job)return null;
 const controller=new AbortController();let stopped=false,lost=false,pending=Promise.resolve();
 const timeout=setTimeout(()=>controller.abort(),['keyen-codex-collect','codex-guidance-review'].includes(job.kind)?300000:timeoutMs);
 let timer;
 const beat=()=>{timer=setTimeout(()=>{pending=(async()=>{
 try{await api(`/fleet/jobs/${job.id}/heartbeat`,'POST',{leaseToken:job.lease_token});}
 catch{lost=true;controller.abort();}
 if(!stopped&&!lost)beat();
 })();},heartbeatMs);};beat();
 let evidence,status='succeeded',phase='handler';
 try{
 if(job.kind==='diagnostic')evidence=diagnostic(job,runtimeVersion);
 else {demand(['repository-check','subscription-research','subscription-validation','semologo-logo-collect','semologo-domain-discover','stom-original-preflight','stom-original-stage','stom-isolation-preflight','keyen-codex-collect','codex-guidance-review','worker-integrity-check','subscription-discovery'].includes(job.kind),400,'Handler unavailable');
 const execute=job.kind==='subscription-discovery'?collectDiscovery:job.kind==='worker-integrity-check'?workerIntegrity:job.kind==='codex-guidance-review'?(job,config,signal)=>reviewGuidance(job,config,signal,{api}):job.kind==='keyen-codex-collect'?collectKeyenCodex:job.kind==='subscription-research'?researchHandler:job.kind==='subscription-validation'?validationHandler:job.kind==='semologo-logo-collect'?collectSemologoLogo:job.kind==='semologo-domain-discover'?discoverSemologoDomains:job.kind==='stom-original-preflight'?stomOriginalPreflight:job.kind==='stom-original-stage'?stomOriginalStage:job.kind==='stom-isolation-preflight'?stomIsolationPreflight:handler;
 const result=await execute(job,config,controller.signal);controller.signal.throwIfAborted();
 phase='artifact'; evidence=store?await publishResult(store,job,result):await api(`/fleet/jobs/${job.id}/artifacts`,'POST',{leaseToken:job.lease_token,result});controller.signal.throwIfAborted();}
 }catch(error){status='failed';evidence=failureEvidence(error,{phase,aborted:controller.signal.aborted,leaseLost:lost});}
 finally{stopped=true;clearTimeout(timer);clearTimeout(timeout);await pending;}
 demand(!lost,409,'Worker lease lost');
 await api(`/fleet/jobs/${job.id}/finish`,'POST',{leaseToken:job.lease_token,status,evidence});
 return {jobId:job.id,status};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {FLEET_API_BASE,FLEET_WORKER_TOKEN,FLEET_WORKER_CONFIG}=process.env;
 demand(FLEET_API_BASE&&FLEET_WORKER_TOKEN&&FLEET_WORKER_CONFIG,500,'Worker configuration required');
 let config=JSON.parse(await readFile(FLEET_WORKER_CONFIG,'utf8'));const api=client(FLEET_API_BASE,FLEET_WORKER_TOKEN);
 const store=process.env.FLEET_NCP_ENDPOINT?createStore():undefined;
 let stopping=false;process.on('SIGINT',()=>stopping=true);process.on('SIGTERM',()=>stopping=true);process.on('message',m=>{if(m?.type==='drain')stopping=true;});
 do{config=JSON.parse(await readFile(FLEET_WORKER_CONFIG,'utf8'));const identity=await api('/fleet/workers/me');for(const project of identity.projects){if(stopping)break;try{const result=await runOnce(api,project,{config,store});if(result)console.log(JSON.stringify(result));}catch{console.error('Fleet cycle failed; inspect job state before retry');if(process.argv.includes('--once'))process.exitCode=1;}}
 if(process.argv.includes('--once'))break;
 await new Promise(r=>setTimeout(r,5000));}while(!stopping);
 store?.close();
 if(process.connected)process.disconnect();
}
