// Read public quality votes. A vote requests source review, never auto-approves an asset.
const {Pool}=require('pg');
const fs=require('node:fs');
const sourceInput=fs.readFileSync(0,'utf8').trim();
const sourceData=sourceInput?JSON.parse(sourceInput):{sites:{},targets:[]};
const norm=s=>(s||'').normalize('NFKC').toLowerCase().replace(/주식회사|재단법인|\(주\)|\(재\)/g,'').replace(/[^가-힣a-z0-9]/g,'');
const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
(async()=>{
  const response=await fetch('https://firestore.googleapis.com/v1/projects/ai-recipe-lab/databases/(default)/documents:runQuery',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({structuredQuery:{from:[{collectionId:'logo_quality'}],
      orderBy:[{field:{fieldPath:'down'},direction:'DESCENDING'}],limit:5000}}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Quality vote read failed: '+response.status);
  const votes=(await response.json()).filter(r=>r.document).map(r=>({
    id:r.document.name.split('/').pop(),down:Number(r.document.fields.down?.integerValue||0),
    flagged:r.document.fields.flagged?.booleanValue===true})).filter(v=>v.flagged&&v.down>0);
  const rows=(await pool.query(`SELECT p.id,p.payload,q.status,q.review
    FROM semologo.logo_posts p LEFT JOIN semologo.logo_quality_reviews q ON q.brand_id=p.id
    WHERE p.id=ANY($1::text[]) AND p.status='published'`,[[...new Set([...votes.map(v=>v.id),...(sourceData.targets||[]).map(t=>t.id)])]])).rows;
  const byId=new Map(rows.map(r=>[r.id,r]));const ready=[],unresolved=[];
  const whiteById=new Map((sourceData.targets||[]).map(t=>[t.id,t]));
  const pending=new Map(votes.map(v=>[v.id,v]));
  for(const t of sourceData.targets||[])if(!pending.has(t.id))pending.set(t.id,{id:t.id,down:0,flagged:false});
  for(const vote of pending.values()){
    const row=byId.get(vote.id);
    const audited=whiteById.get(vote.id);
    const b=row?.payload||{};
    const changedSinceAudit=audited&&b.presentation?.file&&b.presentation.file!==audited.file;
    if(row?.status==='repaired'&&vote.down<=Number(row.review?.down_at_review||0)&&(!audited||changedSinceAudit))continue;
    const known=(sourceData.sites||{})[norm(b.name_ko||b.name_en||audited?.name)]||(sourceData.sitesById||{})[vote.id];
    const official=b.official_source_page||b.website||(b.domain?'https://'+b.domain:null)||known?.homepage;
    const entry={brand_id:vote.id,name:b.name_ko||b.name_en||vote.id,down:vote.down,
      collection_id:vote.flagged?'quality-votes':'white-background-audit',snapshot_id:'quality-review-20261025',
      member_key:vote.id+':'+vote.down+':'+(audited?.sha256||'vote'),
      homepage:official,source_url:known?.sourcePage||official,
      audited_file:audited?.file,audited_sha256:audited?.sha256,
      reason:audited?(audited.status==='fetch-failed'?'image-unavailable':'opaque-white-background'):'replacement-vote'};
    if(official)ready.push(entry);else unresolved.push({...entry,reason:'official-site-resolution-required'});
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),flagged:votes.length,ready,unresolved}));
})().finally(()=>pool.end()).catch(e=>{console.error(e.message);process.exitCode=1;});
