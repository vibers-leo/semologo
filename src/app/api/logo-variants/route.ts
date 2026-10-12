import { fetchVariants } from '@/lib/brands';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id || id.length > 200 || !/^[\p{L}\p{N}._-]+$/u.test(id)) {
    return Response.json({ error: 'invalid_brand' }, { status: 400 });
  }
  const manifest = await fetchVariants(id);
  return Response.json(manifest, { headers: {
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
  } });
}
