/** JSON-only, stateless Streamable HTTP; legacy initialization stays supported. */
export const legacyMcpVersions = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const modernMcpVersion = '2026-07-28';
export const supportedMcpVersions = [modernMcpVersion, ...legacyMcpVersions];
export const mcpRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const mcpClientInfo = (value: unknown) => mcpRecord(value) && typeof value.name === 'string' && !!value.name.trim() && typeof value.version === 'string' && !!value.version.trim();
export function mcpOriginAllowed(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || ['https://semologo.com', 'https://www.semologo.com', ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])].includes(origin);
}
export function mcpAcceptsJsonAndEvents(value: string) {
  const accepted = new Set(value.split(',').flatMap(part => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';').map(x => x.trim());
    const q = parameters.find(p => p.startsWith('q='));
    if (q && (!/^q=(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q) || Number(q.slice(2)) <= 0)) return [];
    return [type];
  }));
  return accepted.has('application/json') && accepted.has('text/event-stream');
}
function decodedName(value: string | null): string | null {
  if (value === null) return null;
  if (value.startsWith('=?base64?') && value.endsWith('?=')) {
    const encoded = value.slice(9, -2);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null;
    const bytes = Buffer.from(encoded, 'base64');
    const decoded = bytes.toString('utf8');
    return Buffer.from(decoded).equals(bytes) ? decoded : null;
  }
  return /^[\x20-\x7e]+$/.test(value) && value === value.trim() ? value : null;
}
export type McpHttpContext = { modern: boolean; version: string };
export function mcpHttpContext(request: Request, message: unknown): { context: McpHttpContext; error?: never } | { error: Record<string, unknown>; context?: never } {
  const m = mcpRecord(message) ? message : {};
  const params = mcpRecord(m.params) ? m.params : {};
  const meta = mcpRecord(params._meta) ? params._meta : {};
  const header = request.headers.get('mcp-protocol-version');
  const declared = meta['io.modelcontextprotocol/protocolVersion'];
  const modern = header === modernMcpVersion || declared !== undefined;
  const id = typeof m.id === 'string' || Number.isSafeInteger(m.id) ? m.id : null;
  const failure = (code: number, text: string, data?: unknown) => ({ error: { jsonrpc: '2.0', id, error: { code, message: text, ...(data ? { data } : {}) } } });
  if (header && !supportedMcpVersions.includes(header)) return failure(-32022, 'Unsupported protocol version', { requested: header, supported: supportedMcpVersions });
  if (!modern) return { context: { modern: false, version: header || '2025-03-26' } };
  if (!header || header !== declared || request.headers.get('mcp-method') !== m.method) return failure(-32020, 'Required metadata headers are missing or do not match the body');
  if (header !== modernMcpVersion) return failure(-32022, 'Unsupported protocol version', { requested: declared, supported: supportedMcpVersions });
  if (!mcpRecord(params._meta) || !mcpClientInfo(meta['io.modelcontextprotocol/clientInfo']) || !mcpRecord(meta['io.modelcontextprotocol/clientCapabilities'])) return failure(-32602, 'Invalid per-request client metadata');
  if ((m.method === 'tools/call' || m.method === 'prompts/get') && decodedName(request.headers.get('mcp-name')) !== params.name) return failure(-32020, 'Mcp-Name does not match the body');
  if (m.method === 'resources/read' && decodedName(request.headers.get('mcp-name')) !== params.uri) return failure(-32020, 'Mcp-Name does not match the body');
  return { context: { modern: true, version: header } };
}
