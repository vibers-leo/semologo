// Central, bounded feeder for reviewed private SemoLogo domain shards.
// Run inside vibers-fleet with `node - --dry-run` or `node - --apply`.
const {createRequire}=require('node:module');
const requireApp=createRequire('/app/package.json');
const {S3Client,GetObjectCommand}=requireApp('@aws-sdk/client-s3');
const {Pool}=requireApp('pg');
const {createHash}=require('node:crypto');
const {gunzipSync}=require('node:zlib');
const fs=require('node:fs');
const path=require('node:path');

const SHARDS={
 'win-01':[
  {count:500000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch1/win-01-b3036c600da67d3f.csv.gz',sha:'b3036c600da67d3ff2677bc1865e9ad5468b9f47e66d79229eb8a5bd8a37c21f',bytes:5242227},
  {count:500000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch2/win-01-814cba28d8b640e3.csv.gz',sha:'814cba28d8b640e32879ead50aeda8b3d94b239dc5fb259eda5400f4fed164cf',bytes:5123596},
  {count:3000000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch3/win-01-2922187f208bd641.csv.gz',sha:'2922187f208bd641d89120b6786be0ffbca7ba71dc4907e2eceb22b05caa1953',bytes:30597465},
 ],
 'win-02':[
  {count:500000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch1/win-02-b247404415aac83a.csv.gz',sha:'b247404415aac83a1fb9c0fbeeef50a1aba13491b4f6191f705276b243efed19',bytes:5239986},
  {count:500000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch2/win-02-cd5e2e3168b29e66.csv.gz',sha:'cd5e2e3168b29e6627d1dfd79d575a1415c315fd61988131ff8fb878be56d551',bytes:5122041},
  {count:3000000,key:'automation/v1/tenants/internal/projects/semologo/seeds/cc-20261016/batch3/win-02-697bbf2c60cfb77e.csv.gz',sha:'697bbf2c60cfb77e43ec439b4e12d4d4dbc98ba6645d15df66dc488b3189c023',bytes:30582544},
 ],
};
const startOffset={'win-01':3012,'win-02':12}; // Earlier Mac and Windows pilot ranges.
const BATCH=12,MAX_QUEUED=2,COMMIT='c3373ce494a68dfa96974e91411d93ac00ebd634';
const digest=b=>createHash('sha256').update(b).digest('hex');
const canonical=x=>Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')}}`:JSON.stringify(x);
const apply=process.argv.includes('--apply');
if(process.argv.includes('--dry-run')===apply)throw Error('Choose exactly one of --dry-run or --apply');

const store=new S3Client({endpoint:process.env.FLEET_NCP_ENDPOINT,region:'kr-standard',forcePathStyle:true,
 credentials:{accessKeyId:process.env.FLEET_NCP_ACCESS_KEY,secretAccessKey:process.env.FLEET_NCP_SECRET_KEY},maxAttempts:2});
const pool=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1,connectionTimeoutMillis:5000});

async function rows(shard,offset,count){
 // The immutable, hash-checked seed is reused by many short feeder runs.
 // Keep only this private compressed shard inside the fleet container to avoid
 // downloading several megabytes every few seconds.
 const cacheDir='/tmp/semologo-domain-shard-cache';
 const cacheFile=path.join(cacheDir,shard.sha+'.csv.gz');
 let compressed;
 if(fs.existsSync(cacheFile)){
  compressed=fs.readFileSync(cacheFile);
  if(compressed.length!==shard.bytes||digest(compressed)!==shard.sha){
   fs.unlinkSync(cacheFile);compressed=undefined;
  }
 }
 if(!compressed){
  const response=await store.send(new GetObjectCommand({Bucket:'vibers-bucket',Key:shard.key}),{abortSignal:AbortSignal.timeout(30000)});
  if(response.ContentLength!==shard.bytes)throw Error('Seed size changed');
  compressed=Buffer.from(await response.Body.transformToByteArray());
  if(digest(compressed)!==shard.sha)throw Error('Seed hash mismatch');
  fs.mkdirSync(cacheDir,{recursive:true,mode:0o700});
  const temporary=cacheFile+'.'+process.pid+'.tmp';
  fs.writeFileSync(temporary,compressed,{mode:0o600});
  fs.renameSync(temporary,cacheFile);
 }
 const raw=gunzipSync(compressed,{maxOutputLength:200000000}).toString('utf8');
 let from=raw.indexOf('\n')+1;if(!from)throw Error('Seed header missing');
 for(let i=0;i<offset;i++){from=raw.indexOf('\n',from)+1;if(!from)throw Error('Seed row missing');}
 const result=[];
 for(let i=0;i<count;i++){
  const end=raw.indexOf('\n',from);if(end<0)throw Error('Seed batch truncated');
  const line=raw.slice(from,end).replace(/\r$/,'');const domain=line.slice(line.lastIndexOf(',')+1).toLowerCase();from=end+1;
  // The deployed worker accepts ASCII-letter TLDs only.  Skip unsupported
  // IDNA and malformed rows so a single corpus entry cannot stall the feed.
  if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain))continue;
  result.push(domain);
 }
 if(!result.length)throw Error('Seed batch contains no valid domains');
 if(new Set(result).size!==result.length)throw Error('Duplicate seed domain');
 return result;
}

async function main(){
 const client=await pool.connect(),queued=[],recovered=[];
 try{
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-domain-r45-schedule',0))");
  // A lost lease is moved to review_required by the fleet reaper. With no
  // result or active lease it can be retried once; further timeouts remain for
  // human review, avoiding an infinite claim/reaper loop.
  const stalled=await client.query(`UPDATE fleet.job SET status='queued'
    WHERE tenant='internal' AND project='semologo' AND kind='semologo-domain-discover'
      AND status='review_required' AND result IS NULL AND lease_token IS NULL
      AND lease_until IS NULL AND attempt=1 AND created_at<now()-interval '5 minutes'
    RETURNING id,owner,request_key`);
  recovered.push(...stalled.rows);
  for(const owner of ['win-01','win-02']){
   const prefix=`semologo-bulk-r45-${owner.replace('-','')}-`;
   const current=await client.query("SELECT count(*)::int AS n FROM fleet.job WHERE tenant='internal' AND project='semologo' AND kind='semologo-domain-discover' AND owner=$1 AND request_key LIKE $2",[owner,prefix+'%']);
   const active=await client.query("SELECT project,kind,status FROM fleet.job WHERE tenant='internal' AND owner=$1 AND status IN ('queued','running','review_required')",[owner]);
   // Queued work in another project should not stop this bounded feeder for
   // hours; the worker cycles projects and the fleet claim stays serialized.
   const other=active.rows.filter(x=>x.kind!=='semologo-domain-discover'&&x.status!=='queued');
   const pending=active.rows.filter(x=>x.kind==='semologo-domain-discover'&&x.status==='queued').length;
   if(other.length||pending>=MAX_QUEUED){queued.push({owner,skipped:other.length?'other-work-active':'queue-full',pending});continue;}
   for(let slot=pending;slot<MAX_QUEUED;slot++){
    const index=current.rows[0].n+slot-pending;
    let globalOffset=startOffset[owner]+index*BATCH,shardIndex=0;
    while(shardIndex<SHARDS[owner].length&&globalOffset>=SHARDS[owner][shardIndex].count){globalOffset-=SHARDS[owner][shardIndex].count;shardIndex++;}
    if(shardIndex>=SHARDS[owner].length){queued.push({owner,skipped:'shards-exhausted'});break;}
    const shard=SHARDS[owner][shardIndex];
    const firstCount=Math.min(BATCH,shard.count-globalOffset);
    const domains=await rows(shard,globalOffset,firstCount);
    if(firstCount<BATCH){
     const next=SHARDS[owner][shardIndex+1];
     if(!next){queued.push({owner,skipped:'shards-exhausted'});break;}
     domains.push(...await rows(next,0,BATCH-firstCount));
    }
    if(new Set(domains).size!==domains.length)throw Error('Cross-shard duplicate domain');
    const input={domains},kind='semologo-domain-discover',requestKey=prefix+String(index).padStart(8,'0');
    const inputHash=digest(canonical({kind,commit:COMMIT,input,workerId:owner}));
    if(apply)await client.query(`INSERT INTO fleet.job(tenant,project,kind,request_key,input_hash,owner,commit_sha,input)
      VALUES('internal','semologo',$1,$2,$3,$4,$5,$6) ON CONFLICT(tenant,project,request_key) DO NOTHING`,[kind,requestKey,inputHash,owner,COMMIT,input]);
    queued.push({owner,requestKey,shard:shardIndex+1,offset:globalOffset,domains:domains.length,status:apply?'queued':'dry_run'});
   }
  }
  await client.query(apply?'COMMIT':'ROLLBACK');
  console.log(JSON.stringify({at:new Date().toISOString(),apply,recovered,queued}));
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
main().finally(async()=>{store.destroy();await pool.end()}).catch(error=>{console.error(error.message);process.exitCode=1});
