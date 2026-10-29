import { logoOwner } from '@/lib/logo-owner';
import { exportLogoWall } from '@/lib/logo-wall-export';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const owner = await logoOwner(request);
    if (!owner) return Response.json({error:'로그인 후 이용해 주세요.'},{status:401,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    return exportLogoWall(request,owner);
  } catch {
    return Response.json({error:'다운로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'},{status:503,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
}
