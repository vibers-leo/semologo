import SiteLayout, { siteMetadata } from "@/components/SiteLayout";
export const generateMetadata = () => siteMetadata("en");
export default function Layout({children}: {children: React.ReactNode}) { return <SiteLayout locale="en">{children}</SiteLayout>; }
