import { redirect } from "next/navigation";
export const metadata = { title: "세모로고", robots: { index: false, follow: true } };
export default function Page() { redirect("/"); }
