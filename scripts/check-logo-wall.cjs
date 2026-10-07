const fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),cache=new Map();let owner='test-owner',savedSettings,storedSnapshot,rows,exportWall;const fetched=[];const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const db={release(){},async query(sql,args=[]){
 if(sql.includes('FROM semologo.logo_walls w'))return {rows:exportWall?[exportWall]:[],rowCount:exportWall?1:0};
 if(sql.includes('SELECT id,png'))return {rows:[],rowCount:0};
 if(sql.includes('SELECT id,payload'))return{rows,rowCount:rows.length};
 if(sql.includes('SELECT id,name'))return{rows:[],rowCount:0};
 if(sql.includes('INSERT INTO semologo.logo_walls')){savedSettings=args[3];return{rows:[{id:args[0],settings:savedSettings,version:1}],rowCount:1};}
 if(sql.includes('INSERT INTO semologo.logo_wall_items'))storedSnapshot=args[4];
 return{rows:[],rowCount:0};
}};
class Pool{async connect(){return db;}async query(...args){return db.query(...args);}}
function load(file){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const localRequire=(name)=>{
  if(name==='pg')return{Pool};
  if(name==='sharp')return input=>{const chain={resize:()=>chain,timeout:()=>chain,png:()=>chain,toBuffer:async()=>input};return chain;};
  if(name==='@/app/api/logo-preview/route')return{GET:async()=>new Response(png)};
  if(name==='@/lib/logo-owner')return{logoOwner:async()=>owner};
  if(name.endsWith('.json'))return JSON.parse(fs.readFileSync(path.resolve(path.dirname(file),name),'utf8'));
  if(name.startsWith('@/')||name.startsWith('.')){let f=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(file),name);return load(f+'.ts');}
  return require(name);
 };
 vm.runInNewContext(code,{exports,require:localRequire,process:{env:{DB_VIBERS_MAIN_URL:'test-only',NEXT_PUBLIC_CDN_URL:'https://cdn.example/_clients'}},console,Buffer,Response,Request,URL,AbortSignal,setTimeout,fetch:async url=>{fetched.push(String(url));return new Response(png);}},{filename:file});return exports;
}
async function main(){
 const {logoPngCandidates}=load('src/lib/logo-png-source.ts');
 const {applyReviewedAssets,reviewedVariants}=load('src/lib/reviewed-logo-assets.ts');
 const nh=applyReviewedAssets({id:'nhqv',logo_svg:'logo.svg',has_svg:true,logo_png:true});
 assert.equal(nh.has_svg,false);assert.equal(reviewedVariants.nhqv.variants.length,0);
 assert(!logoPngCandidates(nh).some(url=>url.includes('logo-transparent.png')));
 const seongnam=applyReviewedAssets({id:'seongnam'});
 assert(seongnam.preview_png.includes('official-ci-20261007'));
 const relative=logoPngCandidates({id:'relative',logo_png:'logo.png'});
 assert.equal(relative[0],'https://cdn.example/_clients/relative/logo.png?v=1790381000');
 assert.equal(logoPngCandidates({id:'nested',logo_png:'sources/reviewed/logo.png'})[0],'https://cdn.example/_clients/nested/sources/reviewed/logo.png?v=1790381000');
 assert.equal(logoPngCandidates({id:'upload',logo_png:'/submissions/test.png'})[0],'/submissions/test.png');
 assert.equal(logoPngCandidates({id:'cdn',logo_png:'https://assets.example/logo.png'})[0],'https://assets.example/logo.png');

 const {logoWallLayout}=load('src/lib/logo-wall-layout.ts');
 const old=logoWallLayout({background:'auto',columns:4});assert.equal(old.appearance,'cards');assert.equal(old.showNames,true);
 const layout=logoWallLayout({appearance:'clean',spacing:'airy',logoSize:'large',showNames:false,motion:'alternating'});
 assert.throws(()=>logoWallLayout({columns:999}));assert.throws(()=>logoWallLayout({showNames:'false'}));assert.throws(()=>logoWallLayout({appearance:'url(evil)'}));
 const {cmsBrand,logoWallAsset}=load('src/lib/cms-brand.ts');
 const b=cmsBrand('test-brand',{name_ko:'테스트',logo_png:null,metadata:{has_png:true,has_svg:true,light:true}});
 assert.equal(logoWallAsset('test-brand',{metadata:{light:true,has_png:true}},{name:'old name',light:false}).light,true);
 assert.equal(logoWallAsset('test-brand',{name_ko:'new name'},{name:'old name'}).name_ko,'old name');
 assert.equal(b.has_png,true);assert.equal(b.light,true);assert.equal(cmsBrand('test-brand',{light:false,metadata:{light:true}}).light,false);
 const {logoWallHtml}=load('src/lib/logo-wall-html.ts');
 const logos=[{id:'test',name:'<script>unsafe</script>',file:'logos/001-test.png',light:true}];
 const html=logoWallHtml('<unsafe>',layout,logos);
 assert(html.includes('&lt;unsafe&gt;'));assert(!html.includes('<script>unsafe'));assert(html.includes('height:104px'));assert(html.includes('gap:40px'));assert(html.includes('class="sr-only"'));assert(html.includes('prefers-reduced-motion'));assert(!/src="https?:/.test(html));
 assert.throws(()=>logoWallHtml('bad',{},[{id:'x',file:'../outside.png'}]));assert(logoWallHtml('empty',{motion:'marquee'},[]).includes('class="grid"'));
 const handler=load('src/app/api/logo-walls/route.ts');
 const req=body=>new Request('https://example.test/api/logo-walls',{method:'POST',body:JSON.stringify(body)});
 owner=null;assert.equal((await handler.POST(req({}))).status,401);owner='test-owner';
 assert.equal((await handler.POST(req({title:'test',brandIds:['test-brand'],settings:{columns:1}}))).status,400);
 rows=[{id:'test-brand',payload:{name_ko:'테스트',logo_png:null,metadata:{has_png:true,light:true}}}];
 assert.equal((await handler.POST(req({title:'test',brandIds:['test-brand'],settings:layout}))).status,201);
 assert.equal(savedSettings.spacing,'airy');assert.equal(savedSettings.showNames,false);assert.equal(storedSnapshot.has_png,true);assert.equal(storedSnapshot.light,true);
 const review=JSON.parse(fs.readFileSync(path.join(root,'src/lib/logo-quality-review.json'),'utf8'));
 const id=Object.keys(review).find(id=>review[id].status==='quarantined');rows=[{id,payload:{name_ko:'quarantined'}}];
 assert.equal((await handler.POST(req({title:'test',brandIds:[id]}))).status,400);
 const exporter=load('src/app/api/logo-walls/export/route.ts');
 exportWall={id:'test-wall',title:'export',version:1,settings:layout,items:[{brand_id:'test-brand',snapshot:{name:'test',logo_png:'https://cdn.example/_clients/test-brand/logo.png',light:false}}]};
 assert.equal((await exporter.GET(new Request('https://example.test/?id=test-wall'))).status,200);assert(fetched[0].includes('/logo.png'));
 fetched.length=0;exportWall.items=[{brand_id:id,snapshot:{name:'bad'}}];assert.equal((await exporter.GET(new Request('https://example.test/?id=test-wall'))).status,422);assert.equal(fetched.length,0);
 exportWall=undefined;assert.equal((await exporter.GET(new Request('https://example.test/?id=test-wall'))).status,404);
 console.log('PASS: legacy layouts, safe persisted styles, migrated asset flags, offline HTML, auth, quarantine save/export guards and representative PNG export order');
}
main().catch(e=>{console.error(e);process.exitCode=1});
