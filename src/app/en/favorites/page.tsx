import { redirect } from "next/navigation";
export const metadata = { title: "SemoLogo", robots: { index: false, follow: true } };
export default function Page() { redirect("/en/"); }
