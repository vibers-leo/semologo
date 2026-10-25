"use client";
const KEY='semologo.lead.first_touch';
export function captureLeadAttribution(){
 try{const old=localStorage.getItem(KEY);if(old)return JSON.parse(old) as Record<string,string>;
 const q=new URLSearchParams(location.search);const a:Record<string,string>={landing_path:location.pathname,page_url:location.origin+location.pathname,referrer:document.referrer};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])a[k]=q.get(k)||'';localStorage.setItem(KEY,JSON.stringify(a));return a;
 }catch{const q=new URLSearchParams(location.search);return {landing_path:location.pathname,page_url:location.origin+location.pathname,referrer:document.referrer,utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||'',utm_content:q.get('utm_content')||'',utm_term:q.get('utm_term')||''};}
}
