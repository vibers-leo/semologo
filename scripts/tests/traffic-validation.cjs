const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync('src/lib/traffic-validation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('exports','module',source)(m.exports,m);
const normalize=m.exports.normalizeTraffic; const base={session_id:'12345678-1234-1234-1234-123456789012',event:'search_submitted',path:'/foo?token=secret',attribution:{referrer:'https://example.com/path?email=private',landing_path:'/search?token=secret',utm_campaign:'c'},params:{search_term:'Samsung',result_count:20,email:'private'}};
assert.equal(normalize({...base,session_id:'-'.repeat(36)}),null);assert.equal(normalize({...base,event:'unknown'}),null);assert.equal(normalize({...base,session_id:'fake'}),null);
const n=normalize(base);assert.equal(n.path,'/foo');assert.equal(n.attribution.referrer,'example.com');assert.equal(n.attribution.landing_path,'/search');assert.equal(n.params.email,undefined);assert.equal(n.params.result_count,20);assert.equal(normalize({...base,params:{result_count:NaN}}).params.result_count,null);
assert.equal(normalize({...base,params:{search_term:'x'.repeat(1000)}}).params.search_term.length,120);
console.log('PASS traffic validation: event/session whitelist, sensitive query stripping, bounded search, numeric validation');
