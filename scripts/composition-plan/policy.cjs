'use strict';
const SLOTS=['symbol','wordmark','horizontal','vertical'];
const LABELS={symbol:'심볼',wordmark:'로고타입·텍스트',horizontal:'가로조합',vertical:'세로조합'};
const SEEDS=['genesis','cheongju','prada','burberry','chanel','louisvuitton','fendi','dior','gucci','celine','balenciaga','loewe','yves-saint-laurent','musinsa','blackyak','nike','adidas','samsung','naver','nexon-co','sk-hynix'];
function domainOf(payload){
 for(const value of [payload.website,payload.domain,payload.official_source_page]){
  if(typeof value!=='string'||!value)continue;
  try{const u=new URL(value.includes('://')?value:'https://'+value),d=u.hostname.toLowerCase().replace(/^www\./,'');if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d))return d}catch{}
 }return null;
}
function compositionCoverage(manifest,rejected=[],decisions=[]){
 const all=Array.isArray(manifest?.variants)?manifest.variants:[];const present={};const fingerprintSlots=new Map();
 for(const v of all){const slot=v.lockup&&v.lockup!=='unknown'?v.lockup:v.form;if(!SLOTS.includes(slot)||v.review_status==='rejected')continue;const files=Object.fromEntries(Object.entries(v.files||{}).filter(([k,f])=>['svg','png'].includes(k)&&typeof f==='string'&&f&&!rejected.includes(f)));if(!Object.keys(files).length)continue;
 const fingerprint=v.visual_sha256||v.source_sha256||files.svg||files.png;
 if(v.review_status==='verified'){if(!fingerprintSlots.has(fingerprint))fingerprintSlots.set(fingerprint,new Set());fingerprintSlots.get(fingerprint).add(slot)}
 (present[slot]??=[]).push({key:v.key,files,review:v.review_status||'unreviewed',source:v.source_url||null,fingerprint});}
 const result={};
 for(const slot of SLOTS){const found=present[slot]||[],verified=found.filter(v=>v.review==='verified'&&fingerprintSlots.get(v.fingerprint)?.size===1);const decision=decisions.find(d=>d.slot===slot&&d.state==='not_offered'&&d.evidence_url&&d.note&&d.reviewed_at);
 result[slot]={state:verified.length?'available_verified':decision?'not_offered':found.length?'review_required':Object.values(present).flat().some(v=>v.review==='verified')?'collect_needed':'unassessed',artwork:found,svg:verified.some(v=>v.files.svg),png:verified.some(v=>v.files.png),...(decision&&!verified.length?{decision}: {})};}
 return result;
}
function priorityFor(row){const p=row.payload||{},n=Number(row.interactions)||0;let priority=10;const reasons=[];
 if(row.requested){priority+=1000;reasons.push('user-request')}
 if(SEEDS.includes(row.id)){priority+=250;reasons.push('requested-focus')}
 if(n>=10){priority+=Math.min(n,100)+100;reasons.push('popular-10-plus')}
 if((p.origin==='KR'||/[가-힣]/.test(p.name_ko||''))&&p.category==='공공·기관'){priority+=100;reasons.push('korean-public')}
 if(p.category==='뷰티·패션'){priority+=70;reasons.push('fashion')}
 return {priority,reasons};
}
function retryDays(attempts){return [0,7,14,30][Math.min(3,Math.max(0,attempts))]}
module.exports={SLOTS,LABELS,SEEDS,domainOf,compositionCoverage,priorityFor,retryDays};
