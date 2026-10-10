"use client";
import { useEffect, useRef, useState } from 'react';
import { measureLogo, opticalFit } from '@/lib/logo-optical-size';

export default function CardLogo({ candidates, priority, alt, failureLabel, retryLabel }: {
  candidates: string[]; priority: boolean; alt: string; failureLabel: string; retryLabel: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(priority);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fit,setFit]=useState<ReturnType<typeof opticalFit>|null>(null);
  const updateFit=()=>{const img=image.current,box=img?.parentElement;if(img?.naturalWidth&&box)setFit(opticalFit(measureLogo(img),box.clientWidth,box.clientHeight));};
  useEffect(()=>{if(!image.current?.parentElement)return;const observer=new ResizeObserver(updateFit);observer.observe(image.current.parentElement);return()=>observer.disconnect();},[]);
  useEffect(() => {
    if (near || !image.current) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '1000px' });
    observer.observe(image.current);
    return () => observer.disconnect();
  }, [near]);
  const candidateKey = candidates.join('|');
  useEffect(() => { setIndex(0); setAttempt(0); setFailed(false); setLoaded(false); }, [candidateKey]);
  useEffect(() => {
    if (!failed || attempt >= 2) return;
    const timer = window.setTimeout(() => { setIndex(0); setAttempt(a => a + 1); setFailed(false); }, 15_000);
    return () => window.clearTimeout(timer);
  }, [failed, attempt]);
  const url = candidates[index] || candidates[0];
  const src = attempt ? `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}` : url;
  return <>
    {/* Start nearby cards early, without requesting the entire growing grid. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={node => {
      image.current = node;
      if (node?.complete && node.naturalWidth > 0) node.dataset.loaded = '1';
    }} src={near ? src : undefined} alt={alt} width={320} height={180} crossOrigin="anonymous"
      style={fit?{width:fit.width,height:fit.height,left:`calc(50% + ${fit.offsetX}px)`,top:`calc(50% + ${fit.offsetY}px)`,right:'auto',bottom:'auto',translate:'-50% -50%'}:undefined}
      decoding="async" loading="eager" fetchPriority={priority ? 'high' : 'auto'}
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
        onClick={event => { event.stopPropagation(); setIndex(0); setAttempt(attempt + 1); setFailed(false); }}>
        {retryLabel}
      </button>
    </div>}
  </>;
}
