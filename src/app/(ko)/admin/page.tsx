import { redirect } from "next/navigation";
export const metadata = {robots: {index: false, follow: false}};
export default function Admin() { redirect("https://www.faneasy.kr/sites/semologo/admin"); }
