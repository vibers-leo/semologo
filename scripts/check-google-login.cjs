const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
function load({ native = false, domain = 'ai-recipe-lab.firebaseapp.com', popupError } = {}) {
  const calls = [];
  const auth = { config: { authDomain: domain } };
  const mocks = {
    '@capacitor/core': {
      Capacitor: { getPlatform: () => native ? 'ios' : 'web', isPluginAvailable: () => native },
      registerPlugin: () => ({ signIn: async () => { calls.push('native'); return { idToken: 'test-only-token' }; } }),
    },
    'firebase/auth': {
      GoogleAuthProvider: { credential: token => ({ token }) },
      signInWithCredential: async (a, credential) => { assert.equal(a, auth); assert.equal(credential.token, 'test-only-token'); calls.push('credential'); },
      signInWithPopup: async () => { calls.push('popup'); if (popupError) throw popupError; },
      signInWithRedirect: async () => { calls.push('redirect'); },
    },
    './firebase': { getClientAuth: () => auth, googleProvider: {} },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/google-login.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => { assert(name in mocks); return mocks[name]; }, window: { location: { host: 'semologo.com' } } });
  return { ...exports, calls };
}
(async () => {
  let subject = load({ native: true });
  await subject.startGoogleLogin();
  assert.deepEqual(subject.calls, ['native', 'credential']);
  subject = load(); await subject.startGoogleLogin(); assert.deepEqual(subject.calls, ['popup']);
  const blocked = { code: 'auth/popup-blocked' };
  subject = load({ popupError: blocked });
  await assert.rejects(subject.startGoogleLogin(), error => error === blocked);
  assert.deepEqual(subject.calls, ['popup']); // Never use broken cross-site redirect fallback.
  subject = load({ domain: 'semologo.com', popupError: blocked });
  await subject.startGoogleLogin(); assert.deepEqual(subject.calls, ['popup', 'redirect']);
  subject = load({ domain: 'semologo.com', popupError: { code: 'auth/popup-closed-by-user' } });
  await assert.rejects(subject.startGoogleLogin()); assert.deepEqual(subject.calls, ['popup']);
  const proxyExports = {};
  const next = {
    NextResponse: class {
      constructor(_body, { status, headers }) { this.kind = 'response'; this.status = status; this.headers = new Headers(headers); }
      static redirect(url, status) { return { kind: 'redirect', url: url.href, status }; }
      static next() { return { kind: 'next' }; }
    },
  };
  const proxyFetch = [];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/proxy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: proxyExports, require: () => next, URL, Headers, AbortSignal, fetch: async (url, options) => { proxyFetch.push({url:url.href,options}); return new Response('helper', {headers:{'Cache-Control':'max-age=1800','Content-Encoding':'gzip','Content-Length':'999'}}); } });
  function request(path) {
    const url = new URL(path, 'https://semologo.com');
    url.clone = () => new URL(url.href);
    return { nextUrl: url, url: url.href, method: 'GET' };
  }
  let response = await proxyExports.proxy(request('/__/auth/handler?eventId=test'));
  assert.equal(proxyFetch[0].url, 'https://ai-recipe-lab.firebaseapp.com/__/auth/handler?eventId=test');
  assert.equal(proxyFetch[0].options.headers, undefined);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(proxyExports.proxy(request('/login?next=%2Fmypage%2F')).url, 'https://semologo.com/login/?next=%2Fmypage%2F');
  assert.equal(proxyExports.proxy(request('/semologo.png')).kind, 'next');
  assert.equal(proxyExports.proxy(request('/semologo.png/')).url, 'https://semologo.com/semologo.png');
  assert.equal(proxyExports.proxy(request('/.well-known/assetlinks.json')).kind, 'next');
  console.log('PASS native credential exchange, web popup, same-origin redirect guard, cancellation, exact auth proxy and normal URL handling');
})().catch(error => { console.error(error); process.exitCode = 1; });
