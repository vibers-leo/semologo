const fs=require('node:fs');const{Pool}=require('pg');
const catalog=JSON.parse(fs.readFileSync(0,'utf8')).brands;
const start=catalog.findIndex(b=>b.id==='gongu-ci-1575');
const end=catalog.findIndex(b=>b.id==='korean-environmental-education-network');
if(start<0||end<start)throw Error('Public category boundaries changed');
const candidates=catalog.slice(start,end+1);
const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
(async()=>{
 const rows=(await p.query(`SELECT p.id,p.payload,b.png_file automatic_png,q.review
   FROM semologo.logo_posts p LEFT JOIN semologo.logo_background_previews b ON b.id=p.id
   LEFT JOIN semologo.logo_quality_reviews q ON q.brand_id=p.id WHERE p.id=ANY($1::text[])`,[candidates.map(b=>b.id)])).rows;
 const byId=new Map(rows.map(r=>[r.id,r]));
 const items=candidates.map(b=>{
   const row=byId.get(b.id)||{},v=row.payload||{};
   const file=v.presentation?.file||row.automatic_png||(typeof v.logo_png==='string'?v.logo_png:'logo.png');
   const safe=file.startsWith('generated-')?'logo.png':file;
   const url=/^https:\/\//.test(safe)?safe:'https://logo.vibers.co.kr/_clients/'+b.id+'/'+safe;
   return{id:b.id,name:b.name_ko||b.name_en,file:safe,url,has_svg:!!b.has_svg,website:v.website,domain:v.domain,
     official_source_page:v.official_source_page,quality_replacement:v.quality_replacement===true,review:row.review||null};
 });
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),category:'공공·기관',sort:'fame',
   startIndex:start,endIndex:end,rangeTotal:end-start+1,pngOnly:candidates.filter(b=>!b.has_svg&&b.has_png).length,items}));
})().finally(()=>p.end()).catch(e=>{console.error(e.message);process.exitCode=1});
