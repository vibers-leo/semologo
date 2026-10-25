export const inquiryKinds=['배너 광고','숏폼 광고','스폰서십','제휴','기타'];
export function validateInquiry(x){
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 if(!x||typeof x!=='object')throw Error('문의 내용을 확인해 주세요.');
 if(x.website)throw Error('문의 내용을 확인해 주세요.');
 const name=text(x.name,81),company=text(x.company,121),email=text(x.email,255),message=text(x.message,5001),kind=text(x.kind,30);
 if(!name||name.length>80)throw Error('담당자 이름을 80자 이내로 적어 주세요.');
 if(company.length>120)throw Error('회사 이름을 120자 이내로 적어 주세요.');
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||/[\r\n]/.test(email))throw Error('답변받을 이메일 주소를 확인해 주세요.');
 if(message.length<10||message.length>5000)throw Error('문의 내용을 10~5,000자로 적어 주세요.');
 if(!inquiryKinds.includes(kind))throw Error('문의 유형을 골라 주세요.');
 if(x.consent!==true)throw Error('문의 처리를 위한 개인정보 수집에 동의해 주세요.');
 if(typeof x.id!=='string'||!/^([a-f0-9]{8}-){1}[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x.id))throw Error('페이지를 새로고침한 뒤 다시 보내 주세요.');
 const attribution={};const a=x.attribution||{};
 for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])attribution[k]=text(a[k],100);
 for(const k of ['referrer','landing_path','page_url']){try{const u=new URL(text(a[k],1500),'https://semologo.com');attribution[k]=k==='referrer'?u.origin+u.pathname:k==='landing_path'?u.pathname:u.origin+u.pathname;}catch{attribution[k]='';}}
 return {id:x.id,name,company,email,kind,message,attribution};
}
