const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, URL, Response, ...globals }, { filename: file });
  return exports;
}
const empty = { schema: 1, algo_v: 1, id: 'youth-startup-academy', primary: '', variants: [], quarantined_variants: [{ files: { svg: 'wrong-kosme.svg' } }] };
const valid = { ...empty, id: 'valid-brand', variants: [{ files: { svg: 'official.svg' } }] };
let current = empty, unavailable = false, fallbackCalls = 0;
const db = { async query(sql, values) {
  assert(sql.startsWith('SELECT '), 'read-only lookup only');
  assert.equal(values.length, 1);
  if (unavailable) throw new Error('database offline');
  return { rows: current === undefined ? [] : [{ manifest: current }] };
} };
const fallback = async () => { fallbackCalls++; return valid; };
const route = load('src/app/api/logo-variants/route.ts', {
  '@/lib/brands': { fetchVariants: fallback }, '@/lib/traffic-db': { trafficDb: () => db },
});
const wall = load('src/lib/logo-wall-manifest.ts', { './brands': { fetchVariants: fallback } });
const get = id => route.GET(new Request(`https://example.test/api/logo-variants/?id=${id}`));
(async () => {
  let response = await get(empty.id);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), empty);
  assert.equal(fallbackCalls, 0, 'empty CMS must not restore quarantined bundled files');
  assert.deepEqual(await wall.currentWallManifest(empty.id, db), empty);
  assert.equal(fallbackCalls, 0, 'logo-wall selection must honor the same exclusion');
  current = valid;
  assert.deepEqual(await (await get(valid.id)).json(), valid);
  for (const absent of [undefined, null, {}]) {
    current = absent;
    assert.deepEqual(await (await get('missing')).json(), valid);
    assert.deepEqual(await wall.currentWallManifest('missing', db), valid);
  }
  unavailable = true;
  assert.deepEqual(await (await get('offline')).json(), valid);
  assert.equal((await get('../bad')).status, 400);
  let fetchCalls = 0, clientOffline = false;
  const client = load('src/lib/client-variants.ts', {}, { fetch: async () => {
    fetchCalls++;
    if (clientOffline) throw new Error("network offline");
    return route.GET(new Request(`https://example.test/api/logo-variants/?id=${empty.id}`));
  } });
  current = empty; unavailable = false;
  assert.deepEqual(await client.fetchVariants(empty.id), empty);
  assert.deepEqual(client.cachedVariants(empty.id), empty);
  assert.deepEqual(await client.fetchVariants(empty.id), empty);
  assert.equal(fetchCalls, 1, 'client keeps empty authoritative result on repeat opens');
  clientOffline = true;
  await Promise.all(Array.from({ length: 101 }, (_, i) => client.fetchVariants(`offline-${i}`)));
  assert.deepEqual(await client.fetchVariants(empty.id), empty, 'network failure preserves cached exclusions');
  const brands = load('src/lib/brands.ts', {
    './cdn': { CDN: 'https://example.test', VERSION: 'test', looksLikeHtml: () => false },
    './brand-data': {},
    './reviewed-logo-assets': { reviewedVariants: {}, reviewedCatalogSeeds: [] },
    './logo-quality-review': { applyQualityReview: x => x },
  }, { fetch: async () => Response.json(empty), process: { env: {} } });
  assert.deepEqual(await brands.fetchVariants(empty.id), empty, 'CDN empty manifests must remain distinct from unavailable manifests');
  console.log('PASS quarantined variants: actual API, logo-wall helper, client cache, CDN empty, missing manifests and DB outage fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
