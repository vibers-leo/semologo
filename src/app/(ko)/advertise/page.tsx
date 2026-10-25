import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdInquiryForm from '@/components/AdInquiryForm';
export const metadata={title:'광고·제휴 문의 | 세모로고',description:'세모로고 배너·숏폼·스폰서십·제휴 문의를 남겨 주세요.'};
export default function Advertise(){return <><Header/><main className="content-page max-w-2xl py-12 pb-28"><p className="text-sm font-bold text-indigo-600">SEMOLOGO PARTNERSHIP</p><h1 className="mt-3 text-3xl font-black">광고·제휴 문의</h1><p className="mb-9 mt-4 leading-8 text-gray-600">로고와 브랜드를 찾는 사람들에게 소개하고 싶은 이야기가 있나요? 원하시는 방식을 알려 주시면 함께 검토할게요.</p><AdInquiryForm/></main><Footer/></>;}
