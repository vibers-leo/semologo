import { readWallRequest } from '@/lib/logo-wall-request';
import { logoOwner } from '@/lib/logo-owner';
import { trafficAdmin } from '@/lib/traffic-db';
import { wallPilotAllowed } from '@/lib/logo-wall-pilot-limit';
import { generateLogoWall } from '@/lib/logo-wall-generation';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (process.env.SEMOLOGO_MCP_ENABLED !== '1') return Response.json({ error: 'pilot_unavailable' }, { status: 503 });
  try {
    const owner = await logoOwner(request);
    if (!owner) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (process.env.SEMOLOGO_DEVELOPER_PILOT_ONLY === '1' && !await trafficAdmin(request)) return Response.json({ error: 'pilot_invite_required' }, { status: 403 });
    if (!(await wallPilotAllowed(owner))) return Response.json({ error: 'rate_limited' }, { status: 429 });
    const text = await readWallRequest(request);
    if (Buffer.byteLength(text) > 16000) return Response.json({ error: 'request_too_large' }, { status: 413 });
    let body;
    try { body = JSON.parse(text); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.save !== 'boolean') return Response.json({ error: 'invalid_request' }, { status: 400 });
    const { save, ...selection } = body;
    return await generateLogoWall(request, owner, selection, save);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'request_too_large') return Response.json({ error: code }, { status: 413 });
    const invalid = /^(invalid_|unknown_selection|choose_names|too_many_identity)/.test(code);
    return Response.json({ error: invalid ? code : 'generation_unavailable' }, { status: invalid ? 400 : 503 });
  }
}
