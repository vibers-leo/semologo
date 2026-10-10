const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/login-browser.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out,URL});
const {loginBrowser,safeLoginNext,externalLoginUrl,androidBrowserIntent}=out;
for(const ua of ['Mozilla/5.0 (iPhone) AppleWebKit/605.1 NAVER(inapp; search;)','Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36','Mozilla/5.0 (iPhone) AppleWebKit/605.1 KAKAOTALK','Mozilla/5.0 (iPhone) AppleWebKit/605.1 Instagram','Mozilla/5.0 (iPhone) AppleWebKit/605.1'])assert(loginBrowser(ua).embedded,ua);
for(const ua of ['Mozilla/5.0 (iPhone) AppleWebKit/605.1 Version/18 Safari/604.1','Mozilla/5.0 (iPhone) AppleWebKit/605.1 CriOS/130 Mobile','Mozilla/5.0 (Linux; Android 14) Chrome/130 Safari/537.36','Mozilla/5.0 Chrome/130 Safari/537.36'])assert(!loginBrowser(ua).embedded,ua);
for(const next of ['https://evil.test','//evil.test','/\\evil.test','/\n/evil.test',null])assert.equal(safeLoginNext(next),'/');
assert.equal(safeLoginNext('/mypage/?tab=logos'),'/mypage/?tab=logos');
const url=externalLoginUrl('https://semologo.com/en/login/?next=%2Fen%2Fmypage%2F&code=secret&access_token=secret#secret');assert.equal(url,'https://semologo.com/en/login/?next=%2Fen%2Fmypage%2F');assert(!androidBrowserIntent(url).includes('package='));assert(androidBrowserIntent(url).includes('S.browser_fallback_url='));
console.log('PASS embedded-browser detection, Safari/Chrome exclusions, safe return paths, token-free external URL and default browser intent');
