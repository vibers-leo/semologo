import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';
import { collectionMembers, collectionProgress } from '@/lib/collection-progress';
export const dynamic = 'force-dynamic';
export default async function Page({ params, searchParams }: { params: Promise<{id: string}>; searchParams: Promise<{status?: string}> }) {
  const {id} = await params;
  const collection = (await collectionProgress()).find(c => c.id === id);
  if (!collection) notFound();
  const filter=(await searchParams).status;
  const members=await collectionMembers(id);
  const shown=members.filter(m => filter === 'missing' ? !m.candidates.length && !m.brand_id : filter === 'pending' ? !m.complete : true)
    .sort((a,b) => b.forms.filter(form => ['symbol','wordmark','horizontal','vertical'].includes(form)).length
      - a.forms.filter(form => ['symbol','wordmark','horizontal','vertical'].includes(form)).length || a.name.localeCompare(b.name));
  const required=[['symbol','심볼'],['wordmark','글자형'],['horizontal','가로 조합'],['vertical','세로 조합']] as const;
  return <><Header/><main className="content-page py-10">
    <Link href="/blog/collection-status/" className="text-sm text-gray-500 underline">← 로고 컬렉션 현황</Link>
    <h1 className="my-5 text-3xl font-bold">{collection.name}</h1>
    <p className="rounded-2xl bg-gray-50 p-5 text-gray-600">4종 구성 완성 <strong className="text-gray-900">{collection.complete.toLocaleString()} / {collection.total.toLocaleString()}</strong> · 공개 {collection.collected.toLocaleString()} · PNG 검수 {collection.verified.toLocaleString()} · 명부 기준 {collection.as_of}</p>
    <p className="mt-3 text-sm text-gray-500">{[collection.country, collection.sport, collection.league, collection.season].filter(Boolean).join(' · ')} · 출처 확인 {collection.checked_at?.slice(0,10) ?? collection.as_of}</p>
    {collection.scope_note && <p className="mt-2 text-sm text-gray-500">{collection.scope_note}</p>}
    {collection.source_url && <a className="mt-3 inline-block text-sm underline" href={collection.source_url} target="_blank" rel="noopener noreferrer">명부 출처 확인</a>}
    <nav style={{display:'flex',flexWrap:'wrap',gap:20,margin:'20px 0'}}>
      <Link href={`/collections/${id}`}>전체 {members.length}</Link>
      <Link href={`/collections/${id}?status=missing`}>추가 탐색 {members.filter(m=>!m.candidates.length&&!m.brand_id).length}</Link>
      <Link href={`/collections/${id}?status=pending`}>구성 보완 {members.filter(m=>!m.complete).length}</Link>
    </nav>
    <p style={{color:'#71717a',fontSize:13,marginBottom:20}}>심볼·글자형·가로·세로 조합이 모두 확인되어야 완성으로 세어요. 부족한 구성은 기존 로고를 버리지 않고 추가 수집해요. 후보가 없다고 미보유로 확정하지 않아요.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
      <thead><tr><th>대상</th><th>현재 상태</th><th>구성 보완</th><th>연결 콘텐츠</th></tr></thead>
      <tbody>{shown.map(m=><tr key={m.member_key} style={{borderTop:'1px solid #e4e4e7'}}>
        <td style={{padding:'14px 8px'}}>{m.name}</td>
        <td>{m.complete?'4종 완성':m.brand_id?m.png_verified?'구성 보완 필요':'PNG·구성 검토':m.candidates.length?'기존 자산 검토':'추가 수집 필요'}</td>
        <td style={{fontSize:12,color:'#71717a'}}>{m.brand_id ? required.filter(([form])=>!m.forms.includes(form)).map(([,label])=>label).join(' · ') || (m.distinct_artwork < 4 ? '중복 파일 검토' : '—') : '연결 콘텐츠 확인 전'}</td>
        <td>{(m.brand_id?[m.brand_id]:m.candidates.slice(0,3)).map(brand=><Link key={brand} href={`/brand/${brand}/`} style={{display:'block',fontSize:13,textDecoration:'underline'}}>{brand}</Link>)}</td>
      </tr>)}</tbody>
    </table></div>
  </main><Footer/></>;
}
