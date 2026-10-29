const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const env={SEMOLOGO_PILOT_GRANTS_ENABLED:'1'};let enabled=true,admin=true,calls=0;
function load(file,dependencies){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},Request,Response,Buffer,Error,require:n=>dependencies[n]});return exports;}
const reader=load('src/lib/logo-wall-request.ts',{});
const route=load('src/app/api/admin/developer-pilot/self/route.ts',{
 '@/lib/developer-api-auth':{developerApiEnabled:()=>enabled},
 '@/lib/traffic-db':{trafficAdmin:async()=>admin},
 '@/lib/logo-owner':{logoOwner:async()=> 'fixture-operator'},
 '@/lib/logo-wall-request':reader,
 '@/lib/developer-api-pilot':{developerPilotStatus:async()=>({readOnly:true}),provisionDeveloperPilot:async()=>{calls++;return{created:true}}}
});
const request=(body,contentType='application/json')=>new Request('https://fixture.invalid/api/admin/developer-pilot/self',{method:'POST',headers:{'content-type':contentType},body});
(async()=>{
 assert.equal((await route.GET(new Request('https://fixture.invalid'))).status,200);assert.equal(calls,0);
 assert.equal((await route.POST(request('{}'))).status,200);assert.equal(calls,1);
 for(const body of ['{"owner":"other"}','{"units":100000}','[]','null','invalid'])assert.equal((await route.POST(request(body))).status,400);
 assert.equal((await route.POST(request('{}','text/plain'))).status,415);
 assert.equal((await route.POST(request(' '.repeat(1025)))).status,413);
 admin=false;assert.equal((await route.POST(request('{}'))).status,403);admin=true;
 enabled=false;assert.equal((await route.POST(request('{}'))).status,503);enabled=true;
 env.SEMOLOGO_PILOT_GRANTS_ENABLED='0';assert.equal((await route.POST(request('{}'))).status,503);
 assert.equal(calls,1);console.log(JSON.stringify({status:'PASS',cases:12,productionWrites:0}));
})().catch(()=>{console.error('pilot_route_checks_failed');process.exitCode=1});
