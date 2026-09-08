import Header from "./Header";
import Link from "next/link";
import { localePath, type Locale } from "@/lib/locales";
export default function LogoGuide({locale, illustrator = false}: {locale: Locale; illustrator?: boolean}) {
  const en = locale === "en"; const path = (p: string) => localePath(p, locale);
  const title = illustrator ? (en ? "Logo downloads for Adobe Illustrator" : "AI 로고 다운로드를 찾고 있나요?") : (en ? "Brand logo collection" : "브랜드 로고 모음");
  return <><Header/><main className="mx-auto max-w-3xl px-5 py-12 pb-28">
    <nav className="mb-6 text-sm text-gray-500"><Link href={path("/")}>{en ? "Home" : "홈"}</Link> / {title}</nav>
    <h1 className="text-3xl font-bold leading-tight">{title}</h1>
    <p className="mt-5 leading-8 text-gray-600">{en ? "Find company, technology, fashion and everyday brand logos in one place. Preview each brand’s available files and download SVG vectors or PNG images." : "기업 CI부터 IT 서비스, 패션, 식음료 브랜드까지 한곳에서 찾아보세요. 브랜드별로 보유한 로고를 미리 보고 SVG 벡터나 PNG 이미지로 내려받을 수 있어요."}</p>
    {illustrator ? <>
    <h2 className="mt-10 text-xl font-bold">{en ? "Is an SVG the same as an AI file?" : "SVG와 AI 파일은 어떻게 다른가요?"}</h2>
    <p className="mt-3 leading-8">{en ? "AI is Adobe Illustrator’s native format. SVG is an open vector format that Illustrator can open. SemoLogo primarily provides SVG and PNG; an SVG download is not an original .ai file. Availability varies by brand." : "AI는 Adobe Illustrator의 기본 저장 형식이고, SVG는 Illustrator에서도 열 수 있는 벡터 형식이에요. 세모로고는 SVG·PNG를 중심으로 제공해요. SVG 다운로드가 원본 .ai 파일 제공을 뜻하지는 않으며, 보유 형식은 브랜드마다 달라요."}</p>
    <h2 className="mt-10 text-xl font-bold">{en ? "Use an SVG logo in Illustrator" : "Illustrator에서 SVG 로고 사용하기"}</h2>
    <ol className="mt-4 list-decimal space-y-3 pl-6"><li>{en ? "Find your brand and download its available SVG file." : "브랜드를 검색하고 SVG 파일이 있으면 내려받아 주세요."}</li><li>{en ? "In Illustrator, choose File → Open and select the SVG." : "Illustrator에서 파일 → 열기로 SVG를 선택해 주세요."}</li><li>{en ? "Check the artwork, colors and paths. If your workflow requires AI, use Save As and select Adobe Illustrator (.ai)." : "모양·색상·패스를 확인한 뒤 AI 형식이 필요하면 다른 이름으로 저장에서 Adobe Illustrator(.ai)를 선택해 주세요."}</li></ol>
    <p className="mt-4 text-sm text-gray-500">{en ? "Saving as AI does not restore the original designer’s layer structure. Changing a PNG file extension does not create vector artwork." : "AI로 저장해도 제작자의 원본 레이어 구조가 복원되지는 않아요. PNG의 확장자만 바꿔도 벡터 파일이 되지 않아요."}</p>
    <p className="mt-3 text-sm"><a className="underline text-gray-500" href="https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/supported-file-formats.html" target="_blank" rel="noopener noreferrer">{en ? "Adobe: supported file formats ↗" : "Adobe 공식 지원 파일 형식 안내 ↗"}</a></p>
    </> : <>
      <h2 className="mt-10 text-xl font-bold">{en ? "Find the right logo for the job" : "작업에 맞는 로고를 찾아보세요"}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{(en ? [
        ["Technology & AI", "Find tools and services such as OpenAI, Figma and Adobe for presentations and product comparisons.", "OpenAI"],
        ["Fashion & lifestyle", "Explore brands such as Nike. Check the wordmark and symbol variants available on each detail page.", "Nike"],
        ["Food & drink", "Find café and food brands such as Starbucks for reference boards and presentation materials.", "Starbucks"],
        ["Korean brands", "Search in Korean or English for brands such as Samsung. Region and category filters narrow down the catalog.", "Samsung"]
      ] : [
        ["IT·AI 서비스 로고", "OpenAI, Figma, Adobe처럼 발표자료나 서비스 비교에 자주 쓰는 브랜드를 찾아보세요.", "OpenAI"],
        ["패션·라이프스타일 로고", "Nike 등 관심 있는 브랜드를 찾아 상세 화면에서 보유한 워드마크와 심볼을 비교해 보세요.", "Nike"],
        ["식품·음료 로고", "Starbucks 등 카페·식음료 브랜드를 검색하고 자료에 맞는 파일 형식을 확인해 보세요.", "Starbucks"],
        ["국내 기업 로고", "삼성처럼 한글·영문 이름으로 검색할 수 있어요. 지역과 카테고리 필터를 함께 쓰면 빠르게 찾을 수 있어요.", "Samsung"]
      ]).map(([heading, body, query]) => <article className="rounded-xl border p-5" key={query}><h3 className="font-bold">{heading}</h3><p className="my-3 text-sm leading-7 text-gray-600">{body}</p><Link className="text-sm underline" href={`${path("/")}?q=${query}`}>{query} →</Link></article>)}</div>
      <h2 className="mt-10 text-xl font-bold">{en ? "Choose SVG or PNG" : "SVG·PNG 중 어떤 형식이 필요한가요?"}</h2>
      <p className="mt-3 leading-8">{en ? "SVG retains vector paths for scalable artwork. PNG is a raster image for slides and documents. Each detail page shows which files and variants are available, with light and dark previews where supported." : "SVG는 크기를 바꿔 쓰는 벡터 작업에, PNG는 문서와 발표자료에 이미지를 넣을 때 유용해요. 상세 화면에서 실제 보유한 파일과 변형을 확인하고, 제공되는 밝은 배경·어두운 배경 미리보기도 비교해 보세요."}</p>
    </>}
    <h2 className="mt-10 text-xl font-bold">{en ? "Start with a brand" : "자주 찾는 브랜드부터 살펴보세요"}</h2>
    <div className="mt-4 flex flex-wrap gap-3">{["Samsung", "Nike", "Starbucks", "OpenAI", "Figma", "Adobe"].map(name => <Link className="rounded-full border px-4 py-2" href={`${path("/")}?q=${encodeURIComponent(name)}`} key={name}>{name}</Link>)}</div>
    <p className="mt-8 leading-7 text-gray-600">{en ? "Use SVG for scalable artwork and PNG for image-based workflows. Save useful logos with the ☆ button to find them on your next visit. Follow each brand’s usage guidelines." : "크기를 바꿔 쓰려면 SVG, 이미지 파일이 필요하면 PNG를 확인해 주세요. 자주 쓰는 로고는 ☆ 버튼으로 저장하면 다음 방문 때 빠르게 찾을 수 있어요. 사용 시에는 각 브랜드의 가이드라인을 따라주세요."}</p>
    <div className="mt-8 flex flex-wrap gap-4"><Link className="rounded-full bg-black px-5 py-3 text-white" href={path("/")}>{en ? "Browse logos" : "로고 검색하기"}</Link><Link className="py-3 underline" href={path(illustrator ? "/logo-collection" : "/ai-logo-download")}>{en ? (illustrator ? "Brand logo collection" : "Illustrator download guide") : (illustrator ? "브랜드 로고 모음" : "AI·SVG 다운로드 안내")}</Link></div>
  </main></>;
}
