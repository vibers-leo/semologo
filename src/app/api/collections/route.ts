import { collectionProgress } from '@/lib/collection-progress';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json({ collections: await collectionProgress() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: '수집 현황을 불러오지 못했어요.' }, { status: 503 }); }
}
