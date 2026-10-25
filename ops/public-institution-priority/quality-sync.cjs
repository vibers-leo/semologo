// Read public quality votes. A vote requests source review, never auto-approves an asset.
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
(async()=>{
  const response=await fetch('https://firestore.googleapis.com/v1/projects/ai-recipe-lab/databases/(default)/documents:runQuery',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({structuredQuery:{from:[{collectionId:'logo_quality'}],
      orderBy:[{field:{fieldPath:'down'},direction:'DESCENDING'}],limit:500}}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Quality vote read failed: '+response.status);
  const votes=(await response.json()).filter(r=>r.document).map(r=>({
    id:r.document.name.split('/').pop(),down:Number(r.document.fields.down?.integerValue||0),
    flagged:r.document.fields.flagged?.booleanValue===true})).filter(v=>v.flagged&&v.down>0);
  const rows=(await pool.query(`SELECT p.id,p.payload,q.status,q.review
    FROM semologo.logo_posts p LEFT JOIN semologo.logo_quality_reviews q ON q.brand_id=p.id
    WHERE p.id=ANY($1::text[]) AND p.status='published'`,[votes.map(v=>v.id)])).rows;
  const byId=new Map(rows.map(r=>[r.id,r]));const ready=[],unresolved=[];
  for(const vote of votes){
    const row=byId.get(vote.id);
    if(row?.status==='repaired'&&vote.down<=Number(row.review?.down_at_review||0))continue;
    const b=row?.payload||{};
    const official=b.official_source_page||b.website||(b.domain?'https://'+b.domain:null);
    const entry={brand_id:vote.id,name:b.name_ko||b.name_en||vote.id,down:vote.down,
      collection_id:'quality-votes',snapshot_id:'quality-votes',member_key:vote.id+':'+vote.down,
      homepage:official,source_url:official};
    if(official)ready.push(entry);else unresolved.push({...entry,reason:'official-site-resolution-required'});
  }
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),flagged:votes.length,ready,unresolved}));
})().finally(()=>pool.end()).catch(e=>{console.error(e.message);process.exitCode=1;});
