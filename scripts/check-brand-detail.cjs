const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const js=ts.transpileModule(fs.readFileSync('src/lib/brand-detail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let status='published',fallbacks=0,queries=[];const api={};
vm.runInNewContext(js,{exports:api,process:{env:{DB_VIBERS_MAIN_URL:'configured'}},require(name){
 if(name==='server-only')return {};if(name==='react')return {cache:fn=>fn};
 if(name==='./brands')return {fetchBrand:async()=>{fallbacks++;return null;}};
 if(name==='./cms-brand')return {cmsBrand:(id,p)=>({id,...p})};
 if(name==='./traffic-db')return {trafficDb:()=>({query:async(sql,args)=>{queries.push({sql,args});return {rows:[{status,payload:{name_ko:'하이퍼닉스'}}]};}})};
 throw Error(name);
}});
(async()=>{assert.equal((await api.fetchBrand('hypernix')).name_ko,'하이퍼닉스');assert.equal(fallbacks,0);assert.equal(JSON.stringify(queries[0].args),'["hypernix"]');status='archived';assert.equal(await api.fetchBrand('hypernix'),null);assert.equal(fallbacks,0);console.log('PASS single-row CMS detail read avoids full catalog and honors publication status');})();
