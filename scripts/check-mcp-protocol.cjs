const assert=require('node:assert/strict');
const fixture=require('./check-logo-wall-mcp.cjs');const {load}=fixture;
const {POST,GET,DELETE,OPTIONS}=load('src/app/api/mcp/route.ts');
const {dispatchWallMcp}=load('src/lib/logo-wall-mcp.ts');
const meta=()=>({'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'protocol-check',version:'1'},'io.modelcontextprotocol/clientCapabilities':{}});
function request(body,headers={}) {return new Request('https://semologo.com/api/mcp/',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...headers},body:JSON.stringify(body)})}
function modern(method,params={},headers={}){return POST(request({jsonrpc:'2.0',id:42,method,params:{...params,_meta:{...meta(),...params._meta}}},{'mcp-protocol-version':'2026-07-28','mcp-method':method,...(params.name?{'mcp-name':params.name}:{}),...headers}))}
async function main(){
 let calls=0;const fn=async()=>{calls++;return {ok:true}};
 for(const invalid of [null,[],{jsonrpc:'2.0',id:null,method:'ping'},{jsonrpc:'2.0',id:1.5,method:'ping'},{jsonrpc:'2.0',id:1,method:'ping',params:[]},{jsonrpc:'2.0',id:1,method:'ping',params:null},{jsonrpc:'2.0',id:1,method:'ping',result:{}}])assert((await dispatchWallMcp(invalid,fn)).error);
 assert.equal(calls,0);
 for(const capabilities of [null,[],true]){const r=await dispatchWallMcp({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1'},capabilities}},fn);assert.equal(r.error.code,-32602)}
 for(const clientInfo of [null,[],true,{}, {name:'test'}]){const r=await dispatchWallMcp({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo,capabilities:{}}},fn);assert.equal(r.error.code,-32602)}
 let r=await POST(request({jsonrpc:'2.0',id:1,method:'ping'},{'content-type':'application/json-attacker'}));assert.equal(r.status,415);
 for(const accept of ['application/json, text/event-stream;q=0','x-application/json, text/event-stream','application/json;q=2, text/event-stream','*/*'])assert.equal((await POST(request({}, {accept}))).status,406);
 for(const f of [GET,DELETE,OPTIONS])assert.equal((await f(new Request('https://semologo.com/api/mcp/',{headers:{origin:'https://evil.example'}}))).status,403);
 r=await modern('server/discover');let data=await r.json();assert.equal(r.status,200);assert.equal(data.result.resultType,'complete');assert(data.result.supportedVersions.includes('2026-07-28'));assert.equal(data.result._meta['io.modelcontextprotocol/serverInfo'].name,'semologo-logo-walls');
 r=await modern('tools/list');data=await r.json();assert.equal(data.result.tools.length,6);assert.equal(data.result.resultType,'complete');assert.equal(data.result.ttlMs,0);assert.equal(data.result.cacheScope,'private');
 r=await modern('tools/call',{name:'prepare_logo_wall',arguments:{names:['토스','카카오']}});data=await r.json();assert.equal(data.result.resultType,'complete');assert.equal(data.result.structuredContent.plan.items.length,2);
 for(const headers of [{'mcp-method':'tools/call'},{'mcp-protocol-version':''},{'mcp-protocol-version':'2025-11-25'}]){r=await modern('tools/list',{},headers);assert.equal(r.status,400);assert.equal((await r.json()).error.code,headers['mcp-protocol-version']==='2025-11-25'?-32020:-32020)}
 r=await modern('tools/call',{name:'prepare_logo_wall',arguments:{names:['토스']}} ,{'mcp-name':'other'});assert.equal((await r.json()).error.code,-32020);
 r=await modern('tools/call',{name:'prepare_logo_wall',arguments:{names:['토스']}} ,{'mcp-name':'=?base64?'+Buffer.from('prepare_logo_wall').toString('base64')+'?='});assert.equal(r.status,200);assert.equal((await r.json()).result.isError,false);
 r=await modern('tools/list',{_meta:{'io.modelcontextprotocol/clientCapabilities':null}});assert.equal((await r.json()).error.code,-32602);
 r=await modern('not/a/method');assert.equal(r.status,404);assert.equal((await r.json()).error.code,-32601);
 r=await modern('tools/list',{}, {'mcp-protocol-version':'2099-01-01'});data=await r.json();assert.equal(r.status,400);assert.equal(data.error.code,-32022);assert(data.error.data.supported.includes('2026-07-28'));
 let received;await dispatchWallMcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'prepare_logo_wall',arguments:{names:['토스']},_meta:{'com.semologo/idempotency-key':'00000000-0000-4000-8000-000000000001'}}},async(name,args,ctx)=>{received=ctx;return {ok:true}});assert.equal(received.idempotencyKey,'00000000-0000-4000-8000-000000000001');
 r=await modern('tools/call',{name:'prepare_logo_wall',arguments:{names:['토스']},_meta:{'com.semologo/idempotency-key':'00000000-0000-4000-8000-000000000001'}},{'idempotency-key':'00000000-0000-4000-8000-000000000002'});assert.equal((await r.json()).result.isError,true);
 fixture.setPrincipalKind('api_key');
 r=await modern('tools/call',{name:'prepare_logo_wall',arguments:{names:['토스','카카오']}});const prepared=(await r.json()).result.structuredContent;assert(/^[a-f0-9-]{36}$/.test(prepared.requestKey));
 r=await modern('tools/call',{name:'create_logo_wall',arguments:{names:['토스','카카오'],requestKey:prepared.requestKey}});data=(await r.json()).result;assert.equal(data.isError,false);assert.equal(data.structuredContent.created,true);const meter=fixture.meteredRequests.at(-1);assert.equal(meter.kind,'api_key');assert.equal(meter.key,prepared.requestKey);assert.equal(meter.args.requestKey,undefined,'operation key is stripped from catalogue/storage args');
 r=await modern('tools/call',{name:'create_logo_wall',arguments:{names:['토스']}});assert.equal((await r.json()).result.content[0].text,'api_idempotency_required');
 r=await modern('tools/call',{name:'create_logo_wall',arguments:{names:['토스'],requestKey:'too-short'}});assert.equal((await r.json()).error.code,-32602);
 r=await modern('tools/call',{name:'create_logo_wall',arguments:{names:['토스'],requestKey:prepared.requestKey},_meta:{'com.semologo/idempotency-key':'00000000-0000-4000-8000-000000000009'}});assert.equal((await r.json()).error.code,-32602);
 r=await modern('tools/call',{name:'create_logo_wall',arguments:{names:['토스'],requestKey:prepared.requestKey}},{'idempotency-key':'00000000-0000-4000-8000-000000000009'});assert.equal((await r.json()).result.content[0].text,'idempotency_key_mismatch');
 fixture.setPrincipalKind('pilot');
 console.log('PASS: legacy envelope/initialize guards; JSON/Accept/origin checks; modern discovery/list/call; header/body version/method/name binding; Base64 name; unknown methods; idempotency metadata; API-key prepare→requestKey→create without custom metadata/headers');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={main};
