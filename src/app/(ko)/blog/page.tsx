import Link from "next/link";
import Header from "@/components/Header";
import { type Story as BlogPost } from "@/lib/story-cms";
import { getStories } from "@/lib/story-cms";
export const dynamic="force-dynamic";

export const metadata = {
  title: "로고 이야기 | 세모로고",
  description: "로고에 얽힌 이야기와 실무에서 바로 쓰는 SVG·PNG 활용법, 그리고 새로 모인 로고 소식을 읽어보세요.",
};

const covers: Record<string, { label: string; motif: string; className: string }> = {
  "semologo-keyenai-companion": { label: "BRAND FILES", motif: "SVG", className: "bg-[#e9e9ff] text-[#4640ad]" },
  "svg-vs-png-logo-guide": { label: "FILE GUIDE", motif: "◯ ↗", className: "bg-[#e4f3ec] text-[#16724c]" },
  "illustrator-open-svg": { label: "DESIGN TOOL", motif: "Ai", className: "bg-[#f8e9df] text-[#aa5629]" },
  "fashion-brand-logo-search": { label: "FIND A LOGO", motif: "Aa", className: "bg-[#f2e8ee] text-[#914967]" },
  "nike-swoosh-story": { label: "LOGO STORY", motif: "↗", className: "bg-[#e6edf8] text-[#244c82]" },
};

function Cover({ post }: { post: BlogPost }) {
  if(post.coverImage)return <img src={post.coverImage} alt="" loading="lazy" className="h-40 w-full rounded-2xl object-cover sm:h-44"/>;
  const cover = covers[post.slug] ?? { label: post.category, motif: "✦", className: "bg-gray-100 text-gray-700" };
  return <div aria-hidden="true" className={`relative flex h-40 w-full flex-col justify-between overflow-hidden rounded-2xl p-5 sm:h-44 ${cover.className}`}>
    <span className="text-[11px] font-bold tracking-[0.22em]">{cover.label}</span>
    <span className="self-end text-5xl font-black tracking-tight sm:text-6xl">{cover.motif}</span>
    <span className="absolute -bottom-10 -left-9 h-32 w-32 rounded-full border-[18px] border-current opacity-10" />
  </div>;
}

export default async function BlogPage() {
 const BLOG_POSTS=await getStories();
  return <><Header /><main className="content-page py-10 pb-28 sm:py-14">
    <div className="max-w-2xl">
      <p className="text-xs font-bold tracking-[0.2em] text-indigo-600">SEMOLOGO JOURNAL</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">로고 이야기</h1>
      <p className="mt-5 text-base leading-8 text-gray-600">익숙한 로고에도 처음 만들어진 순간과 쓰임새가 있어요. 브랜드의 이야기를 읽고, 필요한 파일을 더 잘 고르는 방법도 함께 살펴보세요.</p>
    </div>

    <Link href="/blog/collection-status/" className="group mt-10 grid overflow-hidden rounded-[28px] border border-gray-200 bg-[#f8f8fa] transition-shadow hover:shadow-lg sm:grid-cols-[1.2fr_1fr]" aria-label="로고 수집현황 읽기">
      <div className="flex flex-col justify-between p-7 sm:p-9">
        <div><p className="text-xs font-bold tracking-[0.16em] text-indigo-600">LIVE · 수집 노트</p>
          <h2 className="mt-4 text-2xl font-black leading-snug sm:text-3xl">지금 어떤 로고를<br />모으고 있을까요?</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-gray-600">전국 지자체와 공공기관부터 기업, 스포츠팀까지. 확인된 명단과 실제 공개된 로고를 나란히 놓고 채워가는 과정을 보여드려요.</p></div>
        <span className="mt-7 text-sm font-bold text-indigo-600 group-hover:underline">수집 이야기 보러 가기 ↗</span>
      </div>
      <div aria-hidden="true" className="flex min-h-56 flex-col justify-center gap-3 bg-[#17171b] px-8 py-9 text-white sm:px-10">
        {["01  명단을 확인해요", "02  로고를 찾고 살펴봐요", "03  검수한 로고를 공개해요"].map((label, index) => <div key={label} className={`rounded-xl border px-4 py-3 text-sm ${index === 2 ? 'border-[#a6a2ff] bg-[#a6a2ff] font-bold text-[#17171b]' : 'border-white/15 text-gray-300'}`}>{label}</div>)}
      </div>
    </Link>

    <section className="mt-16" aria-labelledby="journal-heading">
      <div className="flex items-end justify-between border-b border-gray-200 pb-4"><div><p className="text-xs font-bold tracking-[0.16em] text-gray-400">READ NEXT</p><h2 id="journal-heading" className="mt-2 text-2xl font-black">차곡차곡 쌓이는 이야기</h2></div><span className="text-sm text-gray-500">{BLOG_POSTS.length}편</span></div>
      <div className="divide-y divide-gray-200">
        {BLOG_POSTS.map(post => <article key={post.slug} className="grid gap-5 py-7 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-7">
          <Link href={`/blog/${post.slug}/`} aria-label={`${post.title} 읽기`}><Cover post={post} /></Link>
          <div className="flex flex-col justify-center"><p className="text-xs font-semibold text-indigo-600">{post.category} <span className="mx-1 text-gray-300">·</span> {post.readingMinutes}분 읽기</p>
            <h3 className="mt-2 text-xl font-bold leading-snug sm:text-2xl"><Link href={`/blog/${post.slug}/`} className="hover:text-indigo-600">{post.title}</Link></h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">{post.description}</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500"><span>{post.date}</span><Link href={`/blog/${post.slug}/`} className="font-bold text-gray-900 hover:text-indigo-600">이야기 읽기 ↗</Link></div>
          </div>
        </article>)}
      </div>
    </section>
  </main></>;
}
