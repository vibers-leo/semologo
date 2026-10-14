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
    <p className="rounded-2xl bg-gray-50 p-5 text-gray-600">등록된 로고 <strong className="text-gray-900">{collection.collected.toLocaleString()} / {collection.total.toLocaleString()}</strong> · 명단 기준 {collection.as_of}</p>
    <p className="mt-3 text-sm text-gray-500">{[collection.country, collection.sport, collection.league, collection.season].filter(Boolean).join(' · ')} · 출처 확인 {collection.checked_at?.slice(0,10) ?? collection.as_of}</p>
    {collection.scope_note && <p className="mt-2 text-sm text-gray-500">{collection.scope_note}</p>}
    {collection.source_url && <a className="mt-3 inline-block text-sm underline" href={collection.source_url} target="_blank" rel="noopener noreferrer">명부 출처 확인</a>}
    <nav style={{display:'flex',flexWrap:'wrap',gap:20,margin:'20px 0'}}>
      <Link href={`/collections/${id}`}>전체 목록 {members.length}</Link>
      <Link href={`/collections/${id}?status=missing`}>아직 찾는 중 {members.filter(m=>!m.candidates.length&&!m.brand_id).length}</Link>
    </nav>
    <details className="mb-5 rounded-xl border p-4 text-sm text-gray-600"><summary className="cursor-pointer font-medium text-gray-900">로고 형태와 파일 품질은 어떻게 확인하나요?</summary><p className="mt-3 leading-6">심볼·글자형·가로·세로 조합을 각각 확인해요. 네 형태를 모두 갖추고 PNG도 확인한 로고는 {collection.complete.toLocaleString()}개예요. 이미 등록된 로고도 부족한 형태를 계속 추가하고 있어요.</p><Link className="mt-2 inline-block underline" href={`/collections/${id}?status=pending`}>형태를 더 채울 로고 보기</Link></details>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
      <thead><tr><th>이름</th><th>로고 현황</th>{filter === 'pending' && <th>추가할 형태</th>}<th>바로 가기</th></tr></thead>
      <tbody>{shown.map(m=><tr key={m.member_key} style={{borderTop:'1px solid #e4e4e7'}}>
        <td style={{padding:'14px 8px'}}>{m.name}</td>
        <td>{m.brand_id?'등록됨':m.candidates.length?'연결 확인 중':'수집 예정'}</td>
        {filter === 'pending' && <td style={{fontSize:12,color:'#71717a'}}>{m.brand_id ? required.filter(([form])=>!m.forms.includes(form)).map(([,label])=>label).join(' · ') || '파일 확인 중' : '로고 확인 전'}</td>}
        <td>{m.brand_id && <Link href={`/brand/${m.brand_id}/`} style={{display:'block',fontSize:13,textDecoration:'underline'}}>로고 보기</Link>}</td>
      </tr>)}</tbody>
    </table></div>
  </main><Footer/></>;
}
