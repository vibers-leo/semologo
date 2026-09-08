import LogoGuide from "@/components/LogoGuide";
import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "AI 로고 다운로드 · Illustrator SVG 사용법 | 세모로고", description: "AI 파일을 찾는 분을 위한 SVG 다운로드 및 Illustrator 사용 안내. SVG와 AI 차이, 저장 방법을 확인해 보세요.", alternates: {canonical: "/ai-logo-download", languages: languageAlternates("/ai-logo-download")}};
export default function Page() {return <LogoGuide locale="ko" illustrator={true}/>;}
