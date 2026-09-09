import LogoGuide from "@/components/LogoGuide";
import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "Illustrator logo download guide | SemoLogo", description: "Explore brand logos in SVG and PNG. Learn how to open SVG logos in Adobe Illustrator.", alternates: {canonical: "/en/ai-logo-download", languages: languageAlternates("/ai-logo-download")}};
export default function Page() {return <LogoGuide locale="en" illustrator={true}/>;}
