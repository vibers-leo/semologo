'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { CATALOG_VERSION } from '@/lib/cdn';
import { logoPngCandidates } from '@/lib/logo-png-source';
import { initialWallScale } from '@/lib/logo-optical-size';
import { applyQualityReview } from '@/lib/logo-quality-review';
import { fetchVariants, type Brand } from '@/lib/brands';
import { wallVariant, wallLogoKey, wallFormLabels, type WallLogo } from '@/lib/logo-wall-variant';
import Header from '@/components/Header';
import { logoWallLayout, defaultLogoWallLayout, logoWallMetrics, wallCardBackground, wallStageBackground, type CardBackground, type LogoWallLayout } from '@/lib/logo-wall-layout';
import styles from './LogoWallEditor.module.css';

type Layout = LogoWallLayout;
const defaultLayout = defaultLogoWallLayout;
type Wall = { id: string; title: string; version: number; settings?: Layout };
type Item = { brand_id: string; asset_snapshot: { scale?: number; variant_key?: string; variant_label?: string; card_background?: CardBackground; name?: string; logo_png?: string | boolean; preview_png?: string; logo_svg?: string; has_png?: boolean; light?: boolean; user_logo_id?: string } };
type SearchLogoProps = { brand: WallLogo; src: string; large?: boolean; background?: string };
function SearchLogo(props: SearchLogoProps) {
  return <SearchLogoImage key={`${props.brand.id}:${props.src}`} {...props} />;
}
function SearchLogoImage({ brand, src, large = false, background }: SearchLogoProps) {
  const [failed, setFailed] = useState(false);
  const [candidate, setCandidate] = useState(0);
  const candidates = brand.variantKey ? [src] : [...new Set([src, ...logoPngCandidates(brand)])];
  return <span style={{ width: large ? '100%' : 80, height: large ? 'calc(var(--logo-height, 80px) + 48px)' : 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: background ?? (brand.light || brand.light_logo || brand.dark_variant === 'white' ? '#18181b' : '#f4f4f5') }}>
    {failed ? <span style={{ fontSize: 11, color: '#71717a' }}>미리보기 없음</span> : <img draggable={false} src={candidates[candidate]} alt={large ? brand.name_ko : ''} width={large ? 240 : 80} height={large ? 100 : 48} decoding="async" style={{ width: large ? '85%' : 72, height: large ? 'var(--logo-height, 80px)' : 40, objectFit: 'contain', maxWidth: large ? `${100 / ((brand.scale || 100) / 100)}%` : undefined, maxHeight: large ? `calc((var(--logo-height, 80px) + 48px) / ${(brand.scale || 100) / 100})` : undefined, transform: large ? `scale(${(brand.scale || 100) / 100})` : undefined, transformOrigin: 'center' }} onError={() => candidate + 1 < candidates.length ? setCandidate(candidate + 1) : setFailed(true)} />}
  </span>;
}
export default function LogoWallEditor() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [current, setCurrent] = useState<Wall | null>(null);
  const [title, setTitle] = useState('새 로고월');
  const [selected, setSelected] = useState<WallLogo[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WallLogo[]>([]);
  const [expanded, setExpanded] = useState<Record<string, WallLogo[]>>({});
  const [expanding, setExpanding] = useState<string | null>(null);
  const [formFilter, setFormFilter] = useState('all');
  const [focused, setFocused] = useState<string | null>(null);
  const resizing = useRef<{ key: string; pointer: number; x: number; y: number; scale: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [myLogos, setMyLogos] = useState<Brand[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const blobUrls = useRef<string[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [presentation, setPresentation] = useState(false);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState('');
  const [searching, setSearching] = useState(false);
  const drag = useRef<{ id: string; pointer: number; x: number; y: number; target: string | null; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  function stopDrag() { drag.current = null; setDragging(null); setDropTarget(null); }
  function startDrag(e: PointerEvent<HTMLElement>, id: string) {
    setFocused(id);
    if (busy || selected.length < 2 || !e.isPrimary || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, target: null, moved: false };
  }
  function dragMove(e: PointerEvent<HTMLElement>) {
    const item = drag.current;
    if (!item || item.pointer !== e.pointerId) return;
    if (!item.moved && Math.hypot(e.clientX - item.x, e.clientY - item.y) < 5) return;
    item.moved = true; setDragging(item.id);
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-logo-wall-item]');
    const inWall = hit?.closest('[data-logo-wall]') === e.currentTarget.closest('[data-logo-wall]');
    item.target = inWall ? hit?.dataset.logoWallItem ?? null : null;
    setDropTarget(item.target === item.id ? null : item.target);
    if (e.clientY > window.innerHeight - 48) window.scrollBy(0, 12);
    else if (e.clientY < 100) window.scrollBy(0, -12);
  }
  function endDrag(e: PointerEvent<HTMLElement>) {
    const item = drag.current;
    if (!item || item.pointer !== e.pointerId) return;
    if (item.moved && item.target && item.target !== item.id && !busy) {
      setSelected(items => {
        const from = items.findIndex(b => wallLogoKey(b) === item.id);
        const to = items.findIndex(b => wallLogoKey(b) === item.target);
        if (from < 0 || to < 0) return items;
        const next = [...items]; const [brand] = next.splice(from, 1); next.splice(to, 0, brand); return next;
      });
      setMessage('순서를 바꿨어요. 저장하면 다음에도 이 순서로 보여요.');
    }
    stopDrag();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const fingerprint = JSON.stringify({ title, ids: selected.map(b => [wallLogoKey(b), b.cardBackground, b.scale || 100]), layout });
  const dirty = fingerprint !== (saved || JSON.stringify({ title: '새 로고월', ids: [], layout: defaultLayout }));
  const canSwitch = () => !dirty || window.confirm('저장하지 않은 변경사항이 있어요. 다른 로고월로 이동할까요?');
  const reset = () => { setPresentation(false); setPaused(false); setFocused(null); setCurrent(null); setTitle('새 로고월'); setSelected([]); setLayout(defaultLayout); setSaved(''); setMessage(''); };
  function setLogoScale(key: string, scale: number) { setSelected(s => s.map(b => wallLogoKey(b) === key ? { ...b, scale: Math.max(50, Math.min(200, Math.round(scale))) } : b)); }
  function startResize(e: PointerEvent<HTMLElement>, b: WallLogo) {
    e.stopPropagation(); if (busy || !e.isPrimary || e.button !== 0) return;
    const key = wallLogoKey(b); setFocused(key); setDragging(key);
    resizing.current = { key, pointer: e.pointerId, x: e.clientX, y: e.clientY, scale: b.scale || 100 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function resizeMove(e: PointerEvent<HTMLElement>) {
    const r = resizing.current; if (r && r.pointer === e.pointerId) setLogoScale(r.key, r.scale + ((e.clientX - r.x) + (e.clientY - r.y)) * .35);
  }
  function stopResize() { resizing.current = null; setDragging(null); }
  async function autoFit() {
    await run(async () => {
      const measured = await Promise.all(selected.map(async b => {
        const img = new Image(); img.crossOrigin = 'anonymous'; img.src = preview(b);
        try { await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))]); }
        catch { img.removeAttribute('crossorigin'); try { await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))]); } catch { return { b, area: 0, maxScale: 100 }; } }
        const c = document.createElement('canvas'); c.width = 160; c.height = 160;
        const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return { b, area: 0, maxScale: 100 };
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = ratio > 1 ? 160 : 160 * ratio, h = ratio > 1 ? 160 / ratio : 160;
        ctx.drawImage(img, (160-w)/2, (160-h)/2, w, h);
        let left = 160, right = 0, top = 160, bottom = 0;
        try {
          const pixels = ctx.getImageData(0, 0, 160, 160).data;
          for (let y=0; y<160; y++) for (let x=0; x<160; x++) { const n=(y*160+x)*4;
            if (pixels[n+3] > 40 && !(pixels[n]>245 && pixels[n+1]>245 && pixels[n+2]>245 && !b.light)) { left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y); }
          }
        } catch { left=(160-w)/2;right=left+w;top=(160-h)/2;bottom=top+h; }
        if (right <= left || bottom <= top) { left=(160-w)/2;right=left+w;top=(160-h)/2;bottom=top+h; }
        const box = document.querySelector<HTMLElement>(`[data-logo-wall-item="${CSS.escape(wallLogoKey(b))}"]`);
        const availableW = Math.max(80, box?.clientWidth || 200) * .85;
        const availableH = logoWallMetrics.logoSize[layout.logoSize];
        const fit = Math.min(availableW/img.naturalWidth, availableH/img.naturalHeight);
        const visibleW = (right-left)/w * img.naturalWidth * fit, visibleH = (bottom-top)/h * img.naturalHeight * fit;
        return { b, area: visibleW*visibleH, maxScale: Math.min(200, availableW/visibleW*100, (availableH+24)/visibleH*100) };
      }));
      const areas = measured.filter(m => m.area > 0).map(m => m.area).sort((a,b)=>a-b);
      const target = areas[Math.floor(areas.length/2)] || 0;
      setSelected(items => items.map(b => { const m=measured.find(m=>wallLogoKey(m.b)===wallLogoKey(b)); return m?.area && target ? { ...b, scale: Math.round(Math.max(50, Math.min(m.maxScale, 100*Math.sqrt(target/m.area)))) } : b; }));
      setMessage('로고의 그림 영역과 비율을 기준으로 크기를 맞췄어요. 모서리나 크기 슬라이더로 더 다듬어 보세요.');
    });
  }
  useEffect(() => onAuthStateChanged(getClientAuth(), u => {
    setUser(u); setReady(true); setPresentation(false); setPaused(false); setTitle('새 로고월'); setUploadName(''); setUploadFile(null); setQuery(''); setWalls([]); setCurrent(null); setSelected([]); setLayout(defaultLayout); setSaved('');
  }), []);
  async function api(method = 'GET', id?: string, body?: unknown) {
    if (!user) throw new Error('로그인 후 이용해 주세요.');
    const response = await fetch(`/api/logo-walls/${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '요청을 완료하지 못했어요.');
    return data;
  }
  async function personal(id?: string, body?: FormData) {
    if (!user) throw new Error('로그인 후 이용해 주세요.');
    const r = await fetch(`/api/my-logos/${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body, cache: 'no-store' });
    if (!r.ok) throw new Error((await r.json()).error || '로고를 불러오지 못했어요.');
    return r;
  }
  async function privateBrand(id: string, name: string): Promise<Brand> {
    const logo_png = URL.createObjectURL(await (await personal(id)).blob()); blobUrls.current.push(logo_png);
    return { id, name_ko: name, name_en: '', category: '', logo_png } as Brand;
  }
  useEffect(() => {
    let active = true;
    setMyLogos([]);
    if (user) personal().then(r => r.json()).then(async d => {
      const logos = await Promise.all(d.logos.map((l: { id: string; name: string }) => privateBrand(l.id, l.name)));
      if (active) setMyLogos(logos);
    }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; blobUrls.current.forEach(URL.revokeObjectURL); blobUrls.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  async function upload() {
    if (!uploadFile || !uploadName.trim()) return;
    await run(async () => {
      const form = new FormData(); form.set('name', uploadName.trim()); form.set('file', uploadFile);
      const d = await (await personal(undefined, form)).json();
      const brand = await privateBrand(d.logo.id, d.logo.name);
      setMyLogos(s => s.some(b => b.id === brand.id) ? s : [...s, brand]);
      setSelected(s => s.some(b => b.id === brand.id) || s.length >= 100 ? s : [...s, brand]);
      setUploadName(''); setUploadFile(null); if (uploadInput.current) uploadInput.current.value = ''; setMessage('등록했어요. 로고월을 저장해 주세요.');
    });
  }
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await task(); } catch (e) { setMessage(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    api().then(d => { if (active) setWalls(d.walls); }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
    // Refresh the list only when the authenticated identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setResults([]); setSearching(true);
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/?q=${encodeURIComponent(query)}&offset=0&limit=12&revision=${CATALOG_VERSION}`, { signal: abort.signal })
        .then(r => { if (!r.ok) throw new Error('검색에 연결할 수 없어요.'); return r.json(); })
        .then(d => { if (!abort.signal.aborted) setResults(d.brands || []); }).catch(e => { if (!abort.signal.aborted) setMessage(e.message); }).finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  useEffect(() => {
    if (!results.length) return;
    let active = true;
    void Promise.all(results.map(async b => {
      const manifest = await fetchVariants(b.id);
      return [b.id, (manifest?.variants || []).map(v => { const logo = wallVariant(b,v); return logo; }).filter((v): v is WallLogo => Boolean(v))] as const;
    })).then(rows => { if (active) setExpanded(v => ({ ...v, ...Object.fromEntries(rows) })); });
    return () => { active = false; };
  }, [results]);
  const preview = (b: WallLogo) => logoPngCandidates(b)[0];
  async function open(w: Wall) {
    if (!canSwitch()) return;
    await run(async () => {
      const d = await api('GET', w.id);
      const items: WallLogo[] = await Promise.all(d.wall.items.map(async (i: Item) => {
        const snap = i.asset_snapshot;
        const base = snap.user_logo_id ? await privateBrand(snap.user_logo_id, snap.name || '내 로고') : {
          id: i.brand_id, name_ko: snap.name || i.brand_id, name_en: '', category: '', logo_png: snap.logo_png,
          preview_png: snap.preview_png, logo_svg: snap.logo_svg, has_png: snap.has_png, light: snap.light,
        } as Brand;
        return { ...(snap.variant_key ? base : applyQualityReview(base)), variantKey: snap.variant_key, variantLabel: snap.variant_label, scale: snap.scale || 100, cardBackground: snap.card_background };
      }));
      const settings = logoWallLayout(d.wall.settings);
      setFocused(null); setCurrent(d.wall); setTitle(d.wall.title); setSelected(items); setLayout(settings);
      setSaved(JSON.stringify({ title: d.wall.title, ids: items.map(b => [wallLogoKey(b), b.cardBackground, b.scale || 100]), layout: settings }));
    });
  }
  async function download() {
    if (!current || dirty || !user) return;
    await run(async () => {
      const response = await fetch(`/api/logo-walls/export/?id=${encodeURIComponent(current.id)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
      if (!response.ok) { const error = await response.json(); throw new Error(`${error.error}${Array.isArray(error.details) ? ` (${error.details.join(', ')})` : ''}`); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `logo-wall-${current.id}.zip`; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000); setMessage('PNG·설정·독립 미리보기를 ZIP으로 내려받았어요.');
    });
  }
  async function save() {
    await run(async () => {
      const d = await api(current ? 'PUT' : 'POST', current?.id, { title, items: selected.map(b => ({ brandId: b.id, variantKey: b.variantKey, cardBackground: b.cardBackground || 'inherit', scale: b.scale || 100 })), version: current?.version, settings: layout });
      setCurrent(d.wall); setTitle(d.wall.title);
      setSaved(JSON.stringify({ title: d.wall.title, ids: selected.map(b => [wallLogoKey(b), b.cardBackground, b.scale || 100]), layout }));
      setWalls((await api()).walls); setMessage('저장했어요.');
    });
  }
  async function expandBrand(b: Brand) {
    if (expanded[b.id]) { setExpanded(v => { const next = { ...v }; delete next[b.id]; return next; }); return; }
    setExpanding(b.id);
    try {
      const manifest = await fetchVariants(b.id);
      const variants = (manifest?.variants || []).map(v => wallVariant(b, v)).filter((v): v is WallLogo => Boolean(v));
      setExpanded(v => ({ ...v, [b.id]: variants }));
      if (!variants.length) setMessage('이 브랜드는 기본 로고만 준비돼 있어요.');
    } finally { setExpanding(null); }
  }
  function addLogo(b: WallLogo) {
    setSelected(s => s.length >= 100 || s.some(v => wallLogoKey(v) === wallLogoKey(b)) ? s : [...s, b]);
    if(b.scale===undefined)void initialWallScale(preview(b)).then(scale=>setSelected(s=>s.map(v=>wallLogoKey(v)===wallLogoKey(b)&&v.scale===undefined?{...v,scale}:v)));
  }
  function setCardBackground(key: string, background: CardBackground) { setSelected(s => s.map(b => wallLogoKey(b) === key ? { ...b, cardBackground: background } : b)); }
  const cardBackground = (b: WallLogo) => wallCardBackground(layout, Boolean(b.light || b.light_logo || b.dark_variant === 'white'), b.cardBackground);
  return <><Header /><main className={styles.page} style={{ '--wall-columns': layout.columns, '--logo-height': `${logoWallMetrics.logoSize[layout.logoSize]}px`, '--wall-gap': `${logoWallMetrics.spacing[layout.spacing]}px` } as CSSProperties}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>MY LOGO WALL</span><h1>로고를 모아, 나만의 로고월로.</h1><p>브랜드를 고르고 배치를 조정해 보세요. 만든 로고월은 내 계정에 저장돼요.</p></div>
      {user && <button className={styles.primary} disabled={busy || !title.trim() || !selected.length} onClick={save}>{busy ? '처리 중…' : '로고월 저장하기'}</button>}
    </div>
    {!ready ? <p>로그인을 확인하고 있어요.</p> : !user ? <a className={styles.primary} href="/login/?next=%2Flogo-walls%2F">로그인하고 로고월 만들기</a> : <>
      <nav className={styles.saved} aria-label="내 로고월 목록"><button disabled={busy} onClick={() => { if (canSwitch()) reset(); }}>＋ 새 로고월</button>{walls.map(w => <button key={w.id} aria-pressed={current?.id === w.id} disabled={busy} onClick={() => open(w)}>{w.title}</button>)}</nav>
      <div className={`${styles.workspace} ${presentation ? styles.presentation : ''}`}>
        <section hidden={presentation} className={styles.library} aria-label="로고 선택">
          <div className={styles.sectionTitle}><h2>1. 로고 선택</h2><span>{selected.length}/100</span></div>
          <label className={styles.field}>브랜드 검색<input placeholder="삼성, 네이버, Nike…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <p className={styles.hint}>가로·세로조합형, 심볼마크, 로고타입을 골라보세요. 같은 브랜드의 여러 형태를 함께 넣을 수 있어요.</p>
          {searching ? <p role="status">로고를 찾고 있어요…</p> : query.trim() && !results.length ? <div className={styles.empty}>검색 결과가 없어요.<br /><a href="/submit/">없는 로고 제보하기 →</a></div> : !query.trim() ? <div className={styles.empty}>함께 보여주고 싶은<br />브랜드 이름을 검색해 보세요.</div> : null}
          <label className={styles.field}>로고 형태<select aria-label="검색 로고 형태" value={formFilter} onChange={e => setFormFilter(e.target.value)}><option value="all">모든 형태</option>{Object.entries(wallFormLabels).map(([form, label]) => <option key={form} value={form}>{label}</option>)}</select></label>
          <div className={styles.results} aria-label="브랜드 검색 결과">{results.map(b => <div key={b.id}>
            {formFilter === 'all' && <button className={styles.result} disabled={busy || selected.length >= 100 || selected.some(s => wallLogoKey(s) === wallLogoKey(b))} onClick={() => addLogo(b)}><SearchLogo brand={b} src={preview(b)} /><span>{b.name_ko}<small>{selected.some(s => wallLogoKey(s) === wallLogoKey(b)) ? '✓ 기본 로고 추가됨' : '＋ 기본 로고 추가'}</small></span></button>}
            <button className={styles.variantToggle} disabled={expanding === b.id} aria-expanded={Boolean(expanded[b.id])} onClick={() => void expandBrand(b)}>{formFilter !== 'all' ? `${b.name_ko} · ` : ''}{expanding === b.id ? '변형을 찾고 있어요…' : expanded[b.id] ? '로고 변형 접기' : '가로·세로·심볼·로고타입 보기'}</button>
            {expanded[b.id]?.filter(v => formFilter === 'all' || v.variantForm === formFilter).map(v => <button key={wallLogoKey(v)} className={styles.result} disabled={busy || selected.length >= 100 || selected.some(s => wallLogoKey(s) === wallLogoKey(v))} onClick={() => addLogo(v)}><SearchLogo brand={v} src={preview(v)} /><span>{v.variantLabel}<small>{selected.some(s => wallLogoKey(s) === wallLogoKey(v)) ? '✓ 추가됨' : '＋ 이 로고 추가'}</small></span></button>)}
            {expanded[b.id] && !expanded[b.id].some(v => formFilter === 'all' || v.variantForm === formFilter) && <p className={styles.hint}>선택한 형태의 변형이 없어요.</p>}
          </div>)}</div>
          <hr style={{ margin: '24px 0', borderColor: '#e4e4e7' }} />
          <h2 style={{ fontSize: 16 }}>내 로고·다른 로고 등록</h2>
          <p className={styles.hint}>올린 PNG는 내 계정에만 보관돼요. 공개 검색이나 CMS 검수 목록에는 자동 등록되지 않아요.</p>
          <label className={styles.field}>로고 이름<input maxLength={120} value={uploadName} onChange={e => setUploadName(e.target.value)} disabled={busy} /></label>
          <label className={styles.field}>PNG 파일 (최대 2MB)<input ref={uploadInput} type="file" accept="image/png" disabled={busy} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} /></label>
          <button disabled={busy || !uploadFile || !uploadName.trim()} onClick={upload}>내 로고에 보관하고 추가</button>
          <p className={styles.hint}>계정당 최대 20개 · <a href="/submit/">공개 등록은 별도로 제보하기 →</a></p>
          <div className={styles.results}>{myLogos.map(b => <button key={b.id} className={styles.result} disabled={busy || selected.length >= 100 || selected.some(s => s.id === b.id)} onClick={() => addLogo(b)}><SearchLogo brand={b} src={preview(b)} /><span>{b.name_ko}</span></button>)}</div>
        </section>
        <section className={styles.editor} aria-label="로고월 편집">
          <div className={styles.sectionTitle}><h2>{presentation ? title : '2. 배치와 미리보기'}</h2><button disabled={!selected.length && !presentation} aria-pressed={presentation} onClick={() => setPresentation(p => !p)}>{presentation ? '편집으로 돌아가기' : '로고월만 보기'}</button><span className={styles.saveState}>{dirty ? '저장하지 않은 변경사항' : current ? '저장됨 · 비공개' : '새 로고월 · 비공개'}</span></div>
          <label hidden={presentation} className={styles.field}>로고월 제목<input maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
          <div hidden={presentation} className={styles.controls}>
            <label>바깥 배경<select aria-label="로고월 배경" value={layout.background} disabled={busy} onChange={e => setLayout(l => ({ ...l, background: e.target.value as Layout['background'] }))}><option value="auto">연회색</option><option value="light">흰색</option><option value="dark">검정</option></select></label>
            <label>카드 배경<select aria-label="카드 배경" value={layout.cardBackground} disabled={busy} onChange={e => setLayout(l => ({ ...l, cardBackground: e.target.value as Layout['cardBackground'] }))}><option value="auto">로고에 맞게</option><option value="white">흰색</option><option value="light">연회색</option><option value="dark">검정</option></select></label>
            <label>한 줄 배치<select aria-label="한 줄 로고 개수" value={layout.columns} disabled={busy} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}>{[2,3,4,6].map(n => <option key={n} value={n}>{n}개</option>)}</select></label>
            <label>움직임<select aria-label="로고월 움직임" value={layout.motion} disabled={busy} onChange={e => { setPaused(false); setLayout(l => ({ ...l, motion: e.target.value as Layout['motion'] })); }}><option value="static">정지</option><option value="marquee">한 방향 마퀴</option><option value="alternating">줄마다 반대 방향 마퀴</option></select></label>
            <label>속도<select aria-label="마퀴 속도" value={layout.speed} disabled={busy || layout.motion === 'static'} onChange={e => setLayout(l => ({ ...l, speed: e.target.value as Layout['speed'] }))}><option value="slow">천천히</option><option value="normal">보통</option><option value="fast">빠르게</option></select></label>
            <label>스타일<select aria-label="로고월 스타일" value={layout.appearance} disabled={busy} onChange={e => setLayout(l => ({ ...l, appearance: e.target.value as Layout['appearance'] }))}><option value="cards">카드형</option><option value="clean">로고만 깔끔하게</option></select></label>
            <label>간격<select aria-label="로고 간격" value={layout.spacing} disabled={busy} onChange={e => setLayout(l => ({ ...l, spacing: e.target.value as Layout['spacing'] }))}><option value="compact">촘촘하게</option><option value="balanced">균형 있게</option><option value="airy">여유롭게</option></select></label>
            <label>로고 크기<select aria-label="로고 크기" value={layout.logoSize} disabled={busy} onChange={e => setLayout(l => ({ ...l, logoSize: e.target.value as Layout['logoSize'] }))}><option value="small">작게</option><option value="medium">보통</option><option value="large">크게</option></select></label>
            <label className={styles.check}><input type="checkbox" checked={layout.showNames} disabled={busy} onChange={e => setLayout(l => ({ ...l, showNames: e.target.checked }))} />브랜드 이름 표시</label>
            <button disabled={busy || !current} onClick={() => { setCurrent(null); setSaved(''); setTitle(`${title} 복사`); setMessage('저장하면 별도 로고월이 만들어져요.'); }}>복제하기</button>
          </div>
          <div hidden={presentation} className={styles.presets} aria-label="추천 로고월 스타일"><span>추천 스타일</span><button disabled={busy} onClick={() => setLayout({ ...defaultLayout, appearance: 'clean', spacing: 'airy', showNames: false })}>파트너 로고월</button><button disabled={busy} onClick={() => setLayout({ ...defaultLayout, appearance: 'cards', showNames: true })}>브랜드 카드</button><button disabled={busy} onClick={() => setLayout({ ...defaultLayout, appearance: 'clean', motion: 'alternating', showNames: false })}>움직이는 로고월</button></div>
          <div hidden={presentation} className={styles.selectionBar}>
            <button disabled={busy || !selected.length} onClick={() => void autoFit()}>✦ 크기 자동 맞춤</button>
            <span>카드를 끌어 배치하고, 선택한 로고의 모서리를 끌어 크기를 조절해요.</span>
          </div>
          {!presentation && focused && selected.some(b => wallLogoKey(b) === focused) && (() => { const b = selected.find(b => wallLogoKey(b) === focused)!; return <div className={styles.inspector} aria-label="선택한 로고 설정"><strong>{b.name_ko}{b.variantLabel ? ` · ${b.variantLabel}` : ''}</strong><label>로고 크기 <input aria-label="선택한 로고 크기" disabled={busy} type="range" min="50" max="200" value={b.scale || 100} onChange={e => setLogoScale(focused, Number(e.target.value))} /><output>{b.scale || 100}%</output></label><label>카드 배경 <select aria-label="선택한 카드 배경" disabled={busy} value={b.cardBackground || 'inherit'} onChange={e => setCardBackground(focused,e.target.value as CardBackground)}><option value="inherit">전체 설정</option><option value="white">흰색</option><option value="light">연회색</option><option value="dark">검정</option></select></label><button disabled={busy} onClick={() => setLogoScale(focused,100)}>크기 초기화</button><button disabled={busy} onClick={() => { setSelected(s=>s.filter(v=>wallLogoKey(v)!==focused));setFocused(null); }}>제거</button></div>; })()}
          {selected.length > 0 && layout.motion !== 'static' && <section aria-label="움직임 미리보기">
            <div className={styles.sectionTitle}><h2>움직임 미리보기</h2><button onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? '재생하기' : '일시정지'}</button></div>
            <div className={styles.motionStage} data-logo-wall data-appearance={layout.appearance} style={{ background: wallStageBackground(layout) }}>
              {Array.from({ length: layout.motion === 'alternating' ? Math.min(3, selected.length, Math.max(2, Math.ceil(selected.length / layout.columns))) : 1 }, (_, row) => {
                const rows = layout.motion === 'alternating' ? Math.min(3, selected.length, Math.max(2, Math.ceil(selected.length / layout.columns))) : 1;
                const logos = selected.filter((_, i) => i % rows === row);
                const repeated = Array.from({ length: Math.max(1, Math.ceil(8 / logos.length)) }, () => logos).flat();
                return <div className={styles.motionRow} key={row}><div className={styles.motionTrack} style={{ animationDuration: `${{ slow: 48, normal: 28, fast: 14 }[layout.speed]}s`, animationDirection: row % 2 ? 'reverse' : 'normal', animationPlayState: paused || dragging ? 'paused' : 'running' }}>
                  {[0, 1].map(copy => <div className={styles.motionGroup} key={copy} aria-hidden={copy === 1 || undefined}>{repeated.map((b, i) => <div className={`${styles.motionLogo} ${styles.dragSurface}`} key={`${wallLogoKey(b)}-${i}`} data-logo-wall-item={wallLogoKey(b)} data-selected={focused === wallLogoKey(b) || undefined} data-dragging={dragging === wallLogoKey(b) || undefined} data-drop-target={dropTarget === wallLogoKey(b) || undefined} style={{ background: cardBackground(b) }} onPointerDown={e => { if (!presentation) startDrag(e, wallLogoKey(b)); }} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} title={presentation ? b.name_ko : `${b.name_ko} · 끌어서 순서 변경`}><SearchLogo brand={b} src={preview(b)} large background="transparent" />{layout.showNames && <span className={styles.motionCaption}>{b.name_ko}</span>}{!presentation && <button className={styles.resizeHandle} aria-label={`${b.name_ko} 미리보기 크기 조절`} disabled={busy} onPointerDown={e => startResize(e,b)} onPointerMove={resizeMove} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize}>↘</button>}</div>)}</div>)}
                </div></div>;
              })}
            </div><ul className={styles.srOnly}>{selected.map(b => <li key={wallLogoKey(b)}>{b.name_ko}{b.variantLabel ? ` · ${b.variantLabel}` : ''}</li>)}</ul><p hidden={presentation} className={styles.hint}>움직이는 로고를 바로 끌어 순서를 바꿔보세요. 드래그하는 동안 움직임이 멈춰요. 기기의 움직임 줄이기 설정을 따라요.</p>
          </section>}
          <div hidden={presentation && layout.motion !== 'static'} className={styles.canvas} data-dark={layout.background === 'dark' || undefined} data-presentation={presentation || undefined} data-appearance={layout.appearance} style={{ background: wallStageBackground(layout) }}>
            {!selected.length ? <div className={styles.emptyCanvas}><span>＋</span><h3>첫 번째 로고를 추가해 보세요</h3><p>파트너·고객사·좋아하는 브랜드를 한곳에 모아보세요.</p></div> : <div className={styles.wall} data-logo-wall style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>{selected.map((b, index) => <div className={styles.tile} key={wallLogoKey(b)} data-logo-wall-item={wallLogoKey(b)} data-selected={focused === wallLogoKey(b) || undefined} data-dragging={dragging === wallLogoKey(b) || undefined} data-drop-target={dropTarget === wallLogoKey(b) || undefined} style={{ background: cardBackground(b) }}>
              <div className={`${styles.logo} ${styles.dragSurface}`} tabIndex={presentation ? -1 : 0} role="button" aria-label={`${b.name_ko} 선택 및 이동`} onClick={() => setFocused(wallLogoKey(b))} onKeyDown={e => { if (presentation) return; const delta=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0; if (delta) { e.preventDefault();setSelected(s=>{ const n=[...s],to=index+delta;if(to>=0&&to<n.length)[n[index],n[to]]=[n[to],n[index]];return n; }); } if(e.key==='Enter'||e.key===' ') { e.preventDefault();setFocused(wallLogoKey(b)); } }} onPointerDown={e => { if (!presentation) startDrag(e, wallLogoKey(b)); }} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}><SearchLogo brand={b} src={preview(b)} large background="transparent" /></div>
              {layout.showNames && <div className={styles.caption}><span>{b.name_ko}</span>{b.variantLabel && <small>{b.variantLabel}</small>}</div>}
              {!presentation && <><button className={styles.removeLogo} aria-label={`${b.name_ko} 제거`} disabled={busy} onClick={() => setSelected(s => s.filter((_, i) => i !== index))}>×</button><button className={styles.resizeHandle} aria-label={`${b.name_ko} 크기 조절`} title="드래그하거나 방향키로 크기 조절" disabled={busy} onPointerDown={e => startResize(e,b)} onPointerMove={resizeMove} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize} onKeyDown={e => { if (['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(e.key)) { e.preventDefault();setFocused(wallLogoKey(b));setLogoScale(wallLogoKey(b),(b.scale || 100)+(['ArrowRight','ArrowUp'].includes(e.key)?5:-5)); } }}>↘</button></>}

            </div>)}</div>}
          </div>
          <p hidden={presentation} className={styles.hint}>로고를 끌어서 순서를 바꿔보세요. 카드를 선택하면 크기와 배경을 바꿀 수 있어요. 배경이 포함된 PNG는 흰색 카드에 놓으면 자연스러워요. 카드마다 배경을 따로 고를 수도 있어요.</p>
          <div className={styles.footer}><button disabled={busy || !current || dirty} onClick={download}>로고월 ZIP 다운로드</button><span>최대 100개 · 저장 후 ZIP 다운로드</span>{current && <button className={styles.danger} disabled={busy} onClick={() => { if (window.confirm('이 로고월을 삭제할까요?')) void run(async () => { await api('DELETE', current.id); reset(); setWalls((await api()).walls); setMessage('삭제했어요.'); }); }}>로고월 삭제</button>}</div>
        </section>
      </div>
    </>}
    <p className={styles.message} role="status" aria-live="polite">{message}</p>
  </main></>;
}
