import type { Metadata } from 'next';
import DeveloperConsole from '@/components/DeveloperConsole';
export const metadata: Metadata = { title: '개발자 콘솔 | 세모로고', description: '내 계정의 API 키와 운영 파일럿 사용량을 관리해요.', robots: { index: false, follow: false }, alternates: { canonical: '/developers/' } };
export default function DevelopersPage() { return <DeveloperConsole/>; }
