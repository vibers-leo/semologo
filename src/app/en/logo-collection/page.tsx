import LogoGuide from "@/components/LogoGuide";
import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "Brand logo collection — SVG & PNG | SemoLogo", description: "Explore brand logos in SVG and PNG. Learn how to open SVG logos in Adobe Illustrator.", alternates: {canonical: "/en/logo-collection", languages: languageAlternates("/logo-collection")}};
export default function Page() {return <LogoGuide locale="en" illustrator={false}/>;}
