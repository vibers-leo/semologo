const fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,Buffer,require(name){return name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts'):require(name)}},{filename:file});return exports;}
(async()=>{
 const {logoWallBundle,logoWallInlineHtml}=load('src/lib/logo-wall-html.ts');
 const logos=[{id:'safe',name:'</script><img src=x onerror=alert(1)>',file:'logos/001-safe.png',scale:200}];
 const bundle=logoWallBundle('</title><script>bad()</script>',{motion:'marquee'},logos);
 assert(bundle.html.includes('href="styles.css"'));assert(bundle.html.includes('src="script.js"'));assert(!bundle.html.includes('<style>'));assert(!bundle.html.includes('<script>bad'));assert(bundle.css.includes('@keyframes'));assert(bundle.javascript.includes('addEventListener'));
 const data='data:image/png;base64,'+Buffer.from('fixture').toString('base64');
 const html=logoWallInlineHtml('preview',{},logos,{'logos/001-safe.png':data});assert(html.includes('src="'+data+'"'));assert(!html.includes('src="logos/'));assert(html.includes('event.source!==parent'));assert.throws(()=>logoWallInlineHtml('bad',{},logos,{'logos/001-safe.png':'https://outside.test/a.png'}));
 const {logoWallPreview}=load('src/lib/logo-wall-preview.ts');const red=await sharp({create:{width:80,height:30,channels:4,background:'#ff0000'}}).png().toBuffer();
 for(const count of [1,4,100]){const image=await logoWallPreview({background:'light'},Array.from({length:count},()=>({data:red,scale:200})));const meta=await sharp(image).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,630);const {data:pixels}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});let reds=0;for(let i=0;i<pixels.length;i+=3)if(pixels[i]>200&&pixels[i+1]<40&&pixels[i+2]<40)reds++;assert(reds>count*10,'Composite must contain logo pixels');}
 console.log('PASS editable offline bundle, escaped titles/names, PNG-only inline preview, parent-only playback messages, 1200×630 real PNG compositor with 1/4/100 logos and 200% scale');
})().catch(e=>{console.error(e);process.exitCode=1});
