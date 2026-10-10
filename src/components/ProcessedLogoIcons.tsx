'use client';
import { useEffect, useState } from 'react';
interface Props { brandId:string; onDownload:(url:string,filename:string)=>void|Promise<void>; }
export default function ProcessedLogoIcons({brandId,onDownload}:Props){
  const [open,setOpen]=useState(false);const [attempt,setAttempt]=useState(0);const [state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');const [color,setColor]=useState<string|null>(null);const [custom,setCustom]=useState(false);const [downloading,setDownloading]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{setOpen(false);setState('idle');setColor(null);setCustom(false);setError('');},[brandId]);
  useEffect(()=>{
    if(!open||state!=='idle')return;let alive=true;const controller=new AbortController();setState('loading');
    fetch(`/api/processed-logo-icon/?id=${encodeURIComponent(brandId)}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!alive)return;if(!response.ok||!data.available){setError(data.error||'이 로고는 자동 가공을 지원하지 않아요.');setState('unavailable');return;}setColor(data.color);setState('ready');}).catch(()=>{if(alive){setError('아이콘을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');setState('unavailable');}});
    return()=>{alive=false;controller.abort();};
    // State is changed inside the request; only opening/retrying starts another request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,brandId,attempt]);
  function url(shape:'circle'|'square',format:'png'|'svg') {return `/api/processed-logo-icon/?${new URLSearchParams({id:brandId,shape,format,color:color||'',retry:String(attempt)})}`;}
  async function download(shape:'circle'|'square',format:'png'|'svg'){
    setDownloading(true);setError('');
    try{
      const response=await fetch(url(shape,format));const expected=format==='svg'?'image/svg+xml':'image/png';
      if(!response.ok||!response.headers.get('content-type')?.startsWith(expected))throw new Error('unavailable');
      const blob=await response.blob();if(!blob.size||blob.size>3_000_000)throw new Error('invalid');
      const object=URL.createObjectURL(blob);
      try{await onDownload(object,`${brandId}-processed-${shape}.${format}`);}finally{setTimeout(()=>URL.revokeObjectURL(object),60_000);}
    }catch{setError('아이콘을 내려받지 못했어요. 잠시 후 다시 시도해 주세요.');}
    finally{setDownloading(false);}
  }
  return <section aria-label="가공 아이콘" style={{margin:'24px 0',border:'1px solid #e4e4e7',borderRadius:12,padding:14}}>
    <button type="button" onClick={()=>{if(open&&state==='loading')setState('idle');setOpen(v=>!v);}} aria-expanded={open} style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'none',border:0,padding:0,fontWeight:700,fontSize:13,textAlign:'left',cursor:'pointer'}}><span aria-hidden>{open?'▾':'▸'}</span>가공 아이콘 <span style={{fontSize:10,fontWeight:500,color:'#6366f1',background:'#eef2ff',borderRadius:6,padding:'2px 6px'}}>편집본</span></button>
    {open&&<div style={{marginTop:12}}>
      <p style={{fontSize:12,color:'#71717a',lineHeight:1.6,margin:'0 0 12px'}}>원본 벡터를 흰색으로 편집하고 배경을 더한 아이콘이에요. 공식 제공 파일과 구분해 사용해 주세요.</p>
      {state==='loading'&&<p role="status" style={{fontSize:12}}>원본 벡터를 확인하고 있어요.</p>}
      {state==='unavailable'&&<div><p role="status" style={{fontSize:12,color:'#71717a'}}>{error}</p><button type="button" className="logo-candidate-vote" onClick={()=>{setError('');setState('idle');setAttempt(v=>v+1);}}>다시 시도</button></div>}
      {state==='ready'&&<>
        <label style={{display:'flex',alignItems:'center',gap:9,fontSize:12,marginBottom:14}}>배경색 <input aria-label="가공 아이콘 배경색" type="color" value={color||'#000000'} onChange={e=>{setColor(e.target.value);setCustom(true);setError('');}} style={{width:34,height:28,padding:1,border:'1px solid #e4e4e7',borderRadius:5}}/><span style={{fontSize:11,color:'#71717a'}}>{color?(custom?'직접 선택한 색':'원본 로고에서 가져온 색'):'배경색을 골라 주세요'}</span>{!color&&<button type="button" className="logo-candidate-vote" onClick={()=>{setColor('#000000');setCustom(true);}}>검정 배경 사용</button>}</label>
        {color&&<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>{(['circle','square'] as const).map(shape=><div key={shape} style={{border:'1px solid #e4e4e7',borderRadius:10,padding:12,textAlign:'center'}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url(shape,'png')} alt={`가공 아이콘 · ${shape==='circle'?'원형':'사각형'}`} width={96} height={96} style={{display:'block',margin:'0 auto 10px',maxWidth:'100%',objectFit:'contain'}} onError={()=>setError('아이콘을 만들지 못했어요. 다른 배경색을 선택하거나 다시 시도해 주세요.')}/>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>{shape==='circle'?'원형':'사각형'} · 가공 아이콘</div>
          <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>{(['svg','png'] as const).map(format=><button key={format} type="button" className="logo-candidate-vote" disabled={Boolean(error)||downloading} onClick={()=>download(shape,format)}>{format.toUpperCase()}{format==='png'?' 1024':''}</button>)}</div>
        </div>)}</div>}
        {error&&<div><p role="status" style={{fontSize:12,color:'#71717a'}}>{error}</p><button type="button" className="logo-candidate-vote" onClick={()=>{setError('');setAttempt(v=>v+1);}}>다시 시도</button></div>}
        <p style={{fontSize:11,color:'#71717a',margin:'12px 0 0',lineHeight:1.5}}>단색 벡터만 지원해요. 여러 색으로 구성된 로고는 원본 형상을 지키기 위해 자동 변환하지 않아요.</p>
      </>}
    </div>}
  </section>;
}
