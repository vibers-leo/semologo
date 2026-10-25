import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInquiry} from '../src/lib/ad-inquiry-input.mjs';
import {deliverInquiry} from '../src/lib/inquiry-mail.mjs';
const base={id:'11111111-1111-4111-8111-111111111111',name:'담당자',company:'회사',email:'person@example.com',kind:'배너 광고',message:'배너 광고에 대해 문의합니다.',consent:true};
test('consent, valid address and minimum body are required',()=>{assert.equal(validateInquiry(base).email,base.email);for(const patch of [{consent:false},{email:'a@b\r\nBcc:bad@example.com'},{message:'짧음'},{website:'spam'},{kind:'unknown'}])assert.throws(()=>validateInquiry({...base,...patch}));});
test('first-touch attribution drops query parameters and private fields',()=>{const a=validateInquiry({...base,attribution:{utm_source:'instagram',landing_path:'/advertise/?email=secret',page_url:'https://semologo.com/advertise/?token=secret',referrer:'https://example.com/post?private=secret',password:'secret'}}).attribution;assert.equal(a.utm_source,'instagram');assert.equal(a.landing_path,'/advertise/');assert.equal(a.page_url,'https://semologo.com/advertise/');assert.equal(a.referrer,'https://example.com/post');assert.ok(!('password' in a));});
test('mail failure preserves inquiry and retry skips the successful recipient; fake transport only',async()=>{
 let stored={...base,email_results:{}};let final;const sent=[];
 const db={query:async(sql,args)=>{if(sql.includes('RETURNING'))return {rowCount:1,rows:[stored]};if(sql.includes('email_status=$2')){final=args[1];stored.email_results=JSON.parse(args[2]);}else if(sql.includes('email_results=$2'))stored.email_results=JSON.parse(args[1]);return {rowCount:1,rows:[]};}};
 let fails=true;const factory=()=>({sendMail:async x=>{sent.push(x.to);if(x.to==='two@example.com'&&fails)throw Error('fake failure');return {accepted:[x.to]};},close:()=>{}});
 const env={SEMOLOGO_INQUIRY_TO:'one@example.com,two@example.com',POSTAL_SMTP_USER:'fake',POSTAL_SMTP_PASSWORD:'fake',SEMOLOGO_INQUIRY_FROM:'robot@example.com'};
 await deliverInquiry(db,factory,env,base.id);assert.equal(final,'failed');fails=false;await deliverInquiry(db,factory,env,base.id);assert.equal(final,'sent');assert.deepEqual(sent,['one@example.com','two@example.com','two@example.com']);
});
