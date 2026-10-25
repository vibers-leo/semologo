#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {deliverInquiry} from '../src/lib/inquiry-mail.mjs';
const source=`const {Pool}=require('pg');const nodemailer=require('nodemailer');
${deliverInquiry.toString()}
(async()=>{const db=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1,connectionTimeoutMillis:5000});try{await db.query('DELETE FROM semologo.ad_inquiries WHERE expires_at<now()');const r=await db.query("SELECT id FROM semologo.ad_inquiries WHERE created_at>now()-interval '7 days' AND (email_status='pending' OR (email_status IN ('sending','failed') AND updated_at<now()-interval '10 minutes')) ORDER BY created_at LIMIT 5");for(const row of r.rows)await deliverInquiry(db,nodemailer.createTransport,process.env,row.id);console.log(JSON.stringify({processed:r.rowCount}));}finally{await db.end();}})().catch(e=>{console.error(e.code||e.name);process.exit(1)});`;
if(process.argv.includes('--emit')){process.stdout.write(source);process.exit(0);}
const r=spawnSync('ssh',['vibers','docker exec -i semologo node'],{input:source,encoding:'utf8',timeout:160000,maxBuffer:100000});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);process.exit(r.status??1);
