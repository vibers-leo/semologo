const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/catalog-merge.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
const catalog=[{id:'existing',name_ko:'reviewed'}],cms=[{id:'existing',name_ko:'stale'},{id:'new',name_ko:'published'}];
const merge=exportsObject.createCatalogMerger([{id:'submitted'}],[{id:'existing',name_ko:'wrong'},{id:'extra',name_ko:'first'},{id:'extra',name_ko:'last'}]);
const first=merge(catalog,cms);assert.equal(first.find(x=>x.id==='existing').name_ko,'reviewed');assert.equal(first.find(x=>x.id==='extra').name_ko,'last');assert.equal(first.length,4);assert.equal(merge(catalog,cms),first,'same revision must reuse the large merged array');
const nextCms=[...cms,{id:'later'}];const second=merge(catalog,nextCms);assert.notEqual(second,first);assert.equal(second.length,5);assert.equal(first.length,4,'do not mutate prior snapshots');assert.equal(merge(catalog,nextCms),second);assert.notEqual(merge([...catalog],nextCms),second);
console.log('PASS merged catalog reuse, source revision invalidation, existing review precedence, CMS additions and immutable prior snapshots');

const published=merge(catalog,[{id:'existing',name_ko:'stale',logo_published_at:'2026-10-09T00:00:00Z'}]);
assert.equal(published.find(x=>x.id==='existing').name_ko,'reviewed');
assert.equal(published.find(x=>x.id==='existing').logo_published_at,'2026-10-09T00:00:00Z');
assert.equal(merge(catalog,[{id:'existing',logo_published_at:'invalid'}]).find(x=>x.id==='existing').logo_published_at,undefined);
console.log('PASS publication timestamp overlay preserves reviewed content and rejects invalid dates');

const source=fs.readFileSync('src/lib/brands.ts','utf8');
const sortSource=source.slice(source.indexOf('export function sortForGrid('),source.indexOf('/** 검색 색인'));
const sorting={};vm.runInNewContext(ts.transpileModule(sortSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:sorting,applyQualityReview:b=>b});
const fixtures=[{id:'old',has_svg:true,added_at:'2026-01-01',logo_published_at:'2026-10-09T02:00:00Z'},{id:'import',has_svg:true,added_at:'2026-10-08'},{id:'cleanup',has_svg:true,added_at:'2025-01-01',updated_at:'2026-10-10'}];
assert.equal(sorting.sortForGrid(fixtures,'recent')[0].id,'old');
assert.equal(sorting.sortForGrid(fixtures,'recent').at(-1).id,'cleanup');
assert.equal(sorting.sortForGrid(fixtures,'fame',{import:100,old:1})[0].id,'import');
console.log('PASS new version leads latest; cosmetic edits do not bump; real popularity wins');

const boosted=[{id:'naver-blog',has_svg:true,discovery_boost:100},{id:'other',has_svg:true}];
const measured={other:50};
assert.equal(sorting.sortForGrid(boosted,'fame',measured)[0].id,'naver-blog');
assert.equal(measured.other,50);
assert.equal(sorting.sortForGrid(boosted,'fame',{other:200})[0].id,'other');
console.log('PASS explicit discovery boost leaves measured traffic unchanged');
