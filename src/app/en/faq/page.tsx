import Header from "@/components/Header";
import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "Frequently asked questions | SemoLogo", description: "Learn about logo formats, Illustrator compatibility and saved logos on SemoLogo.", alternates: {canonical: "/en/faq", languages: languageAlternates("/faq")}};
const questions = [
  ["What is SemoLogo?", "SemoLogo is a searchable collection of brand logos. Available downloads vary by brand and include SVG vectors and PNG images."],
  ["Can I use the logos commercially?", "The logos belong to their respective brands. Check the brand’s usage guidelines and obtain any required permission for your intended use."],
  ["Do you provide AI files?", "Our primary formats are SVG and PNG. Illustrator can open SVG files, but an SVG download is not an original .ai file. See our Illustrator guide for the differences."],
  ["Which format should I download?", "Use SVG for scalable vector artwork and PNG for an image-based workflow. Check available variants on the brand page."],
  ["How do I save SemoLogo for later?", "On desktop, press Ctrl+D (Windows/Linux) or ⌘D (Mac). On mobile, open your browser’s menu or Share menu and choose Bookmark or Add to Home Screen."],
  ["Is there a dark-background version?", "When available, the brand page shows dark previews and an inverted PNG download. Check the preview before using it."],
  ["How do I request or improve a logo?", "Use Request a logo or Submit a logo in the menu. These forms currently use Korean. You can also use the feedback form on a brand’s detail page."],
];
export default function Page() {
  return <><Header/><main className="mx-auto max-w-3xl px-5 py-12 pb-28"><h1 className="text-3xl font-bold">Frequently asked questions</h1>{questions.map(([q,a]) => <section className="mt-8" key={q}><h2 className="text-lg font-semibold">{q}</h2><p className="mt-2 leading-7 text-gray-600">{a}</p></section>)}<a href="/en/ai-logo-download/" className="mt-8 inline-block underline">Illustrator download guide →</a></main><script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage", mainEntity: questions.map(([q,a])=>({"@type":"Question", name:q, acceptedAnswer:{"@type":"Answer",text:a}}))})}}/></>;
}
