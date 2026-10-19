const fs = require('node:fs');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.FLEET_DATABASE_URL, max: 1 });
const validDomain = value => /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(value);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',')}}` : JSON.stringify(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
(async () => {
  const incoming = JSON.parse(fs.readFileSync(0, 'utf8'));
  const config = JSON.parse(fs.readFileSync(process.env.FLEET_CONFIG, 'utf8'));
  const owners = config.projects.semologo.jobs['semologo-domain-discover'].owners.filter(owner => ['win-01','win-02'].includes(owner));
  if (!owners.length) throw Error('No SemoLogo discovery worker');
  const client = await pool.connect();
  const updates = [];
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-user-requests',0))");
    const existing = await client.query(`SELECT commit_sha FROM fleet.job WHERE tenant='internal' AND project='semologo'
      AND kind='semologo-domain-discover' ORDER BY created_at DESC LIMIT 1`);
    if (!existing.rowCount) throw Error('No deployed discovery commit');
    const commit = existing.rows[0].commit_sha;
    for (const row of incoming.pending) {
      let domain;
      try { domain = new URL(row.official_url).hostname.toLowerCase().replace(/^www\./,''); } catch { continue; }
      if (!validDomain(domain)) continue;
      const requestKey = `semologo-user-request-${row.id}`;
      const already = await client.query("SELECT id,status FROM fleet.job WHERE tenant='internal' AND project='semologo' AND request_key=$1", [requestKey]);
      if (already.rowCount) { updates.push({ id: row.id, jobId: already.rows[0].id, status: already.rows[0].status }); continue; }
      const counts = await client.query("SELECT owner,count(*)::int AS n FROM fleet.job WHERE tenant='internal' AND project='semologo' AND status IN ('queued','running') AND owner=ANY($1) GROUP BY owner", [owners]);
      const countMap = new Map(counts.rows.map(item => [item.owner, item.n]));
      const owner = [...owners].sort((a,b) => (countMap.get(a)||0)-(countMap.get(b)||0))[0];
      if ((countMap.get(owner) || 0) >= 3) break;
      const input = { domains: [domain], priority: 'user-request', requestId: row.id };
      const inputHash = hash(canonical({ kind: 'semologo-domain-discover', commit, input, workerId: owner }));
      // Claim order is created_at within each worker. Place the request just
      // ahead of already queued bulk jobs without changing their timestamps.
      const inserted = await client.query(`INSERT INTO fleet.job(tenant,project,kind,request_key,input_hash,owner,commit_sha,input,created_at)
        VALUES('internal','semologo','semologo-domain-discover',$1,$2,$3,$4,$5,
          COALESCE((SELECT min(created_at)-interval '1 microsecond' FROM fleet.job
            WHERE tenant='internal' AND owner=$3 AND status='queued'),now()))
        ON CONFLICT(tenant,project,request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING id,status`,
        [requestKey,inputHash,owner,commit,input]);
      updates.push({ id: row.id, jobId: inserted.rows[0].id, status: inserted.rows[0].status });
    }
    for (const row of incoming.active) {
      const job = await client.query('SELECT status FROM fleet.job WHERE id=$1 AND tenant=\'internal\' AND project=\'semologo\'', [row.fleet_job_id]);
      if (job.rowCount) updates.push({ id: row.id, jobId: row.fleet_job_id, status: job.rows[0].status });
    }
    await client.query('COMMIT');
    process.stdout.write(JSON.stringify(updates));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
})().finally(() => pool.end()).catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
