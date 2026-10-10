'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

type Wall = { id: string; title: string; updated_at: string };
type PreviewLogo = { id: string; name?: string; file: string; scale?: number; variantKey?: string; cardBackground?: string };
type Preview = { title: string; html: string; image: string; count: number; version: number; settings: unknown; logos: PreviewLogo[] };
const buttonStyle = { border: '1px solid var(--border)', borderRadius: 8, background: '#fff', padding: '8px 12px', cursor: 'pointer', fontSize: 13 };
const englishCopy: Record<string, string> = {"내 로고월": "My logo walls", "새 로고월 만들기": "Create a logo wall", "저장한 로고월을 재생하고, 확대해서 살펴보거나 이미지와 웹 코드를 함께 내려받아요.": "Play and zoom your saved logo walls, or download images and website code together.", "불러오는 중…": "Loading…", "아직 저장한 로고월이 없어요.": "You have no saved logo walls yet.", "미리보기 열기": "Open preview", "로고월 미리보기 닫기": "Close logo wall preview", "HTML 미리보기": "HTML preview", "OG 이미지": "OG image", "일시정지": "Pause", "재생하기": "Play", "확대·축소": "Zoom", "준비 중…": "Preparing…", "ZIP 다운로드": "Download ZIP", "이미지와 HTML 미리보기를 준비하고 있어요…": "Preparing images and HTML preview…", "ZIP에는 로고별 PNG, 1200×630 미리보기 이미지, HTML·CSS·JavaScript와 설정 JSON이 들어 있어요. 모두 압축을 풀고 index.html을 열면 사용할 수 있어요. PNG는 정적 이미지이며 움직임은 HTML에서 재생돼요.": "The ZIP includes logo PNGs, a 1200×630 preview image, HTML, CSS, JavaScript, and settings JSON. Extract every file and open index.html. PNG images are static; animation plays in HTML.", "로고월을 불러오지 못했어요.": "Could not load your logo walls.", "미리보기를 준비하지 못했어요.": "Could not prepare the preview.", "다운로드를 준비하지 못했어요.": "Could not prepare the download.", "다시 시도": "Try again"};
export default function MyLogoWalls({ user, english = false }: { user: User; english?: boolean }) {
  const t = (ko: string) => english ? (englishCopy[ko] || ko) : ko;
  const [walls, setWalls] = useState<Wall[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [selected, setSelected] = useState<Wall | null>(null); const [preview, setPreview] = useState<Preview | null>(null); const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'html' | 'image'>('html'); const [zoom, setZoom] = useState(65); const [playing, setPlaying] = useState(true);
  const [focusedFile,setFocusedFile] = useState<string | null>(null);
  const [scales,setScales] = useState<Record<string,number>>({});
  const changed = Boolean(preview?.logos.some(logo => scales[logo.file] !== undefined && scales[logo.file] !== (logo.scale || 100)));
  const focusedLogo = preview?.logos.find(logo => logo.file === focusedFile);
  const dialog = useRef<HTMLDialogElement>(null); const frame = useRef<HTMLIFrameElement>(null); const generation = useRef(0); const trigger = useRef<HTMLButtonElement | null>(null);
  const headers = useCallback(async () => ({ Authorization: `Bearer ${await user.getIdToken()}` }), [user]);
  useEffect(() => { const abort = new AbortController(); setLoading(true);
    (async () => { try { const response = await fetch('/api/logo-walls/', { headers: await headers(), cache: 'no-store', signal: abort.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '로고월을 불러오지 못했어요.'); setWalls(data.walls); } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : '로고월을 불러오지 못했어요.'); } finally { if (!abort.signal.aborted) setLoading(false); } })(); return () => abort.abort();
  }, [headers]);
  useEffect(() => { if (!selected) return; dialog.current?.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; trigger.current?.focus(); }; }, [selected]);
  const close = () => { if(changed && !window.confirm(english ? 'Discard unsaved size changes?' : '저장하지 않은 크기 변경을 닫을까요?')) return; generation.current++; setSelected(null); setPreview(null); setBusy(false); };
  async function open(wall: Wall, target: HTMLButtonElement) { const current = ++generation.current; trigger.current = target; setSelected(wall); setPreview(null); setError(''); setBusy(true); setView('html'); setScales({}); setFocusedFile(null); setZoom(Math.max(15, Math.min(100, Math.floor(Math.min((Math.min(1440, window.innerWidth * .94) - 32) / 1200, (window.innerHeight * .9 - 230) / 650) * 20) * 5))); setPlaying(true);
    try { const response = await fetch(`/api/logo-walls/export/?id=${encodeURIComponent(wall.id)}&format=preview`, { headers: await headers(), cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '미리보기를 준비하지 못했어요.'); if (current === generation.current) setPreview(data); } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : '미리보기를 준비하지 못했어요.'); } finally { if (current === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if(event.source !== frame.current?.contentWindow || event.data?.type !== 'semologo-wall-select') return;
      if(preview?.logos.some(logo => logo.file === event.data.file)) setFocusedFile(event.data.file);
    };
    window.addEventListener('message',listener); return () => window.removeEventListener('message',listener);
  },[preview]);
  useEffect(()=>{ if(focusedFile)frame.current?.contentWindow?.postMessage({type:'semologo-wall-focus',file:focusedFile},'*'); },[focusedFile]);
  function changeScale(file: string,scale: number) {
    setScales(s=>({...s,[file]:scale}));
    frame.current?.contentWindow?.postMessage({type:'semologo-wall-scale',file,scale},'*');
  }
  async function saveSizes() {
    if(!selected || !preview || !changed) return;
    const wall=selected; const requestGeneration=generation.current; setBusy(true);setError('');
    try {
      const response=await fetch(`/api/logo-walls/?id=${encodeURIComponent(wall.id)}`,{method:'PUT',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({title:preview.title,version:preview.version,settings:preview.settings,items:preview.logos.map(logo=>({brandId:logo.id,variantKey:logo.variantKey,scale:scales[logo.file]??logo.scale??100,cardBackground:logo.cardBackground}))})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'크기를 저장하지 못했어요.');
      if(requestGeneration!==generation.current)return; setScales({}); await open(wall,trigger.current!);
    } catch(e) {setError(e instanceof Error?e.message:'크기를 저장하지 못했어요.');} finally{setBusy(false);}
  }
  function play() { const next = !playing; setPlaying(next); frame.current?.contentWindow?.postMessage({ type: 'semologo-wall-play', playing: next }, '*'); }
  async function download() { if (!selected) return; setBusy(true); setError(''); try { const response = await fetch(`/api/logo-walls/export/?id=${encodeURIComponent(selected.id)}`, { headers: await headers(), cache: 'no-store' }); if (!response.ok) { const data = await response.json(); throw new Error(data.error || '다운로드를 준비하지 못했어요.'); } const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = `logo-wall-${selected.id}.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); } catch (e) { setError(e instanceof Error ? e.message : '다운로드를 준비하지 못했어요.'); } finally { setBusy(false); } }
  return <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>{t('내 로고월')}</h2><a href="/logo-walls/" style={{ fontSize: 13 }}>{t('새 로고월 만들기')}</a></div>
    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t('저장한 로고월을 재생하고, 확대해서 살펴보거나 이미지와 웹 코드를 함께 내려받아요.')}</p>
    {loading ? <p role="status">{t('불러오는 중…')}</p> : !walls.length ? <p style={{ fontSize: 13 }}>{t('아직 저장한 로고월이 없어요.')}</p> : <div style={{ display: 'grid', gap: 8 }}>{walls.map(wall => <button key={wall.id} style={{ ...buttonStyle, textAlign: 'left' }} onClick={e => open(wall, e.currentTarget)}>{wall.title}<span style={{ display: 'block', fontSize: 11, color: '#71717a', marginTop: 4 }}>{t('미리보기 열기')} · {new Date(wall.updated_at).toLocaleDateString(english ? 'en-US' : 'ko-KR')}</span></button>)}</div>}
    {!selected && error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{t(error)}</p>}
    {selected && <dialog ref={dialog} aria-labelledby="my-wall-title" onCancel={e => { e.preventDefault(); close(); }} style={{ position: 'fixed', inset: 0, margin: 'auto', width: 'min(1440px,94vw)', maxWidth: '94vw', height: 'min(900px,90dvh)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #d4d4d8', borderRadius: 16, padding: 0 }}>
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 id="my-wall-title" style={{ fontSize: 18, margin: 0 }}>{selected.title}</h2><button style={buttonStyle} aria-label={t('로고월 미리보기 닫기')} onClick={close}>✕</button></div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><button style={buttonStyle} aria-pressed={view === 'html'} onClick={() => setView('html')}>{t('HTML 미리보기')}</button><button style={buttonStyle} disabled={changed} aria-pressed={view === 'image'} onClick={() => setView('image')}>{t('OG 이미지')}</button><button style={buttonStyle} disabled={!preview || view !== 'html'} onClick={play}>{t(playing ? '일시정지' : '재생하기')}</button><label style={{ fontSize: 12 }}>{t('확대·축소')} <input type="range" min="15" max="150" step="5" value={zoom} onChange={e => setZoom(Number(e.target.value))} /> {zoom}%</label><button style={buttonStyle} disabled={busy || !preview || changed} onClick={download}>{t(busy ? '준비 중…' : 'ZIP 다운로드')}</button></div>
      {preview && view === 'html' && <div style={{padding:'0 16px 12px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:10}}>
        <label style={{fontSize:13}}>{english?'Logo':'개별 로고'} <select aria-label={english?'Select logo':'크기 조절할 로고 선택'} value={focusedFile||''} onChange={e=>setFocusedFile(e.target.value)}><option value="">{english?'Select a logo':'로고를 선택하세요'}</option>{preview.logos.map((logo,index)=><option key={logo.file} value={logo.file}>{index+1}. {logo.name||logo.id}</option>)}</select></label>
        {focusedLogo && <><label style={{fontSize:13}}>{english?'Size':'로고 크기'} <input aria-label="선택한 로고 크기" type="range" min="50" max="200" step="5" disabled={busy} value={scales[focusedLogo.file]??focusedLogo.scale??100} onChange={e=>changeScale(focusedLogo.file,Number(e.target.value))}/> {scales[focusedLogo.file]??focusedLogo.scale??100}%</label><button style={buttonStyle} disabled={busy} onClick={()=>changeScale(focusedLogo.file,100)}>{english?'Reset':'초기화'}</button></>}
        <button style={buttonStyle} disabled={!changed||busy} onClick={saveSizes}>{english?'Save sizes':'크기 변경 저장'}</button><span style={{fontSize:12,color:'#71717a'}}>{changed?(english?'Save to update the OG image and ZIP.':'저장하면 OG 이미지와 ZIP에도 적용돼요.'):(english?'Click a logo in the preview to resize it.':'미리보기에서 로고를 눌러 크기를 조절해요.')}</span>
      </div>}
      {preview && error && <p role="alert" style={{ padding: '0 16px', color: '#b91c1c', fontSize: 13 }}>{t(error)}</p>}
      {!preview && error && !busy && <button style={{ ...buttonStyle, margin: '0 16px 12px' }} onClick={e => open(selected, trigger.current || e.currentTarget)}>{t('다시 시도')}</button>}
      <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0, background: '#f4f4f5', padding: 16 }}>{!preview ? <p role={error ? 'alert' : 'status'}>{t(error || '이미지와 HTML 미리보기를 준비하고 있어요…')}</p> : <div style={{ width: 1200 * zoom / 100, height: (view === 'image' ? 630 : 650) * zoom / 100, margin: 'auto' }}>{view === 'html' ? <iframe ref={frame} title={`${preview.title} ${t('HTML 미리보기')}`} sandbox="allow-scripts" srcDoc={preview.html} onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'semologo-wall-play', playing }, '*')} style={{ width: 1200, height: 650, border: 0, transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }} /> : <img src={preview.image} alt={`${preview.title} 1200×630 OG 미리보기`} style={{ width: '100%', height: 'auto' }} />}</div>}</div>
      <p style={{ padding: '0 16px', fontSize: 12, lineHeight: 1.7, color: '#71717a' }}>{t('ZIP에는 로고별 PNG, 1200×630 미리보기 이미지, HTML·CSS·JavaScript와 설정 JSON이 들어 있어요. 모두 압축을 풀고 index.html을 열면 사용할 수 있어요. PNG는 정적 이미지이며 움직임은 HTML에서 재생돼요.')}</p>
    </dialog>}
  </section>;
}
