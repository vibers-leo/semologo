import {discoveryKind,discoveryInput} from './subscription-sources.mjs';
import {priceBatches} from './subscription-pricing-targets.mjs';
import {integrityKind,validateIntegrityInput} from './worker-integrity.mjs';
import {guidanceKind,validateGuidanceInput} from './guidance-contract.mjs';
import {validateInput as validateKeyenInput} from './keyen-codex-collector.mjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import {sources as semologoSources} from './semologo-collector.mjs';
import {MAX_DOMAINS,validDomain} from './semologo-domain-discover.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
 if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 if (value && typeof value==='object') return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')}}`;
 return JSON.stringify(value);
}
export class Fault extends Error { constructor(status,message){super(message);this.status=status;} }
export function demand(condition,status,message){if(!condition)throw new Fault(status,message);}
export function authenticate(header,principals){
 const token=header?.startsWith('Bearer ')?header.slice(7):'';
 const digest=hash(token);
 const p=principals.find(p=>/^[a-f0-9]{64}$/.test(p.tokenHash)&&timingSafeEqual(Buffer.from(digest),Buffer.from(p.tokenHash)));
 demand(token.length>=32&&p,401,'Unauthorized');return p;
}
export function scope(p,project){demand(p.projects.includes(project),403,'Project forbidden');}
export function validateRequest(body,p,projects){
 demand(p.role==='operator',403,'Operator required');
 demand(body&&typeof body==='object'&&!Array.isArray(body),400,'Invalid request');
 const {project,kind,requestKey,commit,input={}}=body;
 scope(p,project);const spec=projects[project]?.jobs[kind];
 demand(spec,400,'Unknown job');
 demand(typeof requestKey==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey),400,'Invalid request key');
 demand(typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit),400,'Full commit required');
 demand(input&&typeof input==='object'&&!Array.isArray(input),400,'Object input required');
 if(kind===discoveryKind){demand(project==='semosub',400,'Semosub required');try{discoveryInput(input,body.workerId??spec.owner);}catch{demand(false,400,'Unregistered source batch');}}
 else if(kind==='subscription-research'&&input.batchId){const batch=priceBatches.get(input.batchId);demand(project==='semosub'&&Object.keys(input).length===1&&batch&&batch.owner===(body.workerId??spec.owner),400,'Unregistered pricing batch');}
 else if(kind==='keyen-codex-collect'){demand(project==='keyen-ai',400,'Keyen project required');validateKeyenInput(input);}
 else if(kind===integrityKind){demand(project==='semosub',400,'Integrity project required');try{validateIntegrityInput(input);}catch{demand(false,400,'Invalid integrity request');}}
 else if(kind===guidanceKind){demand(project==='semosub',400,'Guidance project required');try{validateGuidanceInput(input);}catch{demand(false,400,'Unapproved guidance');}}
 else if(kind==='semologo-logo-collect')demand(Object.keys(input).length===1&&typeof input.sourceId==='string'&&semologoSources.has(input.sourceId),400,'Unregistered logo source');
 else if(kind==='semologo-domain-discover')demand(project==='semologo'&&Object.keys(input).length===1&&Array.isArray(input.domains)&&input.domains.length>=1&&input.domains.length<=MAX_DOMAINS&&new Set(input.domains).size===input.domains.length&&input.domains.every(validDomain),400,'Invalid domain batch');
 else demand(['diagnostic','repository-check','subscription-research','stom-original-preflight','stom-original-stage','stom-isolation-preflight'].includes(kind)&&Object.keys(input).length===0,400,'Handler not enabled');
 const owner=body.workerId??spec.owner;
 demand((spec.owners??[spec.owner]).includes(owner),400,'Worker not assigned to this job');
 const identity={kind,commit,input};if(body.workerId!==undefined)identity.workerId=owner;
 return {project,kind,requestKey,commit,input,owner,inputHash:hash(canonical(identity))};
}
export function redactJob(j){const {lease_token,lease_until,...rest}=j;return rest;}
export function diagnostic(job,runtimeVersion){const result={jobId:job.id,project:job.project,commit:job.commit_sha,kind:'diagnostic',schemaVersion:1};if(runtimeVersion!==undefined)result.runtimeVersion=runtimeVersion;return {result,sha256:hash(canonical(result))};}
export function verifyEvidence(job,e){
 demand(job.kind==='diagnostic',409,'Artifact adapter not enabled');
 const version=e?.result?.runtimeVersion;
 demand(version===undefined||(typeof version==='string'&&/^[a-zA-Z0-9._-]{1,64}$/.test(version)),400,'Invalid runtime version');
 demand(e&&canonical(e)===canonical(diagnostic(job,version)),400,'Invalid diagnostic evidence');
}
