import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CollectionDashboard from '@/components/CollectionDashboard';
import { collectionProgress } from '@/lib/collection-progress';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export const metadata = { title: '로고 컬렉션 현황 | 로고 이야기 · 세모로고', description: '지자체, 공공기관, 기업, 스포츠, 방송, 대학 로고가 얼마나 모였는지 분야별로 살펴보세요.' };
export default async function Page() {
  const initial = await collectionProgress().catch(() => null);
  return <><Header/><main className="content-page py-10"><Link href="/blog/" className="text-sm text-gray-500 underline">← 로고 이야기</Link><h1 className="mt-4 text-3xl font-black">어떤 로고가 모였을까요?</h1><p className="mt-3 max-w-3xl leading-7 text-gray-600">전국 지자체부터 스포츠팀까지, 분야별 명단을 하나씩 확인하며 로고를 모으고 있어요. 지금 바로 찾아볼 수 있는 로고와 앞으로 채워갈 곳을 살펴보세요.</p><CollectionDashboard initial={initial}/></main><Footer/></>;
}
