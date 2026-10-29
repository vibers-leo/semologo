import { randomUUID } from 'node:crypto';
import { collectLogoWall } from '@/lib/logo-wall-collection';
import { exportLogoWall } from '@/lib/logo-wall-export';
import { readWallRequest } from '@/lib/logo-wall-request';
import { resolveMcpPrincipal } from '@/lib/developer-api-auth';
import { meteredMcpTool } from '@/lib/developer-api-usage';
import { dispatchWallMcp } from '@/lib/logo-wall-mcp';
import { generateLogoWall } from '@/lib/logo-wall-generation';
import { handleLogoWalls } from '@/lib/logo-wall-store';
import { wallPilotAllowed } from '@/lib/logo-wall-pilot-limit';
import { mcpAcceptsJsonAndEvents, mcpHttpContext, mcpOriginAllowed } from '@/lib/mcp-http';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (b: unknown, s = 200) => Response.json(b, { status: s, headers });
export const GET = (request: Request) => !mcpOriginAllowed(request)
  ? reply({ error: 'forbidden_origin' }, 403)
  : new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
export const DELETE = GET;
export const OPTIONS = GET;
export async function POST(request: Request) {
  if (!mcpOriginAllowed(request)) return reply({ error: 'forbidden_origin' }, 403);
  if (process.env.SEMOLOGO_MCP_ENABLED !== '1') return reply({ error: 'pilot_unavailable' }, 503);
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return reply({ error: 'unsupported_media_type' }, 415);
  const accept = request.headers.get('accept') || '';
  if (!mcpAcceptsJsonAndEvents(accept)) return reply({ error: 'accept_json_and_event_stream' }, 406);
  try {
    const principal = await resolveMcpPrincipal(request);
    const owner = principal?.owner;
    if (!owner) return Response.json({ error: 'unauthorized' }, { status: 401, headers: { ...headers, 'WWW-Authenticate': 'Bearer realm="semologo-mcp"' } });
    if (!(await wallPilotAllowed(owner))) return reply({ error: 'rate_limited' }, 429);
    const raw = await readWallRequest(request);
    if (Buffer.byteLength(raw) > 16000) return reply({ error: 'request_too_large' }, 413);
    let message;
    try { message = JSON.parse(raw); } catch { return reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
    const transport = mcpHttpContext(request, message);
    if (transport.error) return reply(transport.error, 400);
    const result = await dispatchWallMcp(message, async (name, args, callContext) => {
      const headerKey = request.headers.get('idempotency-key');
      if (headerKey && callContext?.idempotencyKey && headerKey !== callContext.idempotencyKey) throw new Error('idempotency_key_mismatch');
      const meterHeaders = new Headers(request.headers);
      if (callContext?.idempotencyKey) meterHeaders.set('Idempotency-Key', callContext.idempotencyKey);
      const meterRequest = new Request(request.url, { method: 'POST', headers: meterHeaders });
      return meteredMcpTool(principal!, name, args, meterRequest, async () => {
      if(name==='collect_missing_logo_wall'||name==='resume_logo_wall')return collectLogoWall(request,owner,args,name==='resume_logo_wall');
      if (name === 'get_logo_wall' || name === 'preview_logo_wall') {
        const a = args as Record<string, unknown>;
        if (!a || Object.keys(a).some(k => k !== 'id') || typeof a.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(a.id)) throw new Error('invalid_wall_id');
        if (name === 'preview_logo_wall') {
          const preview = await exportLogoWall(new Request(new URL(`/api/logo-walls/export/?id=${encodeURIComponent(a.id)}&format=preview`, request.url), { headers: { Authorization: request.headers.get('authorization') || '' } }), owner);
          if (!preview.ok) throw new Error('tool_unavailable');
          const data = await preview.json();
          if (typeof data.image !== 'string' || !data.image.startsWith('data:image/png;base64,') || data.image.length > 3000000) throw new Error('tool_unavailable');
          return { id: a.id, title: data.title, count: data.count, version: data.version, previewPngBase64: data.image.slice('data:image/png;base64,'.length) };
        }
        const r = await handleLogoWalls(new Request(new URL(`/api/logo-walls/?id=${encodeURIComponent(a.id)}`, request.url)), owner);
        if (r.status === 404) throw new Error('wall_not_found');
        if (!r.ok) throw new Error('tool_unavailable');
        return await r.json();
      }
      const response = await generateLogoWall(request, owner, args, name === 'create_logo_wall');
      if (response.status === 409) {
        const data = await response.json();
        // Keep candidate details in a successful tool payload with explicit created=false.
        return { created: false, ...data };
      }
      if (!response.ok) throw new Error('tool_unavailable');
      return { created: name === 'create_logo_wall', ...await response.json(), ...(name === 'prepare_logo_wall' ? { requestKey: randomUUID() } : {}) };
      });
    }, transport.context);
    return result === null ? new Response(null, { status: 202, headers }) : reply(result, transport.context.modern && 'error' in result && result.error.code === -32601 ? 404 : 'error' in result && result.error.code === -32600 ? 400 : 200);
  } catch (e) { return e instanceof Error && e.message === 'request_too_large' ? reply({ error: 'request_too_large' }, 413) : reply({ error: 'mcp_unavailable' }, 503); }
}
