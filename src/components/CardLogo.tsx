"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { measureLogo, opticalFit } from '@/lib/logo-optical-size';

export default function CardLogo({ candidates, priority, alt, failureLabel, retryLabel }: {
  candidates: string[]; priority: boolean; alt: string; failureLabel: string; retryLabel: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [retryToken, setRetryToken] = useState('');
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fit,setFit]=useState<ReturnType<typeof opticalFit>|null>(null);
  const updateFit=()=>{const img=image.current,box=img?.parentElement;if(img?.naturalWidth&&box)setFit(opticalFit(measureLogo(img),box.clientWidth,box.clientHeight));};
  useEffect(()=>{if(!image.current?.parentElement)return;const observer=new ResizeObserver(updateFit);observer.observe(image.current.parentElement);return()=>observer.disconnect();},[]);
  const restart = useCallback(() => {
    setIndex(0); setAttempt(a => a + 1); setRetryToken(Date.now().toString(36));
    setFailed(false); setLoaded(false); setFit(null);
  }, []);
  const candidateKey = candidates.join('|');
  useEffect(() => { setIndex(0); setAttempt(0); setFailed(false); setLoaded(false); setRetryToken(''); setFit(null); }, [candidateKey]);
  useEffect(() => {
    if (!failed || attempt >= 2) return;
    const timer = window.setTimeout(restart, attempt === 0 ? 2000 : 16000);
    return () => window.clearTimeout(timer);
  }, [failed, attempt, restart]);
  const url = candidates[index] || candidates[0];
  const [base, fragment] = (url || '').split('#', 2);
  const src = attempt ? `${base}${base.includes('?') ? '&' : '?'}retry=${retryToken}${fragment ? '#'+fragment : ''}` : url;
  return <>
    {/* Native lazy loading also works before the client bundle is ready. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={src} ref={node => {
      image.current = node;
      if (node?.complete && node.naturalWidth > 0) node.dataset.loaded = '1';
    }} src={src} alt={alt} width={320} height={180} crossOrigin="anonymous"
      style={{...(fit?{width:fit.width,height:fit.height,left:`calc(50% + ${fit.offsetX}px)`,top:`calc(50% + ${fit.offsetY}px)`,right:'auto',bottom:'auto',translate:'-50% -50%'}:{}), visibility: failed ? 'hidden' : undefined}}
      decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? 'high' : 'auto'}
      data-loaded={loaded ? '1' : undefined}
      onLoad={() => { updateFit(); setLoaded(true); setFailed(false); }}
      onError={() => {
        setLoaded(false);
        if (index + 1 < candidates.length) setIndex(index + 1);
        else setFailed(true);
      }} />
    {failed && <div className="card-fallback" style={{ position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 12, color: '#71717a' }}>
      <span>{failureLabel}</span>
      <button type="button" style={{ textDecoration: 'underline', cursor: 'pointer' }}
        onClick={event => { event.stopPropagation(); restart(); }}>
        {retryLabel}
      </button>
    </div>}
  </>;
}
