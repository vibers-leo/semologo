import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CollectionDashboard from '@/components/CollectionDashboard';
import { collectionProgress } from '@/lib/collection-progress';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export const metadata = { title: '로고 컬렉션 현황 | 로고 이야기 · 세모로고', description: '국내 상장사·지자체·S&P 500·Nasdaq·Russell 명부의 로고 수집률과 PNG 검증률을 확인해요.' };
export default async function Page() {
  const initial = await collectionProgress().catch(() => null);
  return <><Header/><main className="mx-auto max-w-6xl px-5 py-10"><Link href="/blog/" className="text-sm text-gray-500 underline">로고 이야기</Link><h1 className="mt-4 text-3xl font-black">로고 컬렉션 현황</h1><p className="mt-3 text-gray-600">공식 명부로 확인하는 로고 컬렉션. 채워진 곳과 다음 수집 대상을 한눈에 살펴보세요.</p><CollectionDashboard initial={initial}/></main><Footer/></>;
}
