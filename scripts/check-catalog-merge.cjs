const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/catalog-merge.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
const catalog=[{id:'existing',name_ko:'reviewed'}],cms=[{id:'existing',name_ko:'stale'},{id:'new',name_ko:'published'}];
const merge=exportsObject.createCatalogMerger([{id:'submitted'}],[{id:'existing',name_ko:'wrong'},{id:'extra',name_ko:'first'},{id:'extra',name_ko:'last'}]);
const first=merge(catalog,cms);assert.equal(first.find(x=>x.id==='existing').name_ko,'reviewed');assert.equal(first.find(x=>x.id==='extra').name_ko,'last');assert.equal(first.length,4);assert.equal(merge(catalog,cms),first,'same revision must reuse the large merged array');
const nextCms=[...cms,{id:'later'}];const second=merge(catalog,nextCms);assert.notEqual(second,first);assert.equal(second.length,5);assert.equal(first.length,4,'do not mutate prior snapshots');assert.equal(merge(catalog,nextCms),second);assert.notEqual(merge([...catalog],nextCms),second);
console.log('PASS merged catalog reuse, source revision invalidation, existing review precedence, CMS additions and immutable prior snapshots');
