export async function deliverInquiry(db,createTransport,env,id){
 const row=await db.query("UPDATE semologo.ad_inquiries SET email_status='sending',updated_at=now() WHERE id=$1 AND (email_status IN ('pending','failed') OR (email_status='sending' AND updated_at<now()-interval '5 minutes')) RETURNING id,name,company,email,kind,message,email_results",[id]);
 if(!row.rowCount)return;const x=row.rows[0];
 const recipients=(env.SEMOLOGO_INQUIRY_TO||'').split(',').map(s=>s.trim()).filter(Boolean);
 const results={...x.email_results};
 if(!recipients.length||!env.POSTAL_SMTP_USER||!env.POSTAL_SMTP_PASSWORD||!env.SEMOLOGO_INQUIRY_FROM){await db.query("UPDATE semologo.ad_inquiries SET email_status='failed',email_results=$2::jsonb,updated_at=now() WHERE id=$1",[id,JSON.stringify({...results,configuration:'missing'})]);return;}
 const transport=createTransport({host:env.POSTAL_SMTP_HOST||'smtp.vibers.co.kr',port:Number(env.POSTAL_SMTP_PORT||587),secure:false,requireTLS:true,auth:{user:env.POSTAL_SMTP_USER,pass:env.POSTAL_SMTP_PASSWORD},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000});
 try{for(const recipient of recipients){if(results[recipient]==='sent')continue;try{
 const sent=await transport.sendMail({from:env.SEMOLOGO_INQUIRY_FROM,to:recipient,replyTo:x.email,subject:`[세모로고 광고문의] ${x.kind} · ${x.company||x.name}`,text:`문의번호: ${id}\n담당자: ${x.name}\n회사: ${x.company||'-'}\n답변 주소: ${x.email}\n유형: ${x.kind}\n\n${x.message}\n\n관리자 문의함에서 처리 상태를 관리해 주세요.`});results[recipient]=sent.accepted?.length?'sent':'failed';
 }catch{results[recipient]='failed';}
 await db.query("UPDATE semologo.ad_inquiries SET email_results=$2::jsonb,updated_at=now() WHERE id=$1",[id,JSON.stringify(results)]);}
 await db.query("UPDATE semologo.ad_inquiries SET email_status=$2,email_results=$3::jsonb,updated_at=now() WHERE id=$1",[id,recipients.every(r=>results[r]==='sent')?'sent':'failed',JSON.stringify(results)]);
 }finally{transport.close();}
}
