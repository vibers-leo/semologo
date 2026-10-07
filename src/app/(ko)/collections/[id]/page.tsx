import Link from 'next/link';
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
  return <main style={{maxWidth:1000,margin:'48px auto',padding:'0 20px'}}>
    <Link href="/collections">← 수집 현황</Link>
    <h1 style={{fontSize:26,fontWeight:700,margin:'20px 0'}}>{collection.name}</h1>
    <p>PNG 검증 {collection.verified}/{collection.total} · 명단 기준 {collection.as_of}</p>
    <nav style={{display:'flex',flexWrap:'wrap',gap:20,margin:'20px 0'}}>
      <Link href={`/collections/${id}`}>전체 {members.length}</Link>
      <Link href={`/collections/${id}?status=missing`}>연결 후보 없음 {members.filter(m=>!m.candidates.length&&!m.png_verified).length}</Link>
      <Link href={`/collections/${id}?status=pending`}>미검증 {members.filter(m=>!m.png_verified).length}</Link>
    </nav>
    <p style={{color:'#71717a',fontSize:13,marginBottom:20}}>후보가 없다고 미보유로 확정하지 않아요. 동명 기관·중복·기존 이름은 추가로 검토해요.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}>
      <thead><tr><th>대상</th><th>현재 상태</th><th>연결 콘텐츠</th></tr></thead>
      <tbody>{shown.map(m=><tr key={m.member_key} style={{borderTop:'1px solid #e4e4e7'}}>
        <td style={{padding:'14px 8px'}}>{m.name}</td>
        <td>{m.png_verified?'PNG 검증 완료':m.candidates.length?'기업·기관 연결 검토':'원본 탐색 우선'}</td>
        <td>{(m.brand_id?[m.brand_id]:m.candidates.slice(0,3)).map(brand=><Link key={brand} href={`/brand/${brand}/`} style={{display:'block',fontSize:13,textDecoration:'underline'}}>{brand}</Link>)}</td>
      </tr>)}</tbody>
    </table></div>
  </main>;
}
