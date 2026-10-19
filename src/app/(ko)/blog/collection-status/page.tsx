import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CollectionDashboard from '@/components/CollectionDashboard';
import { collectionProgress } from '@/lib/collection-progress';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '지금 모으는 로고 | 로고 이야기 · 세모로고',
  description: '전국 지자체와 공공기관, 기업, 스포츠팀의 로고 수집 과정을 확인된 명단과 함께 살펴보세요.',
};

export default async function Page() {
  const initial = await collectionProgress().catch(() => null);
  return <><Header /><main className="content-page py-10 pb-28 sm:py-14">
    <Link href="/blog/" className="text-sm text-gray-500 hover:text-gray-900">← 로고 이야기</Link>
    <div className="mt-8 grid gap-8 border-b border-gray-200 pb-10 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
      <div><p className="text-xs font-bold tracking-[0.2em] text-indigo-600">COLLECTION JOURNAL · LIVE</p>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">지금 모으는 로고들</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-gray-600">어떤 분야의 로고를 찾을 수 있고, 어디가 아직 비어 있을까요? 확인된 명단을 따라 하나씩 채워가는 과정을 공개해요. 마음에 드는 분야를 골라 실제 로고까지 둘러보세요.</p>
      </div>
      <div aria-hidden="true" className="relative hidden h-44 overflow-hidden rounded-[28px] bg-[#17171b] p-6 text-white md:block">
        <span className="text-xs font-bold tracking-[0.22em] text-[#b8b5ff]">SEMOLOGO INDEX</span>
        <span className="absolute -right-3 bottom-1 text-[116px] font-black leading-none text-white/10">S</span>
        <div className="absolute bottom-6 left-6 flex gap-2"><span className="h-10 w-10 rounded-full bg-[#a6a2ff]"/><span className="h-10 w-10 rounded-full bg-[#79d7ad]"/><span className="h-10 w-10 rounded-full bg-white"/></div>
      </div>
    </div>
    <CollectionDashboard initial={initial} />
  </main><Footer /></>;
}
