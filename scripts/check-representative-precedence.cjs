const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(!(id in imports))throw Error('Unexpected import '+id);return imports[id]}});return exports}
const cdn={CDN:'https://logo.vibers.co.kr/_clients',VERSION:'test'};
const presentation=load('src/lib/logo-presentation.ts',{'./cdn':cdn});
const saved={file:'sources/admin/horizontal.png',bg:'light'};
const brand={id:'hyundai',has_svg:true,has_png:false,logo_png:'old-vertical.png',presentation:saved};
const shown=presentation.applyPresentation(brand);
assert.equal(shown.logo_png,saved.file);assert.equal(shown.has_png,true);assert.ok(shown.preview_png.includes(saved.file));assert.equal(brand.logo_png,'old-vertical.png');
const quality=load('src/lib/logo-quality-review.ts',{'./logo-presentation':presentation,'./reviewed-logo-assets':{applyReviewedAssets:b=>({...b,presentation:{file:'old-default.png',bg:'dark'}})},'./logo-quality-review.json':{default:{}},'./reviewed-country-categories-20261010.json':{default:{}},'./cdn':cdn});
assert.equal(quality.applyQualityReview(brand).presentation.file,saved.file);
assert.equal(quality.applyQualityReview({...brand,presentation:undefined}).presentation.file,'old-default.png');
assert.equal(presentation.applyPresentation({...brand,rejected_asset_files:[saved.file]}).logo_png,'old-vertical.png');
assert.equal(presentation.validPresentation({file:'../foreign.png',bg:'light'}),false);
console.log('PASS saved representative overrides review defaults; card/download PNG agree; rejected files blocked; original snapshots unchanged');
