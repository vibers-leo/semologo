import { renderBrandPage, brandMetadata } from "../../../(ko)/brand/[id]/page";
export const revalidate = 86400;
export const generateStaticParams = () => [];
export const generateMetadata = (props: {params: Promise<{id: string}>}) => brandMetadata(props, "en");
export default function BrandPage(props: {params: Promise<{id: string}>}) {
  return renderBrandPage(props, "en");
}
