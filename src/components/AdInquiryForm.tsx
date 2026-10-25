"use client";
import {useState} from 'react';
import {trackEvent} from '@/lib/analytics';
import {captureLeadAttribution} from '@/lib/lead-attribution';
import {inquiryKinds} from '@/lib/ad-inquiry-input.mjs';
export default function AdInquiryForm(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[id,setId]=useState('');
 async function submit(form:HTMLFormElement){setBusy(true);setError('');try{const data=new FormData(form);const key=id||crypto.randomUUID();setId(key);const payload={id:key,name:data.get('name'),company:data.get('company'),email:data.get('email'),kind:data.get('kind'),message:data.get('message'),website:data.get('website'),consent:data.get('consent')==='on',attribution:captureLeadAttribution()};
 const r=await fetch('/api/ad-inquiries/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw Error(result.error||'문의 접수를 완료하지 못했어요. 다시 시도해 주세요.');setReceipt(result.id);trackEvent('generate_lead',{lead_id:result.id,inquiry_type:'advertising'});
 }catch(e){setError(e instanceof Error?e.message:'지금 연결하지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}
 if(receipt)return <section role="status" className="rounded-2xl border border-indigo-100 bg-indigo-50 p-7"><h2 className="text-xl font-bold">문의를 접수했어요.</h2><p className="mt-3 leading-7">내용을 확인하고 남겨주신 이메일로 답변할게요.</p><p className="mt-4 break-all text-xs text-gray-500">접수번호 {receipt}</p><a href="/" className="mt-6 inline-block font-bold text-indigo-600">로고 찾으러 가기 →</a></section>;
 return <form className="space-y-5" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget);}}><fieldset disabled={busy} className="space-y-5">
 <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">담당자 이름<input name="name" required maxLength={80} autoComplete="name" className="mt-2 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">회사·브랜드 · 선택<input name="company" maxLength={120} autoComplete="organization" className="mt-2 w-full rounded-xl border p-3 font-normal"/></label></div>
 <label className="block text-sm font-bold">답변받을 이메일<input type="email" name="email" required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
 <label className="block text-sm font-bold">문의 유형<select name="kind" className="mt-2 w-full rounded-xl border p-3 font-normal">{inquiryKinds.map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="block text-sm font-bold">문의 내용<textarea name="message" rows={7} required minLength={10} maxLength={5000} className="mt-2 w-full rounded-xl border p-3 font-normal leading-7" placeholder="소개할 브랜드와 원하시는 광고 방식·일정을 알려 주세요."/></label>
 <div aria-hidden="true" className="absolute -left-[10000px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <div className="rounded-xl bg-gray-50 p-4 text-xs leading-6 text-gray-600">문의 답변을 위해 이름·이메일·회사명(선택)·문의 내용과 유입 경로를 수집해요. 접수일부터 1년간 보관 후 삭제해요. 동의하지 않으면 문의를 접수할 수 없어요.</div>
 <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1"/>개인정보 수집·이용에 동의해요.</label>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<button type="submit" className="rounded-xl bg-indigo-600 px-7 py-3 font-bold text-white">{busy?'접수 중…':'광고문의 보내기'}</button>
 </fieldset></form>;
}
