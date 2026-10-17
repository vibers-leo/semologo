// Run inside the existing fleet container. Only pinned official sources may be queued.
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const sources = JSON.parse(fs.readFileSync('/app/semologo-sources.json', 'utf8')).sources;
const config = JSON.parse(fs.readFileSync(process.env.FLEET_CONFIG, 'utf8'));
const principal = config.principals.find(p => p.role === 'worker' && p.workerId === 'win-01' && p.projects.includes('semologo'));
if (!principal || !config.projects.semologo?.jobs?.['semologo-logo-collect']) throw Error('SemoLogo fleet configuration missing');
const commit = 'f36b11d367243e263b9709f47ebf850a1df3a85e'; // deployed, tested collector commit
const kind = 'semologo-logo-collect';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',')}}` : JSON.stringify(value);
const pool = new pg.Pool({connectionString: process.env.FLEET_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000});

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-hourly-collect', 0))");
    const jobs = (await client.query("SELECT id, owner, status, created_at, input, result FROM fleet.job WHERE tenant=$1 AND project='semologo' AND kind=$2 ORDER BY created_at", [principal.tenant, kind])).rows;
    const bySource = new Map();
    for (const job of jobs) {
      const id = job.input?.sourceId;
      if (typeof id === 'string') bySource.set(id, [...(bySource.get(id) || []), job]);
    }
    const fresh = [], retry = [], blocked = [];
    for (const source of sources) {
      const history = bySource.get(source.id) || [];
      if (history.some(j => ['succeeded', 'queued', 'running', 'review_required'].includes(j.status))) continue;
      if (!history.length) fresh.push(source);
      else if (history.length < 2) retry.push(source);
      else blocked.push(source.id);
    }
    // Feed domestic official identities and Korean CI repairs before global
    // sources. The latter remain available whenever the Korean lane drains.
    const isKorean = source => source.id.startsWith('ko-') || /[가-힣]/.test(source.id);
    const sourcePriority = source => isKorean(source) ? 0 : 1;
    fresh.sort((a, b) => sourcePriority(a) - sourcePriority(b));
    const priority = [...fresh, ...retry];
    const freshIds = new Set(fresh.map(source => source.id));
    const slot = new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, '');
    const queued = [], skipped = [];
    const owners = ['win-01', 'win-02'];
    for (const [ownerIndex, owner] of owners.entries()) {
      const allowed = config.projects.semologo.jobs[kind].owners || [];
      if (!allowed.includes(owner)) throw Error(`Worker ${owner} not assigned to SemoLogo`);
      const busy = await client.query("SELECT 1 FROM fleet.job WHERE tenant=$1 AND owner=$2 AND status IN ('queued','running','review_required') LIMIT 1", [principal.tenant, owner]);
      if (busy.rowCount) { skipped.push(`${owner}:busy`); continue; }
      const preferred = isKorean;
      // Each task collects one pinned SVG; workers execute them serially. Keep a
      // bounded queue per PC while allowing a short source roster to drain.
      const batchSize = Math.min(16, Math.ceil(priority.length / (owners.length - ownerIndex)));
      for (let n = 0; n < batchSize && priority.length; n++) {
        let index = priority.findIndex(preferred);
        if (index < 0 && priority.length) index = 0;
        if (index < 0) break;
        const [source] = priority.splice(index, 1);
        const input = {sourceId: source.id};
        const previousAttempts = bySource.get(source.id)?.length || 0;
        const requestKey = `semologo-hourly-${slot}-${hash(source.id).slice(0, 12)}${previousAttempts ? `-r${previousAttempts}` : ''}`;
        const inputHash = hash(canonical({kind, commit, input, workerId: owner}));
        if (dryRun) { queued.push({sourceId: source.id, owner, status: 'dry_run'}); continue; }
        const inserted = await client.query(`INSERT INTO fleet.job(tenant,project,kind,request_key,input_hash,owner,commit_sha,input)
          VALUES($1,'semologo',$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant,project,request_key) DO NOTHING RETURNING id`,
          [principal.tenant, kind, requestKey, inputHash, owner, commit, input]);
        queued.push({sourceId: source.id, owner, status: inserted.rowCount ? 'queued' : 'already_queued', jobId: inserted.rows[0]?.id});
      }
    }
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = jobs.filter(j => new Date(j.created_at) >= since);
    const status = Object.fromEntries(['queued', 'running', 'succeeded', 'failed', 'review_required'].map(s => [s, recent.filter(j => j.status === s).length]));
    const lastHourJobs = recent.slice(-20).map(j => ({jobId: j.id, sourceId: j.input?.sourceId,
      owner: j.owner, status: j.status, manifestKey: j.result?.manifestKey || null}));
    const report = {at: new Date().toISOString(), dryRun, sourceCount: sources.length, attemptedSourceCount: bySource.size,
      freshRemaining: fresh.length - queued.filter(q => freshIds.has(q.sourceId) && (q.status === 'queued' || q.status === 'dry_run')).length,
      retryCandidates: retry.length, blockedSources: blocked, lastHour: status, lastHourJobs, queued, skipped,
      nextAction: priority.length === 0 && queued.length === 0 ? 'Expand reviewed official-source allowlist; current roster exhausted' :
        priority.length > 0 && queued.length === 0 && skipped.length ? 'Workers busy; retry available sources at the next hourly run' :
        'Review completed manifests for identity, visual quality, and CMS publication',
      publication: 'Source collection only. Identity, SVG safety, visual quality, and CMS publication require review.'};
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    console.log(JSON.stringify(report));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} finally { await pool.end(); }
