const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = fs.readFileSync('src/app/api/logo-requests/route.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const rows = new Map();
let transaction = null, released = 0, rate = 0, failure = false, published = null;
const client = {
  release() { released++; },
  async query(sql, args = []) {
    if (sql === 'BEGIN') { assert.equal(transaction, null); transaction = { timeout: false }; return { rows: [] }; }
    if (sql.startsWith('SET LOCAL statement_timeout')) { assert(transaction); transaction.timeout = true; return { rows: [] }; }
    if (sql === 'ROLLBACK' || sql === 'COMMIT') { transaction = null; return { rows: [] }; }
    assert(transaction?.timeout, 'set the database timeout inside the transaction before request queries');
    if (sql.includes('SELECT count(*)')) return { rows: [{ n: rate }] };
    if (sql.includes('SELECT id FROM semologo.logo_posts')) return { rows: published ? [{ id: published }] : [] };
    if (sql.includes('INSERT INTO semologo.logo_request_queue')) {
      if (failure) throw Object.assign(new Error('simulated storage failure'), { code: 'XX000' });
      assert.equal(args.length, 8);
      const row = rows.get(args[1]) || { id: args[0], request_count: 0 };
      row.request_count++; row.message = args[2]; row.requested_name = args[3];
      row.official_url = args[4]; row.status = args[6]; row.published_brand_id = args[7];
      rows.set(args[1], row); return { rows: [row] };
    }
    throw new Error('Unexpected query');
  },
};
class Pool {
  constructor(options) {
    assert.equal(options.statement_timeout, undefined, 'PgBouncer rejects statement_timeout as a startup option (08P01)');
    assert.equal(options.query_timeout, 5000);
  }
  async connect() { return client; }
}
const exportsForRoute = {};
vm.runInNewContext(code, {
  exports: exportsForRoute,
  require(name) {
    if (name === 'pg') return { Pool };
    if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    return require(name);
  },
  process: { env: { DB_VIBERS_MAIN_URL: 'test-only' } },
  Buffer, URL, AbortSignal, fetch, console: { error() {} },
}, { filename: 'logo-requests/route.ts' });
const post = message => exportsForRoute.POST(new Request('https://example.test/api/logo-requests/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
}));
(async () => {
  let response = await post('주식회사계발자들 로고 찾아줘');
  assert.equal(response.status, 201); const first = await response.json(); assert.equal(first.status, 'pending');
  assert.equal([...rows.values()][0].requested_name, '주식회사계발자들');
  response = await post('주식회사계발자들   로고 찾아줘');
  assert.equal(response.status, 201); assert.equal((await response.json()).id, first.id);
  assert.equal(rows.size, 1); assert.equal([...rows.values()][0].request_count, 2);
  published = 'existing-brand'; response = await post('이미있는브랜드 로고');
  assert.equal(response.status, 201); assert.equal((await response.json()).brandId, 'existing-brand'); published = null;
  const before = rows.size;
  rate = 5; assert.equal((await post('다른브랜드 로고')).status, 429); rate = 0;
  assert.equal(rows.size, before); assert.equal(transaction, null);
  assert.equal((await post('a')).status, 400);
  failure = true; response = await post('저장실패브랜드 로고'); assert.equal(response.status, 503);
  assert(!(await response.text()).includes('simulated storage failure'));
  assert.equal(transaction, null); assert.equal(rows.size, before); assert.equal(released, 5);
  assert.equal((await exportsForRoute.GET(new Request('https://example.test/api/logo-requests/'))).status, 403);
  console.log('PASS: PgBouncer-compatible startup, transaction-local timeout, normalized request, deduplication, existing brand, rate limit, validation, rollback/release and admin access');
})().catch(error => { console.error(error); process.exitCode = 1; });
