import BrandPage, { brandMetadata } from "../../../(ko)/brand/[id]/page";
export const revalidate = 86400;
export const generateStaticParams = () => [];
export const generateMetadata = (props: {params: Promise<{id: string}>}) => brandMetadata(props, "en");
export default BrandPage;
