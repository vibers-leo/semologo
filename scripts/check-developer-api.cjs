#!/usr/bin/env node
/* Explicit isolated PostgreSQL integration. No production migration or payment. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ts = require('typescript');

async function isolatedPg(payload) {
  const { Pool } = require('pg');
  const vm = require('node:vm');
  const assert = require('node:assert/strict');
  const crypto = require('node:crypto');
  const schema = payload.schema;
  if (!/^semologo_api_test_20261029_[a-f0-9]{16}$/.test(schema)) throw Error('invalid_test_schema');
  const quoted = '"' + schema + '"';
  const prefix = 'isolated-' + schema + '-';
  const pool = new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 3, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  const checks = [];
  let phase = 'connect', failure = null, created = false, cleaned = false, rewrittenQueries = 0;
  let fault = null;
  const fixtureEnv = { SEMOLOGO_DEVELOPER_API_ENABLED: '1', SEMOLOGO_API_KEY_PEPPER: 'test-only-pepper-' + '0'.repeat(32) };
  const rewrite = sql => {
    assert.equal(typeof sql, 'string', 'only explicit SQL text is allowed');
    const result = sql.replace(/\bsemologo\./g, quoted + '.');
    assert(!/\bsemologo\./.test(result), 'production schema is forbidden');
    assert(!/\b(?:public|auth|firebase|fleet)\./i.test(result), 'unrelated schema is forbidden');
    rewrittenQueries++;
    return result;
  };
  const adapter = async (client, sql, args) => {
    const rewritten = rewrite(sql);
    if (fault && fault.test(sql)) { fault = null; throw Error('fixture_database_failure'); }
    return client.query(rewritten, args);
  };
  const traffic = {
    query(sql, args) { return adapter(pool, sql, args); },
    async connect() {
      const client = await pool.connect();
      return { query: (sql, args) => adapter(client, sql, args), release: () => client.release() };
    },
  };
  const verifiedLogin = async request => {
    const value = request.headers.get('authorization');
    if (value === 'Bearer fixture-login-alice') return prefix + 'alice';
    if (value === 'Bearer fixture-login-bob') return prefix + 'bob';
    return null;
  };
  function load(code) {
    const exports = {};
    vm.runInNewContext(code, {
      exports, Buffer, Request, Response, URL, Error, TypeError, process: { env: fixtureEnv },
      require(name) {
        if (name === 'node:crypto') return crypto;
        if (name === './logo-owner') return { logoOwner: verifiedLogin };
        if (name === './traffic-db') return { trafficDb: () => traffic, trafficAdmin: async request => request.headers.get('authorization') === 'Bearer fixture-login-alice' };
        throw Error('unexpected_dependency');
      },
    }, { filename: 'isolated-developer-module.cjs', timeout: 1000 });
    return exports;
  }
  const request = (token, key) => new Request('https://isolated.invalid/api/mcp', { headers: {
    Authorization: 'Bearer ' + token,
    ...(key ? { 'Idempotency-Key': key } : {}),
  } });
  const idempotency = () => 'integration-' + crypto.randomUUID();
  async function check(name, fn) {
    phase = name;
    await fn();
    checks.push({ name, passed: true });
  }
  async function rejectsCode(fn, code) {
    let error;
    try { await fn(); } catch (caught) { error = caught; }
    assert(error && error.message === code, 'expected intentional public error code');
  }
  const read = async (sql, args = []) => pool.query(rewrite(sql), args);
  const count = async (table, owner) => Number((await read('SELECT count(*)::int n FROM semologo.' + table + ' WHERE owner_id=$1', [owner])).rows[0].n);
  const balance = async grant => {
    const r = await read('SELECT used_units,reserved_units FROM semologo.api_usage_balances WHERE entitlement_id=$1', [grant]);
    return r.rowCount ? { used: Number(r.rows[0].used_units), reserved: Number(r.rows[0].reserved_units) } : { used: 0, reserved: 0 };
  };
  async function grant(owner, metric, limit, options = {}) {
    const id = crypto.randomUUID();
    await read(`INSERT INTO semologo.api_entitlements(id,owner_id,metric,plan_reference,period_start,period_end,hard_limit,state)
      VALUES($1,$2,$3,'isolated-test-not-a-paid-plan',now()+$4::interval,now()+$5::interval,$6,$7)`,
    [id, owner, metric, options.start || '-1 day', options.end || '30 days', limit, options.state || 'active']);
    return id;
  }
  async function fixturePrincipal(auth, suffix, scopes = ['walls:read', 'walls:write', 'collection:request']) {
    const owner = prefix + suffix;
    const issued = await auth.issueDeveloperKey(owner, { name: 'isolated fixture', scopes });
    const principal = await auth.resolveMcpPrincipal(request(issued.token));
    assert(principal && principal.owner === owner, 'fixture key resolves only to its owner');
    return { owner, issued, principal };
  }
  try {
    phase = 'create_test_schema';
    await pool.query('CREATE SCHEMA ' + quoted);
    created = true;
    console.log(JSON.stringify({ stage: 'isolated_schema_created', schema, production_tables_touched: false }));
    phase = 'apply_ddl_to_test_schema_only';
    await pool.query(rewrite(payload.ddl));
    const auth = load(payload.auth);
    const usage = load(payload.usage);
    const pilot = load(payload.pilot);
    await check('private_pilot_only_allows_verified_admin_login', async () => {
      fixtureEnv.SEMOLOGO_DEVELOPER_PILOT_ONLY='1';
      assert.equal(await auth.developerLoginOwner(request('fixture-login-alice')),prefix+'alice');
      await rejectsCode(()=>auth.developerLoginOwner(request('fixture-login-bob')),'pilot_invite_required');
      assert.equal(await auth.developerLoginOwner(request('slk_fixture')),null);
      delete fixtureEnv.SEMOLOGO_DEVELOPER_PILOT_ONLY;
    });
    await check('pilot_concurrent_grants_are_exactly_once_and_get_is_read_only',async()=>{
      const owner=prefix+'pilot-once';
      assert.equal((await pilot.developerPilotStatus(owner)).pilot.provisioned,false);
      assert.equal(await count('api_entitlements',owner),0);
      const results=await Promise.all([pilot.provisionDeveloperPilot(owner),pilot.provisionDeveloperPilot(owner)]);
      assert.equal(results.filter(x=>x.created).length,1);
      assert.equal(await count('api_entitlements',owner),6);
      for(const g of results[0].grants){assert.equal(Number(g.hard_limit),25);assert.equal(Number(g.remaining_units),25);}
      await read('UPDATE semologo.api_usage_balances SET used_units=3 WHERE entitlement_id=$1',[results[0].grants[0].id]);
      const repeat=await pilot.provisionDeveloperPilot(owner);
      assert.equal(repeat.created,false);assert.equal(Number(repeat.grants[0].used_units),3);
      await read("UPDATE semologo.api_entitlements SET state='suspended' WHERE owner_id=$1",[owner]);
      assert((await pilot.provisionDeveloperPilot(owner)).grants.every(g=>g.state==='suspended'));
      await read("UPDATE semologo.api_entitlements SET period_start=now()-interval '8 days',period_end=now()-interval '1 day' WHERE owner_id=$1",[owner]);
      assert.equal((await pilot.provisionDeveloperPilot(owner)).created,false);
    });
    await check('pilot_future_overlap_and_partial_configuration_fail_closed',async()=>{
      const owner=prefix+'pilot-overlap';
      await grant(owner,'wall_plan',5,{start:'1 day',end:'2 days'});
      await rejectsCode(()=>pilot.provisionDeveloperPilot(owner),'pilot_allowance_conflict');
      assert.equal(await count('api_entitlements',owner),1);
      const partial=prefix+'pilot-partial';
      const result=await pilot.provisionDeveloperPilot(partial);
      await read('DELETE FROM semologo.api_usage_balances WHERE entitlement_id=$1',[result.grants[0].id]);
      await read('DELETE FROM semologo.api_entitlements WHERE id=$1',[result.grants[0].id]);
      await rejectsCode(()=>pilot.provisionDeveloperPilot(partial),'pilot_configuration_conflict');
      assert.equal(await count('api_entitlements',partial),5);
    });
    await check('pilot_failed_insert_rolls_back_all_allowances',async()=>{
      const owner=prefix+'pilot-rollback';
      fault={test:sql=>sql.includes('INSERT INTO semologo.api_usage_balances')};
      await rejectsCode(()=>pilot.provisionDeveloperPilot(owner),'fixture_database_failure');
      assert.equal(await count('api_entitlements',owner),0);
    });
    let alice, bob;
    await check('login_verification_stub_and_api_key_management_boundary', async () => {
      assert.equal(await auth.developerLoginOwner(request('fixture-login-alice')), prefix + 'alice');
      assert.equal(await auth.developerLoginOwner(request('unknown-login')), null);
      fixtureEnv.SEMOLOGO_DEVELOPER_API_ENABLED = '0';
      assert.equal(await auth.developerLoginOwner(request('fixture-login-alice')), null);
      fixtureEnv.SEMOLOGO_DEVELOPER_API_ENABLED = '1';
    });
    await check('jwt_pilot_requires_explicit_flag_and_exact_verified_owner_allowlist', async () => {
      const login=request('fixture-login-alice');
      fixtureEnv.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED='0';
      fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS=prefix+'alice';
      assert.equal(await auth.resolveMcpPrincipal(login),null);
      fixtureEnv.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED='1';
      fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS='';
      assert.equal(await auth.resolveMcpPrincipal(login),null);
      fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS='other-'+prefix+'alice';
      assert.equal(await auth.resolveMcpPrincipal(login),null,'owner substrings cannot grant free pilot access');
      fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS=' '+prefix+'alice , '+prefix+'unverified ';
      const principal=await auth.resolveMcpPrincipal(login);
      assert.equal(principal.owner,prefix+'alice');assert.equal(principal.kind,'pilot');
      assert.equal(await auth.resolveMcpPrincipal(request('fixture-login-bob')),null);
      assert.equal(await auth.resolveMcpPrincipal(request('unverified')),null,'allowlist does not replace login-provider verification');
      fixtureEnv.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED='0';fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS='';
    });
    await check('issued_key_hmac_and_one_time_secret_not_stored', async () => {
      alice = await fixturePrincipal(auth, 'alice');
      bob = await fixturePrincipal(auth, 'bob');
      assert(/^slk_[A-Za-z0-9_-]{43}$/.test(alice.issued.token), 'opaque 32-byte key format');
      const row = (await read('SELECT key_hash,key_prefix,scopes FROM semologo.api_keys WHERE id=$1', [alice.issued.key.id])).rows[0];
      assert.equal(row.key_hash, crypto.createHmac('sha256', fixtureEnv.SEMOLOGO_API_KEY_PEPPER).update(alice.issued.token).digest('hex'));
      assert(row.key_prefix === alice.issued.token.slice(0, 12) && row.key_prefix !== alice.issued.token, 'only a nonsecret prefix is persisted');
      assert(!JSON.stringify(row).includes(alice.issued.token), 'raw key is absent from its database record');
      assert.equal(await auth.developerLoginOwner(request(alice.issued.token)), null);
      assert.equal(await auth.resolveMcpPrincipal(request('slk_invalid')), null);
    });
    await check('invalid_key_request_cannot_insert', async () => {
      const before = await count('api_keys', alice.owner);
      await rejectsCode(() => auth.issueDeveloperKey(alice.owner, { name: 'test', scopes: ['unknown:scope'] }), 'invalid_key_request');
      await rejectsCode(() => auth.issueDeveloperKey(alice.owner, { name: 'test', scopes: ['walls:read'], owner: bob.owner }), 'invalid_key_request');
      assert.equal(await count('api_keys', alice.owner), before);
    });
    await check('real_postgres_insert_rolls_back_on_commit_failure', async () => {
      const owner = prefix + 'rollback-key';
      fault = { test: sql => sql === 'COMMIT' };
      await rejectsCode(() => auth.issueDeveloperKey(owner, { name: 'must rollback' }), 'fixture_database_failure');
      assert.equal(await count('api_keys', owner), 0);
    });
    await check('key_limit_is_atomic_under_two_concurrent_issuances', async () => {
      const owner = prefix + 'key-limit';
      for (let i = 0; i < 4; i++) await auth.issueDeveloperKey(owner, { name: 'fixture ' + i });
      const results = await Promise.allSettled([auth.issueDeveloperKey(owner, { name: 'one' }), auth.issueDeveloperKey(owner, { name: 'two' })]);
      assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
      assert(results.some(x => x.status === 'rejected' && x.reason.message === 'api_key_limit'), 'the loser receives the key limit');
      assert.equal(await count('api_keys', owner), 5);
    });
    await check('expired_revoked_and_disabled_keys_fail_closed', async () => {
      const expired = await fixturePrincipal(auth, 'expired');
      await read("UPDATE semologo.api_keys SET created_at=now()-interval '2 days',expires_at=now()-interval '1 second' WHERE id=$1", [expired.issued.key.id]);
      assert.equal(await auth.resolveMcpPrincipal(request(expired.issued.token)), null);
      const revoked = await fixturePrincipal(auth, 'revoked');
      await read('UPDATE semologo.api_keys SET revoked_at=now() WHERE id=$1', [revoked.issued.key.id]);
      assert.equal(await auth.resolveMcpPrincipal(request(revoked.issued.token)), null);
      fixtureEnv.SEMOLOGO_DEVELOPER_API_ENABLED = '0';
      assert.equal(await auth.resolveMcpPrincipal(request(alice.issued.token)), null);
      fixtureEnv.SEMOLOGO_DEVELOPER_API_ENABLED = '1';
    });
    await check('only_explicitly_allowlisted_verified_pilot_bypasses_new_ledger', async () => {
      fixtureEnv.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED='1';fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS=prefix+'alice';
      const pilot=await auth.resolveMcpPrincipal(request('fixture-login-alice'));assert.equal(pilot.kind,'pilot');
      const before=await count('api_usage_events',pilot.owner);
      assert.equal(await usage.meteredMcpTool(pilot,'create_logo_wall',{},request('fixture-login-alice'),async()=>'pilot-result'),'pilot-result');
      assert.equal(await count('api_usage_events',pilot.owner),before);
      fixtureEnv.SEMOLOGO_MCP_LOGIN_PILOT_ENABLED='0';fixtureEnv.SEMOLOGO_MCP_PILOT_OWNER_IDS='';
    });
    await check('write_requires_scope_and_idempotency_before_callback', async () => {
      let calls = 0;
      const fn = async () => { calls++; return {}; };
      await rejectsCode(() => usage.meteredMcpTool(alice.principal, 'create_logo_wall', {}, request(alice.issued.token), fn), 'api_idempotency_required');
      const readonly = await fixturePrincipal(auth, 'readonly', ['walls:read']);
      await rejectsCode(() => usage.meteredMcpTool(readonly.principal, 'create_logo_wall', {}, request(readonly.issued.token, idempotency()), fn), 'api_scope_denied');
      await rejectsCode(() => usage.meteredMcpTool(alice.principal, 'create_logo_wall', {}, request(alice.issued.token, 'short'), fn), 'api_idempotency_conflict');
      assert.equal(calls, 0);
    });
    await check('missing_expired_suspended_and_ambiguous_grants_do_not_run', async () => {
      let calls = 0;
      const fn = async () => { calls++; return {}; };
      for (const [suffix, opts] of [['missing', null], ['past', { start: '-2 days', end: '-1 day' }], ['suspended', { state: 'suspended' }]]) {
        const x = await fixturePrincipal(auth, 'grant-' + suffix);
        if (opts) await grant(x.owner, 'wall_create', 1, opts);
        await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, idempotency()), fn), 'api_entitlement_required');
      }
      const x = await fixturePrincipal(auth, 'overlap');
      await grant(x.owner, 'wall_create', 1);
      await grant(x.owner, 'wall_create', 1, { start: '-2 days' });
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, idempotency()), fn), 'api_usage_unavailable');
      assert.equal(calls, 0);
    });
    await check('successful_write_canonical_replay_and_input_conflict', async () => {
      const g = await grant(alice.owner, 'wall_create', 5);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; return { created: true, wall: { id: 'fixture-wall-alice', version: 1 } }; };
      const first = await usage.meteredMcpTool(alice.principal, 'create_logo_wall', { names: ['fixture'], settings: { columns: 4, spacing: 'balanced' } }, request(alice.issued.token, key), fn);
      const replay = await usage.meteredMcpTool(alice.principal, 'create_logo_wall', { settings: { spacing: 'balanced', columns: 4 }, names: ['fixture'] }, request(alice.issued.token, key), fn);
      assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(replay)), 'PostgreSQL JSONB ordering does not change the replayed value');
      assert.equal(calls, 1);
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
      await rejectsCode(() => usage.meteredMcpTool(alice.principal, 'create_logo_wall', { names: ['changed'] }, request(alice.issued.token, key), fn), 'api_idempotency_conflict');
      const bg = await grant(bob.owner, 'wall_create', 1);
      const b = await usage.meteredMcpTool(bob.principal, 'create_logo_wall', { names: ['fixture'], settings: { columns: 4, spacing: 'balanced' } }, request(bob.issued.token, key), async () => ({ created: true, wall: { id: 'fixture-wall-bob' } }));
      assert(b.wall.id === 'fixture-wall-bob', 'the same key in another owner must not reveal Alice result');
      assert.deepEqual(await balance(bg), { used: 1, reserved: 0 });
    });
    await check('remaining_one_unit_has_exactly_one_parallel_winner', async () => {
      const x = await fixturePrincipal(auth, 'quota-race');
      const g = await grant(x.owner, 'wall_create', 1);
      let calls = 0;
      const fn = async () => { calls++; await new Promise(r => setTimeout(r, 40)); return { created: true, wall: { id: 'fixture-race' } }; };
      const results = await Promise.allSettled([usage.meteredMcpTool(x.principal, 'create_logo_wall', { n: 1 }, request(x.issued.token, idempotency()), fn), usage.meteredMcpTool(x.principal, 'create_logo_wall', { n: 2 }, request(x.issued.token, idempotency()), fn)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert(results.some(r => r.status === 'rejected' && r.reason.message === 'api_quota_exceeded'), 'parallel loser must not run the callback');
      assert.equal(calls, 1);
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
    });
    await check('same_inflight_idempotency_does_not_execute_twice', async () => {
      const x = await fixturePrincipal(auth, 'inflight');
      const g = await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let started, release;
      const began = new Promise(r => { started = r; });
      const blocked = new Promise(r => { release = r; });
      let calls = 0;
      const first = usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), async () => { calls++; started(); await blocked; return { created: true }; });
      await began;
      try { await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), async () => { calls++; return {}; }), 'api_request_in_progress'); }
      finally { release(); }
      await first;
      assert.equal(calls, 1);
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
    });
    await check('ambiguity_and_existing_business_replay_charge_zero', async () => {
      const x = await fixturePrincipal(auth, 'not-created');
      const g = await grant(x.owner, 'wall_create', 1);
      for (const value of [{ created: false }, { replayed: true }]) await usage.meteredMcpTool(x.principal, 'create_logo_wall', value, request(x.issued.token, idempotency()), async () => value);
      assert.deepEqual(await balance(g), { used: 0, reserved: 0 });
    });
    await check('known_validation_failure_voids_real_reservation', async () => {
      const x = await fixturePrincipal(auth, 'validation');
      const g = await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; throw Error('invalid_names'); };
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'invalid_names');
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'invalid_names');
      assert.equal(calls, 1);
      assert.deepEqual(await balance(g), { used: 0, reserved: 0 });
      const event = (await read('SELECT state,charged_units FROM semologo.api_usage_events WHERE owner_id=$1', [x.owner])).rows[0];
      assert.equal(event.state, 'voided'); assert.equal(event.charged_units, 0);
    });
    await check('unknown_write_failure_keeps_durable_indeterminate_reservation', async () => {
      const x = await fixturePrincipal(auth, 'uncertain');
      const g = await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; throw Error('fixture-uncertain-side-effect'); };
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'fixture-uncertain-side-effect');
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'api_request_indeterminate');
      assert.equal(calls, 1);
      assert.deepEqual(await balance(g), { used: 0, reserved: 1 });
      const event = (await read('SELECT state,charged_units FROM semologo.api_usage_events WHERE owner_id=$1', [x.owner])).rows[0];
      assert.equal(event.state, 'indeterminate'); assert.equal(event.charged_units, 0);
    });
    await check('settle_database_failure_rolls_back_and_blocks_uncertain_repeat', async () => {
      const x = await fixturePrincipal(auth, 'settle-failure');
      const g = await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let calls = 0;
      fault = { test: sql => sql.includes('UPDATE semologo.api_usage_events SET state=$3') };
      const fn = async () => { calls++; return { created: true, wall: { id: 'fixture-committed-business-result' } }; };
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'api_usage_unavailable');
      assert.deepEqual(await balance(g), { used: 0, reserved: 1 });
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn), 'api_request_in_progress');
      assert.equal(calls, 1);
    });
    await check('read_replay_does_not_store_base64_or_double_charge', async () => {
      const x = await fixturePrincipal(auth, 'read-cache');
      const g = await grant(x.owner, 'wall_preview', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; return { previewPngBase64: 'fixture-image-not-real-pixels'.repeat(10000), wallId: 'fixture-read-wall' }; };
      await usage.meteredMcpTool(x.principal, 'preview_logo_wall', { id: 'fixture-read-wall' }, request(x.issued.token, key), fn);
      await usage.meteredMcpTool(x.principal, 'preview_logo_wall', { id: 'fixture-read-wall' }, request(x.issued.token, key), fn);
      assert.equal(calls, 2, 'read replay re-renders without another quota unit');
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
      const event = (await read('SELECT result_json FROM semologo.api_usage_events WHERE owner_id=$1', [x.owner])).rows[0];
      assert.equal(event.result_json.kind, 'read');
      assert(/^[a-f0-9]{64}$/.test(event.result_json.fingerprint),'only a result fingerprint is stored');
      assert(!JSON.stringify(event).includes('fixture-image-not-real-pixels'), 'large preview bytes are never stored in the usage ledger');
      await rejectsCode(()=>usage.meteredMcpTool(x.principal,'preview_logo_wall',{id:'fixture-read-wall'},request(x.issued.token,key),fn),'api_result_not_replayable');
      assert.equal(calls,2,'a third request cannot rerender without a new quota operation');
      const state=(await read('SELECT read_replay_count FROM semologo.api_usage_events WHERE owner_id=$1',[x.owner])).rows[0];assert.equal(state.read_replay_count,1);
    });
    await check('actual_prepare_route_created_false_shape_consumes_one_read_operation',async()=>{
      const x=await fixturePrincipal(auth,'actual-plan-shape');const g=await grant(x.owner,'wall_plan',1);const key=idempotency(),args={names:['fixture']};let calls=0;
      const fn=async()=>{calls++;return {created:false,plan:{ready:true,items:[{brandId:'fixture'}]}}};
      const result=await usage.meteredMcpTool(x.principal,'prepare_logo_wall',args,request(x.issued.token,key),fn);
      assert.equal(result.created,false);assert.equal(result.plan.ready,true);assert.deepEqual(await balance(g),{used:1,reserved:0});
      await rejectsCode(()=>usage.meteredMcpTool(x.principal,'prepare_logo_wall',args,request(x.issued.token,idempotency()),fn),'api_quota_exceeded');assert.equal(calls,1);
      await usage.meteredMcpTool(x.principal,'prepare_logo_wall',args,request(x.issued.token,key),async()=>{calls++;throw Error('must-not-run-exact-plan-replay')});assert.equal(calls,1);assert.deepEqual(await balance(g),{used:1,reserved:0});
    });
    await check('small_read_replay_returns_exact_cached_value_without_callback',async()=>{
      const x=await fixturePrincipal(auth,'small-read-cache');const g=await grant(x.owner,'wall_read',1);const key=idempotency();let calls=0;
      const fn=async()=>{calls++;return {wall:{id:'fixture-small-wall',version:1,owner:x.owner}}};
      const first=await usage.meteredMcpTool(x.principal,'get_logo_wall',{id:'fixture-small-wall'},request(x.issued.token,key),fn);
      const second=await usage.meteredMcpTool(x.principal,'get_logo_wall',{id:'fixture-small-wall'},request(x.issued.token,key),async()=>{calls++;throw Error('must-not-run-cached-read')});
      assert.deepEqual(JSON.parse(JSON.stringify(second)),JSON.parse(JSON.stringify(first)));assert.equal(calls,1);assert.deepEqual(await balance(g),{used:1,reserved:0});
      const event=(await read('SELECT result_json,read_replay_count FROM semologo.api_usage_events WHERE owner_id=$1',[x.owner])).rows[0];assert.equal(event.result_json.kind,'value');assert.equal(event.read_replay_count,0);
    });
    await check('every_cached_small_read_rechecks_live_grant_and_key',async()=>{
      for(const [tool,metric]of [['prepare_logo_wall','wall_plan'],['get_logo_wall','wall_read'],['preview_logo_wall','wall_preview']]){
        const x=await fixturePrincipal(auth,'read-live-'+metric);const g=await grant(x.owner,metric,1);const key=idempotency();let calls=0;const fn=async()=>{calls++;return {version:1,wallId:'fixture-live-'+metric}};
        await usage.meteredMcpTool(x.principal,tool,{},request(x.issued.token,key),fn);
        const event=(await read('SELECT result_json FROM semologo.api_usage_events WHERE owner_id=$1',[x.owner])).rows[0];assert.equal(event.result_json.kind,'value');
        await read("UPDATE semologo.api_entitlements SET state='suspended' WHERE id=$1",[g]);
        await rejectsCode(()=>usage.meteredMcpTool(x.principal,tool,{},request(x.issued.token,key),fn),'api_entitlement_required');
        await read("UPDATE semologo.api_entitlements SET state='active',period_end=now()-interval '1 second' WHERE id=$1",[g]);
        await rejectsCode(()=>usage.meteredMcpTool(x.principal,tool,{},request(x.issued.token,key),fn),'api_entitlement_required');
        await read("UPDATE semologo.api_entitlements SET period_end=now()+interval '30 days' WHERE id=$1",[g]);
        await read('UPDATE semologo.api_keys SET revoked_at=now() WHERE id=$1',[x.issued.key.id]);
        await rejectsCode(()=>usage.meteredMcpTool(x.principal,tool,{},request(x.issued.token,key),fn),'api_scope_denied');
        assert.equal(calls,1);assert.deepEqual(await balance(g),{used:1,reserved:0});
      }
    });
    await check('cached_read_result_isolated_between_owners_using_same_request_key',async()=>{
      const a=await fixturePrincipal(auth,'cache-owner-a'),b=await fixturePrincipal(auth,'cache-owner-b');await grant(a.owner,'wall_read',1);await grant(b.owner,'wall_read',1);const key=idempotency();const args={id:'same-request-argument'};
      const first=await usage.meteredMcpTool(a.principal,'get_logo_wall',args,request(a.issued.token,key),async()=>({privateOwner:a.owner}));
      const second=await usage.meteredMcpTool(b.principal,'get_logo_wall',args,request(b.issued.token,key),async()=>({privateOwner:b.owner}));
      assert.equal(first.privateOwner,a.owner);assert.equal(second.privateOwner,b.owner);assert.notEqual(second.privateOwner,first.privateOwner);
    });
    await check('preview_changed_wall_version_is_not_returned_as_a_free_replay',async()=>{
      const x=await fixturePrincipal(auth,'changed-preview');const g=await grant(x.owner,'wall_preview',2);const key=idempotency();let calls=0,version=1;const args={id:'fixture-changing-wall'};
      const fn=async()=>{calls++;return {version,previewPngBase64:'fixture-small-image',id:args.id}};
      await usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),fn);version=2;
      await rejectsCode(()=>usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),fn),'api_idempotency_conflict');
      await rejectsCode(()=>usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),fn),'api_result_not_replayable');assert.equal(calls,2);
      const fresh=await usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,idempotency()),fn);assert.equal(fresh.version,2);assert.equal(calls,3);assert.deepEqual(await balance(g),{used:2,reserved:0});
    });
    await check('preview_retry_slot_has_one_parallel_winner',async()=>{
      const x=await fixturePrincipal(auth,'preview-retry-race');const g=await grant(x.owner,'wall_preview',1);const key=idempotency(),args={id:'fixture-preview-race'};const value={version:1,previewPngBase64:'fixture-image'};let calls=0;
      await usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),async()=>{calls++;return value});
      const retry=async()=>{calls++;await new Promise(r=>setTimeout(r,50));return value};
      const results=await Promise.allSettled([usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),retry),usage.meteredMcpTool(x.principal,'preview_logo_wall',args,request(x.issued.token,key),retry)]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert(results.some(r=>r.status==='rejected'&&r.reason.message==='api_result_not_replayable'));assert.equal(calls,2);assert.deepEqual(await balance(g),{used:1,reserved:0});
      assert.equal((await read('SELECT read_replay_count FROM semologo.api_usage_events WHERE owner_id=$1',[x.owner])).rows[0].read_replay_count,1);
    });
    await check('preview_retry_ttl_expiry_prevents_callback',async()=>{
      const x=await fixturePrincipal(auth,'preview-retry-expiry');const g=await grant(x.owner,'wall_preview',1);const key=idempotency();let calls=0;const fn=async()=>{calls++;return {previewPngBase64:'fixture-image',version:1}};
      await usage.meteredMcpTool(x.principal,'preview_logo_wall',{},request(x.issued.token,key),fn);
      await read("UPDATE semologo.api_usage_events SET finished_at=now()-interval '3 minutes' WHERE owner_id=$1",[x.owner]);
      await rejectsCode(()=>usage.meteredMcpTool(x.principal,'preview_logo_wall',{},request(x.issued.token,key),fn),'api_result_not_replayable');assert.equal(calls,1);assert.deepEqual(await balance(g),{used:1,reserved:0});
      assert.equal((await read('SELECT read_replay_count FROM semologo.api_usage_events WHERE owner_id=$1',[x.owner])).rows[0].read_replay_count,0);
    });
    await check('read_replay_rechecks_expired_or_suspended_entitlement', async () => {
      const x = await fixturePrincipal(auth, 'expired-read-replay');
      const g = await grant(x.owner, 'wall_preview', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; return { wallId: 'fixture-expiring-read' }; };
      await usage.meteredMcpTool(x.principal, 'preview_logo_wall', {}, request(x.issued.token, key), fn);
      await read("UPDATE semologo.api_entitlements SET period_end=now()-interval '1 second' WHERE id=$1", [g]);
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'preview_logo_wall', {}, request(x.issued.token, key), fn), 'api_entitlement_required');
      await read("UPDATE semologo.api_entitlements SET period_end=now()+interval '30 days',state='suspended' WHERE id=$1", [g]);
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'preview_logo_wall', {}, request(x.issued.token, key), fn), 'api_entitlement_required');
      assert.equal(calls, 1, 'old read keys cannot create new work after entitlement expiry');
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
    });
    await check('expired_write_plan_can_only_replay_previously_committed_receipt', async () => {
      const x = await fixturePrincipal(auth, 'expired-write-replay');
      const g = await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; return { created: true, wall: { id: 'fixture-owned-past-wall' } }; };
      await usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn);
      await read("UPDATE semologo.api_entitlements SET period_end=now()-interval '1 second' WHERE id=$1", [g]);
      const old = await usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn);
      assert.equal(old.wall.id, 'fixture-owned-past-wall');
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, idempotency()), fn), 'api_entitlement_required');
      assert.equal(calls, 1, 'a cached receipt does not authorize another mutation');
      assert.deepEqual(await balance(g), { used: 1, reserved: 0 });
    });
    await check('read_failure_voids_quota_and_revoked_or_wrong_owner_key_cannot_execute', async () => {
      const x = await fixturePrincipal(auth, 'read-failure');
      const g = await grant(x.owner, 'wall_read', 1);
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'get_logo_wall', {}, request(x.issued.token, idempotency()), async () => { throw Error('fixture-read-failure'); }), 'fixture-read-failure');
      assert.deepEqual(await balance(g), { used: 0, reserved: 0 });
      let calls = 0;
      const fn = async () => { calls++; return {}; };
      await rejectsCode(() => usage.meteredMcpTool({ ...x.principal, owner: bob.owner }, 'get_logo_wall', {}, request(x.issued.token, idempotency()), fn), 'api_scope_denied');
      await read('UPDATE semologo.api_keys SET revoked_at=now() WHERE id=$1', [x.issued.key.id]);
      await rejectsCode(() => usage.meteredMcpTool(x.principal, 'get_logo_wall', {}, request(x.issued.token, idempotency()), fn), 'api_scope_denied');
      assert.equal(calls, 0);
    });
    await check('oversized_write_cache_is_bounded_and_retains_resource_identity', async () => {
      const x = await fixturePrincipal(auth, 'large-write');
      await grant(x.owner, 'wall_create', 1);
      const key = idempotency();
      let calls = 0;
      const fn = async () => { calls++; return { created: true, wall: { id: 'fixture-large-wall', version: 2, ignoredHugePayload: 'fixture-items'.repeat(15000) }, plan: 'fixture-selection'.repeat(15000) }; };
      await usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn);
      const replay = await usage.meteredMcpTool(x.principal, 'create_logo_wall', {}, request(x.issued.token, key), fn);
      assert.equal(calls, 1); assert.equal(replay.wall.id, 'fixture-large-wall');
      assert.equal(replay.wall.version, 2);
      assert(!('ignoredHugePayload' in replay.wall), 'compact replay preserves only bounded wall identity');
      const event = (await read('SELECT result_json FROM semologo.api_usage_events WHERE owner_id=$1', [x.owner])).rows[0];
      assert(Buffer.byteLength(JSON.stringify(event.result_json)) < 131200, 'cached result has a fixed maximum size');
    });
    await check('raw_api_keys_are_absent_from_all_test_tables', async () => {
      const snapshot = await read(`SELECT jsonb_build_object('keys',(SELECT jsonb_agg(to_jsonb(k)) FROM semologo.api_keys k),'events',(SELECT jsonb_agg(to_jsonb(e)) FROM semologo.api_usage_events e)) value`);
      const serialized = JSON.stringify(snapshot.rows);
      assert(!serialized.includes(alice.issued.token) && !serialized.includes(bob.issued.token), 'complete API tokens must remain memory-only');
    });
  } catch (error) {
    failure = { phase, type: error.name || 'Error', code: /^[A-Z0-9_]{1,32}$/.test(error.code || '') ? error.code : 'SAFE_INTEGRATION_FAILURE' };
  } finally {
    if (created) {
      try {
        assert(/^semologo_api_test_20261029_[a-f0-9]{16}$/.test(schema));
        await pool.query('DROP SCHEMA ' + quoted + ' CASCADE');
        const exists = await pool.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1', [schema]);
        cleaned = exists.rowCount === 0;
      } catch (error) {
        failure = failure || { phase: 'guarded_schema_cleanup', type: error.name || 'Error', code: 'CLEANUP_FAILED' };
      }
    }
    await pool.end();
  }
  const report = {
    mode: 'actual-postgres-isolated-schema-integration', checkedAt: new Date().toISOString(),
    status: failure || !cleaned ? 'FAIL' : 'PASS', schema, checks, passed: checks.length, failure,
    testSchemaCreated: created, testSchemaDroppedAndAbsenceVerified: cleaned,
    sourceSha256: payload.sha256, rewrittenQueries,
    productionMigrationApplied: false, productionTablesTouched: false,
    realLoginProviderCalled: false, paymentCalls: 0, rawTokensPrinted: false,
  };
  console.log(JSON.stringify(report));
  if (report.status !== 'PASS') process.exitCode = 1;
}

if (!process.argv.includes('--integration')) {
  console.log('Explicit opt-in required: bash scripts/with-local-storage.sh node scripts/check-developer-api.cjs --integration');
  process.exit(0);
}
const files = { auth: 'src/lib/developer-api-auth.ts', usage: 'src/lib/developer-api-usage.ts', pilot: 'src/lib/developer-api-pilot.ts' };
const payload = { schema: 'semologo_api_test_20261029_' + crypto.randomBytes(8).toString('hex'), sha256: {}, ddl: fs.readFileSync('db/developer-api-schema.sql', 'utf8') };
for (const [key, file] of Object.entries(files)) {
  const raw = fs.readFileSync(file, 'utf8');
  payload.sha256[file] = crypto.createHash('sha256').update(raw).digest('hex');
  payload[key] = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
}
payload.sha256['db/developer-api-schema.sql'] = crypto.createHash('sha256').update(payload.ddl).digest('hex');
payload.sha256['scripts/check-developer-api.cjs'] = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
const input = '(' + isolatedPg.toString() + ')(' + JSON.stringify(payload) + ').catch(()=>{console.log(JSON.stringify({status:"FAIL",failure:{phase:"initialization",code:"SAFE_INITIALIZATION_FAILURE"}}));process.exitCode=1;});\n';
const result = cp.spawnSync('ssh', ['vibers', 'docker exec -i semologo node -'], { input, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
const lines = (result.stdout || '').trim().split('\n').filter(Boolean);
let report;
for (const line of lines) {
  try { const item = JSON.parse(line); if (item.mode === 'actual-postgres-isolated-schema-integration') report = item; } catch {}
}
if (!report) {
  console.error(JSON.stringify({ status: 'FAIL', phase: 'missing_completion_receipt', isolatedSchemaToInspect: payload.schema, cleanupVerified: false }));
  process.exitCode = 1;
} else {
  const output = path.resolve('ops/evidence/monetization-readiness-20261029/isolated-pg-integration.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, passed: report.passed, failure: report.failure, testSchemaDroppedAndAbsenceVerified: report.testSchemaDroppedAndAbsenceVerified, output: path.relative(process.cwd(), output) }));
  if (result.status !== 0 || report.status !== 'PASS') process.exitCode = 1;
}
