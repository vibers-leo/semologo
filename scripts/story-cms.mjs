#!/usr/bin/env node
/** SSH is the default transport; --local explicitly uses this process's database. */
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateStory,videoSource,storyWriteSql} from '../src/lib/story-input.mjs';
const args=process.argv.slice(2);const local=args[0]==='--local';if(local)args.shift();
const [command,arg]=args;
if(!['init','list','get','put','history'].includes(command)){console.error('Usage: node scripts/story-cms.mjs [--local] init|list|get SLUG|put FILE.json|history SLUG');process.exit(1);}
const input=command==='put'?validateStory(JSON.parse(readFileSync(arg,'utf8'))):null;
const schema=command==='init'?readFileSync(fileURLToPath(new URL('../db/story-cms-schema.sql',import.meta.url)),'utf8'):null;
const seed=command==='init'?JSON.parse(readFileSync(fileURLToPath(new URL('../data/stories/legacy.json',import.meta.url)),'utf8')):null;
const x={command,arg,input,schema,seed};
const source=`const x=${JSON.stringify(x)};
${videoSource.toString()}
${validateStory.toString()}
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1,connectionTimeoutMillis:5000});if(!process.env.DB_VIBERS_MAIN_URL)throw Error('DB_VIBERS_MAIN_URL is required');const c=await p.connect();try{
if(x.command==='init'){await c.query('BEGIN');await c.query(x.schema);for(const item of x.seed){const a=validateStory({...item,status:'published'});await c.query("INSERT INTO semologo.stories(slug,status,payload) VALUES($1,'published',$2::jsonb) ON CONFLICT DO NOTHING",[a.slug,JSON.stringify(a.payload)]);await c.query("INSERT INTO semologo.story_revisions(slug,revision,status,payload,actor) SELECT slug,revision,status,payload,'migration' FROM semologo.stories WHERE slug=$1 ON CONFLICT DO NOTHING",[a.slug]);}await c.query('COMMIT');console.log(JSON.stringify({ok:true,seeded:x.seed.length}));}
else if(x.command==='put'){const a=validateStory({...x.input.payload,status:x.input.status,revision:x.input.revision});await c.query('BEGIN');const r=await c.query(${JSON.stringify(storyWriteSql)},[a.slug,a.status,JSON.stringify(a.payload),a.revision]);if(r.rowCount!==1)throw Error('Revision conflict: fetch current story before editing');await c.query('INSERT INTO semologo.story_revisions(slug,revision,status,payload,actor) VALUES($1,$2,$3,$4::jsonb,$5)',[a.slug,r.rows[0].revision,a.status,JSON.stringify(a.payload),'ssh-cli']);await c.query('COMMIT');console.log(JSON.stringify({ok:true,slug:a.slug,revision:r.rows[0].revision}));}
else if(x.command==='history'){const r=await c.query('SELECT revision,status,payload,actor,created_at FROM semologo.story_revisions WHERE slug=$1 ORDER BY revision DESC LIMIT 100',[x.arg]);console.log(JSON.stringify(r.rows,null,2));}
else {const r=await c.query('SELECT slug,status,payload,revision,updated_at FROM semologo.stories WHERE ($1::text IS NULL OR slug=$1) ORDER BY updated_at DESC LIMIT 200',[x.command==='get'?x.arg:null]);const rows=r.rows.map(r=>({...r.payload,status:r.status,revision:r.revision,updated_at:r.updated_at}));if(x.command==='get'&&!rows.length)throw Error('Story not found');console.log(JSON.stringify(x.command==='get'?rows[0]:rows,null,2));}
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end();}})().catch(e=>{console.error(e.message);process.exit(1)});`;
const result=local?spawnSync(process.execPath,['-e',source],{stdio:['ignore','pipe','pipe'],maxBuffer:2000000,timeout:30000}):spawnSync('ssh',['vibers','docker exec -i semologo node'],{input:source,encoding:'utf8',maxBuffer:2000000,timeout:30000});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.error)console.error(result.error.message);process.exit(result.status??1);
