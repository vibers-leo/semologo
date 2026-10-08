const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const js=ts.transpileModule(fs.readFileSync('src/app/api/admin/logo-posts/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let authorized=false,calls=[];const route={};const query=async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('UPDATE'))return {rowCount:1};return {rows:sql.includes('count(*)')?[{total:1}]:[{id:'hypernix',payload:{name_ko:'하이퍼닉스'},status:'published'}]};};
vm.runInNewContext(js,{exports:route,Response,URL,AbortSignal,require(name){if(name.endsWith('traffic-db'))return {trafficAdmin:async()=>authorized,trafficDb:()=>({query})};if(name.endsWith('cms-brand'))return {cmsBrand:(id,payload)=>({id,...payload})};throw Error(name);}});
(async()=>{
assert.equal((await route.GET(new Request('https://test/api'))).status,403);assert.equal((await route.PATCH(new Request('https://test/api',{method:'PATCH',body:'{}'}))).status,403);assert.equal(calls.length,0);
authorized=true;assert.equal((await route.GET(new Request('https://test/api?status=deleted'))).status,400);
const r=await route.GET(new Request('https://test/api?q=%27%3BDROP%20TABLE&page=-1'));assert.equal(r.status,200);assert.equal((await r.json()).posts[0].id,'hypernix');assert.equal(calls[0].args[2],0);assert.ok(calls.every(c=>!c.sql.includes('DROP TABLE')));assert.equal(calls[0].args[1],"';DROP TABLE");
assert.equal((await route.PATCH(new Request('https://test/api',{method:'PATCH',body:JSON.stringify({id:'../x',status:'archived'})}))).status,400);
const saved=await route.PATCH(new Request('https://test/api',{method:'PATCH',body:JSON.stringify({id:'hypernix',status:'archived'})}));assert.equal(saved.status,200);const update=calls.at(-1);assert.deepEqual(Array.from(update.args),['hypernix','archived']);assert.ok(update.sql.includes("jsonb_set(payload,'{status}'"));assert.ok(!/DELETE|logo_png|logo_svg/.test(update.sql));
console.log('PASS admin authorization, validated pagination/status, parameterized search, reversible status-only update');
})().catch(e=>{console.error(e);process.exitCode=1});
