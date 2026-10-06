import Link from 'next/link';
import { collectionProgress } from '@/lib/collection-progress';
export const dynamic = 'force-dynamic';
export const metadata = { title: '로고 수집 현황 | 세모로고', description: '셋별 기준 명단과 PNG 서빙 검증 진행률을 확인해요.' };
export default async function Page() {
  const collections = await collectionProgress().catch(() => null);
  return <main style={{ maxWidth: 1000, margin: '48px auto', padding: '0 20px' }}>
    <h1 style={{ fontSize: 28, fontWeight: 700 }}>로고 수집 현황</h1>
    <p style={{ margin: '16px 0 28px', color: '#71717a' }}>기준 명단과 기업을 연결하고 공개 PNG를 확인해요. 검증 완료 수는 보유한 모든 로고의 수와 달라요.</p>
    {!collections ? <p>현황을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p> : collections.map(c => <section key={c.id} style={{ border: '1px solid #e4e4e7', borderRadius: 16, padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>{c.name}</h2>
      <p style={{ fontSize: 28, fontWeight: 700, margin: '16px 0' }}>PNG 검증 {c.verified.toLocaleString()} / {c.total.toLocaleString()} <span style={{ fontSize: 16, color: '#71717a' }}>({c.total ? (c.verified / c.total * 100).toFixed(1) : '0.0'}%)</span></p>
      <progress aria-label={`${c.name} PNG 검증 진행률`} value={c.verified} max={c.total || 1} style={{ width: '100%' }} />
      <p style={{ marginTop: 16 }}>기존 콘텐츠 연결 후보 {c.candidates.toLocaleString()}개 · 미검증 {(c.total - c.verified).toLocaleString()}개</p>
      <p style={{ fontSize: 13, color: '#71717a', marginTop: 12 }}>명단 기준 {c.as_of} · {c.count_unit === 'entity' ? '기업' : '종목'} 기준 · {c.source_kind === 'etf_holdings_proxy' ? 'ETF 보유종목 대체 명단이며 공식 지수 구성과 차이가 있을 수 있어요.' : '저장된 구성종목 명단 기준이에요.'}</p>
      <a href={c.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, textDecoration: 'underline' }}>명단 출처</a>
    </section>)}
    <Link href="/" style={{ textDecoration: 'underline' }}>로고 검색으로 돌아가기</Link>
  </main>;
}
