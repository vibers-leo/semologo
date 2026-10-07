const fs=require('fs'),path=require('path'),ts=require('typescript');
function load(file){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m.exports,require('node:module').createRequire(path.resolve(file)),m);return m.exports;}
const {prepareSvgPreview}=load('src/lib/logo-svg-preview.ts');let count=0;const failed=[];
for(const file of ['submissions','simple-icons-submissions','streaming-submissions','index-candidate-review-submissions']){
 const brands=Object.values(load('src/lib/'+file+'.ts')).find(Array.isArray);
 for(const b of brands){if(b.hidden)continue;for(const source of [b.logo_png,b.logo_svg]){
  if(typeof source!=='string'||!source.startsWith('/submissions/'))continue;count++;
  try{if(source.includes('..')||source.includes('\\'))throw Error('unsafe path');const bytes=fs.readFileSync(path.join('public',source));if(bytes.length>12000000)throw Error('over 12 MB');if(source.endsWith('.svg'))prepareSvgPreview(bytes);else if(!(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) && !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('invalid PNG');}
  catch(e){failed.push({id:b.id,source,reason:e.message});}
 }}
}
console.log(JSON.stringify({checked:count,failed:failed.length,failures:failed},null,2));process.exitCode=failed.length?1:0;
