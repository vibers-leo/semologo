import SiteLayout, { siteMetadata } from "@/components/SiteLayout";
export const generateMetadata = () => siteMetadata("ko");
export default function Layout({children}: {children: React.ReactNode}) { return <SiteLayout locale="ko">{children}</SiteLayout>; }
