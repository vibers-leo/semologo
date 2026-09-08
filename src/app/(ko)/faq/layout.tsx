import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "자주 묻는 질문 | 세모로고", alternates: {canonical: "/faq", languages: languageAlternates("/faq")}};
export default function Layout({children}: {children: React.ReactNode}) {return children;}
