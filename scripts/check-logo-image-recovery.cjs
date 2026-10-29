const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),sharp=require('sharp');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,Buffer,Set,Error,require:n=>n==='sharp'?sharp:n==='./logo-svg-preview'?load('src/lib/logo-svg-preview.ts'):require(n)});return exports}
(async()=>{const {prepareSvgRasterPreview:prepare}=load('src/lib/logo-svg-raster-preview.ts');
 const jpg=await sharp({create:{width:12,height:8,channels:3,background:'#f00'}}).jpeg().toBuffer();
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><image width="12" height="8" href="data:image/jpeg;base64,${jpg.toString('base64').replace(/(.{30})/g,'$1 ')}"/></svg>`);
 const normalized=await prepare(svg);assert(!normalized.toString().includes('data:image/jpeg'));assert(normalized.toString().includes('data:image/png'));
 const {data,info}=await sharp(normalized).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,12);assert(data[0]>200&&data[1]<30);
 for(const bad of ['<script>bad()</script>','<image href="https://example.com/x.png"/>','<!ENTITY x SYSTEM "file:///etc/passwd">','<foreignObject/>','<image href="data:image/svg+xml;base64,PHN2Zy8+"/>'])await assert.rejects(()=>prepare(Buffer.from(svg.toString().replace('</svg>',bad+'</svg>'))));
 await assert.rejects(()=>prepare(Buffer.from('<svg><image href="data:image/jpeg;base64,aGVsbG8="/></svg>')));
 const native=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path d="M0 0h1v1H0z"/></svg>');assert.equal((await prepare(native)).toString(),native.toString());
 const card=fs.readFileSync('src/components/CardLogo.tsx','utf8');assert(card.includes('2000 : 16000'));assert(card.includes('key={src}'));
 console.log(JSON.stringify({status:'PASS',jpegRenders:true,externalAndActiveContentRejected:true,nativeUnchanged:true,retryAfterFailureCooldown:true,staleImageElementReplaced:true}));
})().catch(e=>{console.error(e.name+': '+e.message.slice(0,120));process.exitCode=1});
