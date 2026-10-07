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
  const shown=members.filter(m => filter === 'missing' ? !m.candidates.length && !m.png_verified : filter === 'pending' ? !m.png_verified : true);
  return <><Header/><main className="mx-auto max-w-5xl px-5 py-10">
    <Link href="/blog/collection-status/" className="text-sm text-gray-500 underline">← 로고 컬렉션 현황</Link>
    <h1 className="my-5 text-3xl font-bold">{collection.name}</h1>
    <p className="rounded-2xl bg-gray-50 p-5 text-gray-600">PNG 검수 완료 <strong className="text-gray-900">{collection.verified.toLocaleString()} / {collection.total.toLocaleString()}</strong> · 명부 기준 {collection.as_of}</p>
    <nav style={{display:'flex',flexWrap:'wrap',gap:20,margin:'20px 0'}}>
      <Link href={`/collections/${id}`}>전체 {members.length}</Link>
      <Link href={`/collections/${id}?status=missing`}>추가 탐색 {members.filter(m=>!m.candidates.length&&!m.png_verified).length}</Link>
      <Link href={`/collections/${id}?status=pending`}>검수 대기 {members.filter(m=>!m.png_verified).length}</Link>
    </nav>
    <p style={{color:'#71717a',fontSize:13,marginBottom:20}}>후보가 없다고 미보유로 확정하지 않아요. 동명 기관·중복·기존 이름은 추가로 검토해요.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
      <thead><tr><th>대상</th><th>현재 상태</th><th>연결 콘텐츠</th></tr></thead>
      <tbody>{shown.map(m=><tr key={m.member_key} style={{borderTop:'1px solid #e4e4e7'}}>
        <td style={{padding:'14px 8px'}}>{m.name}</td>
        <td>{m.png_verified?'PNG 검증 완료':m.candidates.length?'기존 자산 검토':'추가 수집 필요'}</td>
        <td>{(m.brand_id?[m.brand_id]:m.candidates.slice(0,3)).map(brand=><Link key={brand} href={`/brand/${brand}/`} style={{display:'block',fontSize:13,textDecoration:'underline'}}>{brand}</Link>)}</td>
      </tr>)}</tbody>
    </table></div>
  </main><Footer/></>;
}
