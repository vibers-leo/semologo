'use client';

import { useEffect, useState } from 'react';
import { getClientAuth } from '@/lib/firebase';
import { CDN } from '@/lib/cdn';

type Version = {
  id: string; brand_id: string; label: string; introduced_year: number | null; retired_year: number | null;
  version_kind: string; source_url: string | null; source_note: string | null; is_current: boolean;
  observed_at: string; review_status: string; assets: Record<string, unknown>;
};

function fileUrl(version: Version, kind: 'png' | 'svg'): string | null {
  if (version.review_status !== 'verified') return null;
  const assets = version.assets || {};
  const file = kind === 'png' ? assets.preview_png || assets.logo_png : assets.svg_transparent || assets.logo_svg;
  if (typeof file === 'string') {
    if (file.startsWith(`${CDN}/`)) return file;
    if (file.startsWith('/submissions/') && !file.includes('..')) return file;
    if (!file.includes('..') && /^(?:[\w-]+\/)*[\w.-]+\.(png|svg)$/.test(file)) return `${CDN}/${version.brand_id}/${file}`;
  }
  return null;
}

export default function LogoVersionHistory({ brandId, isAdmin }: { brandId: string; isAdmin: boolean }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [editing, setEditing] = useState<Version | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch(`/api/logo-versions/?id=${encodeURIComponent(brandId)}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (!signal?.aborted) { setVersions(data.versions || []); setError(''); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : '이력을 불러오지 못했어요.');
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [brandId]);

  const seen = new Set<string>();
  const history = versions.filter(version => {
    if (version.is_current || version.review_status !== 'verified') return false;
    if (version.version_kind !== 'brand_redesign' && !version.retired_year) return false;
    const asset = fileUrl(version, 'png') || fileUrl(version, 'svg');
    if (!asset || seen.has(asset)) return false;
    seen.add(asset);
    return true;
  });

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const response = await fetch('/api/logo-versions/', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setEditing(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요.'); }
    finally { setSaving(false); }
  }

  if (!history.length) return null;
  return <section aria-label="이전 로고" style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #e4e4e7' }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 5px' }}>이전 로고</h2>
    <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 12px' }}>확인된 과거 로고를 현재 로고와 함께 볼 수 있어요.</p>
    <div style={{ display: 'grid', gap: 10 }}>
      {history.map(version => {
        const png = fileUrl(version, 'png');
        const svg = fileUrl(version, 'svg');
        return <article key={version.id} style={{ border: '1px solid #e4e4e7', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={png || svg!} alt={version.label} style={{ width: 90, height: 60, objectFit: 'contain', background: version.assets?.light ? '#18181b' : '#fff' }} onError={event => { event.currentTarget.style.display = 'none'; }} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <b style={{ fontSize: 12 }}>{version.introduced_year ? `${version.introduced_year}${version.retired_year ? `–${version.retired_year}` : ''} · ` : ''}{version.label}</b>
            <div style={{ fontSize: 11, display: 'flex', gap: 10, marginTop: 6 }}>
              {svg && <a href={svg} target="_blank" rel="noopener noreferrer">SVG 보기</a>}
              {png && <a href={png} target="_blank" rel="noopener noreferrer">PNG 보기</a>}
              {version.source_url && <a href={version.source_url} target="_blank" rel="noopener noreferrer">출처</a>}
            </div>
          </div>
          {isAdmin && <button type="button" onClick={() => setEditing({ ...version })} style={{ fontSize: 11 }}>연도·출처 관리</button>}
        </article>;
      })}
    </div>
    {isAdmin && editing && <div style={{ marginTop: 14, padding: 12, background: '#f8f7ff', borderRadius: 8, display: 'grid', gap: 8, fontSize: 12 }}>
      <label>버전 이름 <input aria-label="버전 이름" value={editing.label} onChange={event => setEditing({ ...editing, label: event.target.value })} /></label>
      <label>도입 연도 <input aria-label="도입 연도" type="number" min={1} max={new Date().getFullYear()} value={editing.introduced_year ?? ''} onChange={event => setEditing({ ...editing, introduced_year: event.target.value ? Number(event.target.value) : null })} /></label>
      <label>종료 연도 <input aria-label="종료 연도" type="number" min={1} max={new Date().getFullYear()} value={editing.retired_year ?? ''} onChange={event => setEditing({ ...editing, retired_year: event.target.value ? Number(event.target.value) : null })} /></label>
      <label>이력 구분 <select value={editing.version_kind} onChange={event => setEditing({ ...editing, version_kind: event.target.value })}><option value="legacy_import">기존 자산 등록</option><option value="asset_revision">자산 검수·수정</option><option value="brand_redesign">브랜드 리뉴얼</option></select></label>
      <label>근거 출처 <input aria-label="연도 근거 출처" type="url" value={editing.source_url || ''} onChange={event => setEditing({ ...editing, source_url: event.target.value })} /></label>
      <label>검수 메모 <textarea value={editing.source_note || ''} onChange={event => setEditing({ ...editing, source_note: event.target.value })} /></label>
      <p style={{ color: '#71717a', fontSize: 11 }}>연도는 출처가 확인됐을 때만 기록해 주세요.</p>
      <div><button disabled={saving} onClick={() => void save()}>{saving ? '저장 중…' : '이력 저장하기'}</button> <button onClick={() => setEditing(null)}>취소</button></div>
    </div>}
    {error && isAdmin && <p role="alert" style={{ fontSize: 12, color: '#dc2626' }}>{error}</p>}
  </section>;
}
