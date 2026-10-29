const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=process.cwd(),cache=new Map();
let owner='alice',allowed=true,writes=0,principalKind='pilot';
const meteredRequests=[];
const walls=new Map(),sessions=new Map(),queued=new Map();let transactionSnapshot=null,failItems=false;
const clone=m=>new Map(JSON.parse(JSON.stringify([...m])));
const restore=(m,s)=>{m.clear();for(const [k,v]of s)m.set(k,v)};
const brands=[
 {id:'toss',name_ko:'토스',name_en:'Toss',category:'금융·결제',origin:'KR',has_png:true,fame:90},
 {id:'kakao',name_ko:'카카오',name_en:'Kakao',category:'IT·테크',origin:'KR',has_png:true,fame:95},
 {id:'naver',name_ko:'네이버',name_en:'Naver',category:'IT·테크',origin:'KR',has_png:true,aliases:['NAVER Corp'],fame:100},
 {id:'kakaobank',name_ko:'카카오뱅크',name_en:'Bank',category:'금융·결제',origin:'KR',has_png:true,fame:80},
 {id:'foreign',name_ko:'해외은행',name_en:'Foreign',category:'금융·결제',origin:'GLOBAL',has_png:true,fame:900},
 {id:'hidden',name_ko:'숨김',name_en:'Hidden',category:'금융·결제',origin:'KR',has_png:true,hidden:true},
 {id:'duplicate',name_ko:'토스',name_en:'Toss legacy',category:'금융·결제',origin:'KR',has_png:true,variant_of:'toss'},
];
const db={release(){},async query(sql,args=[]){
 if(sql==='BEGIN'){assert.equal(transactionSnapshot,null,'must share one outer transaction');transactionSnapshot=[clone(walls),clone(sessions),clone(queued)];return{rows:[]};}
 if(sql==='COMMIT'){transactionSnapshot=null;return{rows:[]};}
 if(sql==='ROLLBACK'){if(transactionSnapshot){restore(walls,transactionSnapshot[0]);restore(sessions,transactionSnapshot[1]);restore(queued,transactionSnapshot[2]);transactionSnapshot=null;}return{rows:[]};}
 if(sql.includes('SELECT count(*)')&&sql.includes('collection_sessions'))return{rows:[{n:0}]};
 if(sql.includes('SELECT * FROM semologo.logo_wall_collection_sessions')){const row=sql.includes('request_key=')?[...sessions.values()].find(s=>s.owner_id===args[0]&&s.request_key===args[1]):sessions.get(args[0]);const good=row&&(sql.includes('request_key=')||row.owner_id===args[1]);return{rows:good?[row]:[],rowCount:good?1:0};}
 if(sql.includes('INSERT INTO semologo.logo_wall_collection_sessions')){const row={id:args[0],owner_id:args[1],request_key:args[2],input:args[3],status:'collecting',wall_id:null,wall_version:null,applied_signature:null};sessions.set(row.id,row);return{rows:[row],rowCount:1};}
 if(sql.includes('INSERT INTO semologo.logo_request_queue')){const row=queued.get(args[1])||{id:args[0],status:'pending'};queued.set(args[1],row);return{rows:[row],rowCount:1};}
 if(sql.includes('UPDATE semologo.logo_wall_collection_sessions')){const row=sessions.get(args[0]);Object.assign(row,{status:args[2],request_ids:args[3],wall_id:args[4],wall_version:args[5],applied_signature:args[6]});return{rows:[],rowCount:1};}
 if(sql.includes('UPDATE semologo.logo_walls SET')){const w=walls.get(args[0]);if(!w||w.owner!==args[1]||w.version!==args[3])return{rows:[],rowCount:0};Object.assign(w,{title:args[2],settings:args[4],version:w.version+1});return{rows:[w],rowCount:1};}
 if(sql.includes('DELETE FROM semologo.logo_wall_items')){walls.get(args[0]).items=[];return{rows:[]};}
 if(sql.includes('INSERT INTO semologo.logo_wall_items')){if(failItems)throw Error('simulated item persistence failure');walls.get(args[0]).items.push(args[2]);return{rows:[],rowCount:1};}
 if(sql.includes('SELECT id,payload'))return{rows:brands.map(b=>({id:b.id,payload:b})),rowCount:brands.length};
 if(sql.includes('SELECT id,name'))return{rows:[],rowCount:0};
 if(sql.includes('INSERT INTO semologo.logo_walls')){const wall={id:args[0],owner:args[1],title:args[2],settings:args[3],version:1,items:[]};walls.set(wall.id,wall);writes++;return{rows:[wall],rowCount:1};}
 if(sql.includes('FROM semologo.logo_walls WHERE id=')){const w=walls.get(args[0]);return{rows:w?.owner===args[1]?[w]:[],rowCount:w?.owner===args[1]?1:0};}
 if(sql.includes('SELECT i.item_id'))return{rows:[],rowCount:0};
 return{rows:[],rowCount:0};
}};
class Pool{async connect(){return db;}async query(...args){return db.query(...args);}}
const env={DB_VIBERS_MAIN_URL:'test-only',SEMOLOGO_MCP_ENABLED:'1',NODE_ENV:'test',NEXT_PUBLIC_CDN_URL:'https://cdn.example/_clients'};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const req=name=>{
 if(name==='@/lib/logo-wall-export')return{exportLogoWall:async request=>{const w=walls.get(new URL(request.url).searchParams.get('id'));return w?.owner===owner?Response.json({title:w.title,count:3,version:1,image:'data:image/png;base64,iVBORw0KGgo='}):new Response(null,{status:404})}};
 if(name==='@/lib/developer-api-auth')return{resolveMcpPrincipal:async()=>owner?{owner,kind:principalKind,scopes:[]}:null};
 if(name==='@/lib/developer-api-usage')return{meteredMcpTool:async(principal,name,args,request,fn)=>{meteredRequests.push({name,args,key:request.headers.get('idempotency-key'),kind:principal.kind});if(principal.kind==='api_key'&&['create_logo_wall','collect_missing_logo_wall','resume_logo_wall'].includes(name)&&!request.headers.get('idempotency-key'))throw Error('api_idempotency_required');return fn()}};
 if(name==='pg')return{Pool};if(name==='@/lib/logo-owner')return{logoOwner:async()=>owner};
 if(name==='@/lib/logo-wall-pilot-limit')return{wallPilotAllowed:async()=>allowed};
 if(name.endsWith('/cms-brand'))return{cmsBrand:(id,p)=>({...p,id}),logoWallAsset:(id,p)=>({...p,id})};
 if(name.endsWith('/logo-wall-cdn'))return{cdnPng:async()=>Buffer.from('fixture')};
 if(name.endsWith('/logo-wall-ink'))return{wallInkMetrics:async()=>({width:400,height:100,density:.4})};
 if(name.endsWith('/brands'))return{fetchVariants:async()=>null};
 if(name.endsWith('/logo-png-source'))return{logoWallPngCandidates:b=>[`https://cdn.example/${b.id}/logo.png`]};
 if(name.startsWith('@/')||name.startsWith('.'))return load((name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(file),name))+'.ts');
 return require(name);
 };
 vm.runInNewContext(code,{exports,require:req,process:{env},console,Buffer,Headers,Response,Request,URL,AbortSignal,setTimeout,Error},{filename:file});return exports;
}
const post=(body,headers={})=>new Request('https://semologo.com/api/mcp/',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
async function main(){
 const {selectWallBrands,parseWallSelection}=load('src/lib/logo-wall-selection.ts');
 const r=selectWallBrands(parseWallSelection({names:['토스','카카오','네이버','토스']}),brands);
 assert.equal(r.selected.map(x=>x.id).join(','),'toss,kakao,naver');assert.equal(r.ready,true);
 const ambiguous=selectWallBrands({names:['토스']},[...brands,{...brands[0],id:'same-name-other-company'}]);assert.equal(ambiguous.ready,false);assert.equal(ambiguous.unresolved[0].reason,'ambiguous');
 assert.equal(selectWallBrands({names:['missing']},brands).ready,false);
 for(const bad of [{names:['...']},{names:['토스'],sector:'finance'},{names:[],sector:'finance'},{names:['토스'],count:101},{sector:'__proto__'},{sector:'finance',origin:'Mars'},{names:['토스'],url:'http://localhost/'}])assert.throws(()=>parseWallSelection(bad));
 const {POST,GET}=load('src/app/api/mcp/route.ts');
 let response=await POST(post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}}));assert.equal((await response.json()).result.serverInfo.name,'semologo-logo-walls');
 response=await POST(post({jsonrpc:'2.0',id:2,method:'tools/list'}));assert.equal((await response.json()).result.tools.length,6);
 response=await POST(post({jsonrpc:'2.0',method:'notifications/initialized'}));assert.equal(response.status,202);
 assert.equal((await GET(new Request('https://semologo.com/api/mcp/'))).status,405);
 response=await POST(post('{'));assert.equal((await response.json()).error.code,-32700);
 response=await POST(post({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'unknown'}}));assert.equal((await response.json()).error.code,-32602);
 response=await POST(post({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'prepare_logo_wall',arguments:{sector:'finance',count:2}}}));let data=(await response.json()).result.structuredContent;assert.equal(data.plan.items.map(x=>x.brandId).join(','),'toss,kakaobank');assert.equal(writes,0);
 response=await POST(post({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'create_logo_wall',arguments:{names:['토스','카카오','네이버'],settings:{background:'dark',columns:3}}}}));data=(await response.json()).result.structuredContent;assert.equal(data.created,true);assert.equal(writes,1);assert.equal(data.wall.owner,'alice');assert.equal(data.wall.settings.columns,3);assert(data.editorPath.includes(data.wall.id));const wallId=data.wall.id;
 response=await POST(post({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'create_logo_wall',arguments:{names:['missing']}}}));data=(await response.json()).result.structuredContent;assert.equal(data.created,false);assert.equal(writes,1);
 response=await POST(post({jsonrpc:'2.0',id:61,method:'tools/call',params:{name:'preview_logo_wall',arguments:{id:wallId}}}));data=(await response.json()).result;assert.equal(data.content[1].type,'image');assert.equal(data.structuredContent.previewPngBase64,undefined);
 owner='bob';response=await POST(post({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'get_logo_wall',arguments:{id:wallId}}}));assert.equal((await response.json()).result.isError,true);
 owner=null;assert.equal((await POST(post({jsonrpc:'2.0',id:8,method:'tools/list'}))).status,401);owner='alice';
 assert.equal((await POST(post({}, {origin:'https://evil.example'}))).status,403);
 allowed=false;assert.equal((await POST(post({jsonrpc:'2.0',id:9,method:'tools/list'}))).status,429);allowed=true;
 assert.equal((await POST(post('x'.repeat(17000)))).status,413);
 assert.equal((await POST(post({}, {accept:'application/json'}))).status,406);
 assert.equal((await POST(post({}, {'mcp-protocol-version':'2099-01-01'}))).status,400);
 env.SEMOLOGO_MCP_ENABLED='0';assert.equal((await POST(post({}))).status,503);
 console.log('PASS: exact names, canonical deduplication, ambiguity/missing holds, KR sector selection, no preview writes, MCP lifecycle, create→shared storage, ownership isolation, schema, origin/auth/rate/pilot gates');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={load,brands,walls,sessions,queued,meteredRequests,setPrincipalKind:v=>{principalKind=v},setFail:v=>{failItems=v}};
