import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSemologoDomains,firstPartyUrl,parseLogoSignals} from './semologo-domain-discover.mjs';
import {validateRequest} from './core.mjs';
import {validateResult} from './artifacts.mjs';

test('domain batch is scoped and result remains review-only',async()=>{
 const principal={role:'operator',tenant:'internal',projects:['semologo']};
 const projects={semologo:{jobs:{'semologo-domain-discover':{owner:'win-01',owners:['win-01','win-02']}}}};
 const commit='a'.repeat(40), input={domains:['example.com','example.org']};
 const request=validateRequest({project:'semologo',kind:'semologo-domain-discover',requestKey:'domain-pilot-0001',commit,input,workerId:'win-01'},principal,projects);
 const job={id:'11111111-1111-1111-1111-111111111111',tenant:'internal',project:'semologo',kind:'semologo-domain-discover',commit_sha:commit,input};
 const result=await discoverSemologoDomains(job,{},undefined,async domain=>({domain,status:'candidate_review_required',pageUrl:`https://${domain}/`,name:domain,logoCandidates:[`https://${domain}/logo.svg`]}));
 assert.equal(result.reviewStatus,'PENDING');assert.equal(result.results.length,2);
 assert.doesNotThrow(()=>validateResult(job,result));
 assert.equal(request.owner,'win-01');
 result.results[1].logoCandidates=['https://internal.example.net/private.svg'];
 assert.throws(()=>validateResult(job,result),/Invalid candidate URL/);
});

test('malformed, duplicate and internal domains cannot enter a batch',()=>{
 const p={role:'operator',tenant:'internal',projects:['semologo']};
 const projects={semologo:{jobs:{'semologo-domain-discover':{owner:'win-01'}}}};
 const base={project:'semologo',kind:'semologo-domain-discover',requestKey:'domain-pilot-0002',commit:'a'.repeat(40)};
 for(const domains of [['localhost'],['10.0.0.1'],['example.com','example.com'],['example.com/path']])
  assert.throws(()=>validateRequest({...base,input:{domains}},p,projects),/Invalid domain batch/);
});

test('HTML logo signal parser keeps first-party HTTPS only',()=>{
 const html='<title>Example</title><meta property="og:logo" content="https://example.com/logo.svg"><img alt="logo" src="https://other.example/logo.svg">';
 const result=parseLogoSignals(html,'https://example.com/','example.com');
 assert.deepEqual(result.logoCandidates,['https://example.com/logo.svg']);
 assert.equal(firstPartyUrl('http://example.com/a','https://example.com/','example.com'),null);
});
