// Existing deployed Windows handler; bounded jobs, domestic roster before bulk.
const fs=require('node:fs'),crypto=require('node:crypto');
const {Pool}=require('pg');
const apply=process.argv.includes('--apply');
const PRIORITY='kr-public-institutions-20261025';
const COMMIT='c3373ce494a68dfa96974e91411d93ac00ebd634';
const canonical=x=>Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')}}`:JSON.stringify(x);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const roster=JSON.parse(fs.readFileSync(0,'utf8'));
const config=JSON.parse(fs.readFileSync(process.env.FLEET_CONFIG,'utf8'));
const allowed=config.projects.semologo.jobs['semologo-domain-discover'].owners;
const pool=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});
(async()=>{
  const grouped=new Map(),invalid=[];
  for(const m of roster.members){
    let domain;
    try{domain=new URL(m.homepage).hostname.toLowerCase().replace(/^www\./,'');}catch{invalid.push(m.name);continue;}
    if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain)){invalid.push(m.name);continue;}
    if(!grouped.has(domain))grouped.set(domain,[]);
    grouped.get(domain).push(m);
  }
  const db=await pool.connect();
  try{
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-domain-r45-schedule',0))");
    const jobs=(await db.query(`SELECT id,owner,status,input,result FROM fleet.job
      WHERE tenant='internal' AND project='semologo' AND kind='semologo-domain-discover'
        AND input->>'priority'=$1`,[PRIORITY])).rows;
    const targetKey=t=>t.snapshot_id+'|'+t.member_key;
    const seen=new Set(jobs.flatMap(j=>(j.input.targets||[]).map(targetKey)));
    const pending=[...grouped.keys()].filter(d=>grouped.get(d).some(t=>!seen.has(targetKey(t))));
    const queued=[],skipped=[],reassigned=[],readyOwners=[];
    for(const owner of ['win-01','win-02']){
      if(!allowed.includes(owner))throw Error('Worker not allowed: '+owner);
      const online=await db.query("SELECT 1 FROM fleet.worker_presence WHERE tenant='internal' AND worker_id=$1 AND last_seen>now()-interval '3 minutes'",[owner]);
      if(!online.rowCount){skipped.push({owner,reason:'heartbeat-stale'});continue;}
      const stalled=await db.query(`SELECT 1 WHERE EXISTS(SELECT 1 FROM fleet.job
        WHERE tenant='internal' AND project='semologo' AND owner=$1 AND status='queued'
          AND created_at<now()-interval '30 minutes')
        AND NOT EXISTS(SELECT 1 FROM fleet.job j JOIN fleet.event e ON e.job_id=j.id
          WHERE j.tenant='internal' AND j.project='semologo' AND j.owner=$1
            AND e.status='succeeded' AND e.at>now()-interval '30 minutes')`,[owner]);
      if(stalled.rowCount){skipped.push({owner,reason:'semologo-queue-not-draining'});continue;}
      readyOwners.push(owner);
    }
    for(const owner of readyOwners){
      const active=jobs.filter(j=>j.owner===owner&&['queued','running'].includes(j.status)).length;
      // Two queued/running batches per PC, 12 domains in each deployed handler call.
      for(let slot=active;slot<2;slot++){
        const stranded=jobs.find(j=>j.status==='queued'&&!readyOwners.includes(j.owner));
        if(stranded){
          const inputHash=hash(canonical({kind:'semologo-domain-discover',commit:COMMIT,input:stranded.input,workerId:owner}));
          if(apply){
            const moved=await db.query(`UPDATE fleet.job SET owner=$2,input_hash=$3
              WHERE id=$1 AND status='queued' AND attempt=0 AND lease_token IS NULL RETURNING id`,[stranded.id,owner,inputHash]);
            if(!moved.rowCount)continue;
          }
          reassigned.push({jobId:stranded.id,from:stranded.owner,to:owner});
          stranded.owner=owner;
          continue;
        }
        if(!pending.length)break;
        const domains=pending.splice(0,12);
        const targets=domains.flatMap(d=>grouped.get(d));
        const input={domains,priority:PRIORITY,targets};
        const key='semologo-public-alio-20261025-'+hash(canonical({domains,targets:targets.map(targetKey)})).slice(0,20);
        const inputHash=hash(canonical({kind:'semologo-domain-discover',commit:COMMIT,input,workerId:owner}));
        if(apply){
          // The deployed claim uses created_at. The dedicated publisher lane
          // tracks IDs, so priority timestamps cannot bypass its normal cursor.
          const inserted=await db.query(`INSERT INTO fleet.job
            (tenant,project,kind,request_key,input_hash,owner,commit_sha,input,created_at)
            VALUES('internal','semologo','semologo-domain-discover',$1,$2,$3,$4,$5,
              coalesce((SELECT min(created_at)-interval '1 microsecond' FROM fleet.job
                WHERE tenant='internal' AND project='semologo' AND owner=$3 AND status='queued'),now()))
            ON CONFLICT(tenant,project,request_key) DO NOTHING RETURNING id`,[key,inputHash,owner,COMMIT,input]);
          if(!inserted.rowCount)throw Error('Unexpected duplicate priority batch');
          queued.push({jobId:inserted.rows[0].id,owner,domains,targets:targets.map(t=>t.name)});
        }else queued.push({owner,domains,targets:targets.map(t=>t.name),status:'dry_run'});
      }
    }
    const active=jobs.filter(j=>['queued','running'].includes(j.status)).length;
    const holdBulk=Boolean(pending.length||queued.length||active);
    const report={at:new Date().toISOString(),priority:PRIORITY,apply,
      rosterMembers:roster.members.length,uniqueDomains:grouped.size,
      previouslyAttemptedTargets:seen.size,remainingDomains:pending.length,
      activeBatches:active,queued,reassigned,skipped,invalid,holdBulk,qualityUnresolved:roster.qualityUnresolved?.length||0,
      publication:'Private discovery only; existing source and identity review gates remain required.'};
    await db.query(apply?'COMMIT':'ROLLBACK');
    console.log(JSON.stringify(report));
    if(apply&&holdBulk)process.exitCode=10;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
})().finally(()=>pool.end()).catch(e=>{console.error(e.message);process.exitCode=1;});
