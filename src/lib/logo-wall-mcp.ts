import { legacyMcpVersions, supportedMcpVersions, mcpRecord, mcpClientInfo, type McpHttpContext } from './mcp-http';
const selectionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    names: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 120 }, description: 'Exact brand names, aliases or canonical IDs. Use names OR sector.' },
    sector: { type: 'string', enum: ['finance','technology','sports','public','education','food'], description: 'Catalogue category, not an investment recommendation. Defaults to Korean brands.' },
    origin: { type: 'string', enum: ['KR','GLOBAL','ALL'] }, count: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    title: { type: 'string', minLength: 1, maxLength: 120 }, allowPartial: { type: 'boolean', default: false },
    style: {type:'object',additionalProperties:false,properties:{
      language:{enum:['auto','ko','en','bilingual'],default:'auto'},
      bilingualLayout:{enum:['auto','horizontal','vertical'],default:'auto'},
      form:{enum:['auto','horizontal','wordmark','symbol'],default:'horizontal'}
    }},
    settings: { type: 'object', additionalProperties: false, properties: {
      background: { enum: ['auto','light','dark'] }, cardBackground: { enum: ['auto','white','transparent','light','dark'] },
      columns: { enum: [2,3,4,6] }, motion: { enum: ['static','marquee','alternating'] },
      speed: { enum: ['very-slow','slow','normal','fast'] }, spacing: { enum: ['compact','balanced','airy'] },
      logoSize: { enum: ['tiny','small','medium','large'] }, appearance: { enum: ['cards','clean'] },
      logoColor: { enum: ['original','black','white'] },
    } },
  }, oneOf: [{ required: ['names'], not: { required: ['sector'] } }, { required: ['sector'], not: { required: ['names'] } }],
};
const requestKeySchema = { type: 'string', minLength: 16, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$', description: 'For developer-key writes, copy the requestKey returned by prepare_logo_wall or supply a new unique operation key. Reuse it only when retrying the exact same uncertain operation. Use a fresh key for each new create, collection request or resume poll.' };
const writeSelectionSchema = { ...selectionSchema, properties: { ...selectionSchema.properties, requestKey: requestKeySchema } };
export const wallMcpTools = [
  { name: 'prepare_logo_wall', description: 'Resolve names or choose a sector to preview a logo wall. Returns exact selected brands, unresolved ambiguities and a requestKey usable by the next write tool. No save. Present ambiguities before creating; use canonical IDs to disambiguate.', inputSchema: selectionSchema, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'create_logo_wall', description: 'Create a private logo wall in the signed-in user account using the same storage as the web editor. Returns editorPath. Resolve ambiguities first. Login-token pilot writes a NEW wall each call: do not automatically retry uncertain results. Developer-key writes require requestKey from prepare_logo_wall (or a per-request Idempotency-Key header / params._meta[com.semologo/idempotency-key]); reuse the same key only for the same intended creation. No payment is performed.', inputSchema: writeSelectionSchema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
  {name:'collect_missing_logo_wall',description:'Persist a named logo-wall request, queue up to 10 missing brands in the existing priority collector, and create an available partial wall. No unverified files are published. Call resume_logo_wall after review/publication; no promised completion time. Idempotent for the same input/account. Developer-key callers must include requestKey from prepare_logo_wall or an equivalent per-request header/meta key.',inputSchema:{...writeSelectionSchema,oneOf:[{required:['names'],not:{required:['sector']}}]},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
  {name:'resume_logo_wall',description:'Recheck a collection session in your account, read newly published CMS assets immediately, and atomically update the same wall. Manual edits are never overwritten; a version conflict is returned instead. Poll no more than once every 30 seconds. Developer-key callers must supply a fresh requestKey for each new poll; reuse the prior key only to recover that exact uncertain call. Use preview_logo_wall for a new image after completion.',inputSchema:{type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',pattern:'^[a-fA-F0-9-]{36}$'},requestKey:requestKeySchema}},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
  { name: 'get_logo_wall', description: 'Read a saved wall in the signed-in account. Other accounts are inaccessible.', inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^[a-fA-F0-9-]{36}$' } } }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'preview_logo_wall', description: 'Render a saved private logo wall as an inline PNG image in this conversation. Call after creation to show the result. Uses the same authorized export and padding crop as the web editor.', inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^[a-fA-F0-9-]{36}$' } } }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
];
export async function dispatchWallMcp(message: unknown, call: (name: string, args: unknown, context?: { idempotencyKey?: string }) => Promise<unknown>, context: McpHttpContext = { modern: false, version: '2025-03-26' }) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } };
  const m = message as Record<string, unknown>;
  const id = typeof m.id === 'string' || Number.isSafeInteger(m.id) ? m.id : null;
  const error = (code: number, text: string) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string' || (m.id !== undefined && id === null)) return error(-32600, 'Invalid request');
  if (m.params !== undefined && !mcpRecord(m.params)) return error(-32602, 'Invalid parameters');
  if ('result' in m || 'error' in m) return error(-32600, 'Invalid request');
  const success = (result: Record<string, unknown>) => ({ jsonrpc: '2.0', id, result: context.modern ? { resultType: 'complete', ...result } : result });
  if (m.id === undefined) return null; // Notifications never receive a JSON-RPC response.
  if (m.method === 'server/discover' && context.modern) return success({ ttlMs: 0, cacheScope: 'private', supportedVersions: supportedMcpVersions, capabilities: { tools: {} }, _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'semologo-logo-walls', version: '0.2.0' } }, instructions: 'Private pilot with explicit Bearer credentials; OAuth authorization discovery is not configured. Prepare and resolve ambiguous names before creating. Prefer horizontal lockups and consistent text languages. Do not fabricate logos. Collection creates review requests, not immediate publication. No checkout is performed by tools.' });
  if (m.method === 'initialize' && !context.modern) {
    const params = m.params as Record<string, unknown> | undefined;
    if (!params || typeof params.protocolVersion !== 'string' || !mcpClientInfo(params.clientInfo) || !mcpRecord(params.capabilities)) return error(-32602, 'Invalid initialize parameters');
    const versions: readonly string[] = legacyMcpVersions;
    return { jsonrpc: '2.0', id, result: { protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: 'semologo-logo-walls', version: '0.2.0' }, instructions: 'Private pilot using a verified SemoLogo login token or scoped developer API key. Developer keys require an active service allowance; no actual payment or automatic overage is performed. OAuth authorization discovery is not configured. Plan with prepare_logo_wall; resolve ambiguous names before creation. Prefer horizontal lockups; choose consistent known text languages and bilingual arrangements. Never translate or fabricate artwork. For genuinely missing names use collect_missing_logo_wall then resume_logo_wall after publication. Developer-key writes require an explicit stable idempotency key. After creation call preview_logo_wall to show the wall. Web editor handles further edits and export.' } };
  }
  if (m.method === 'ping') return success({});
  if (m.method === 'tools/list') {
    if (mcpRecord(m.params) && m.params.cursor !== undefined) return error(-32602, 'Invalid cursor');
    return success({ tools: wallMcpTools, ...(context.modern ? { ttlMs: 0, cacheScope: 'private' } : {}) });
  }
  if (m.method !== 'tools/call') return error(-32601, 'Method not found');
  const p = m.params as Record<string, unknown> | undefined;
  if (!p || typeof p.name !== 'string' || !wallMcpTools.some(t => t.name === p.name) || (p.arguments !== undefined && !mcpRecord(p.arguments))) return error(-32602, 'Unknown tool');
  try {
    if (p._meta !== undefined && !mcpRecord(p._meta)) return error(-32602, 'Invalid tool metadata');
    const metadataKey = mcpRecord(p._meta) ? p._meta['com.semologo/idempotency-key'] : undefined;
    const writes = ['create_logo_wall', 'collect_missing_logo_wall', 'resume_logo_wall'].includes(p.name);
    const businessArgs: Record<string, unknown> = { ...(p.arguments as Record<string, unknown> ?? {}) };
    const argumentKey = writes ? businessArgs.requestKey : undefined;
    for (const key of [metadataKey, argumentKey]) if (key !== undefined && (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(key))) return error(-32602, 'Invalid idempotency key');
    if (metadataKey !== undefined && argumentKey !== undefined && metadataKey !== argumentKey) return error(-32602, 'Conflicting idempotency keys');
    if (writes) delete businessArgs.requestKey;
    const result = await call(p.name, businessArgs, { idempotencyKey: (metadataKey ?? argumentKey) as string | undefined }) as Record<string, unknown>;
    const { previewPngBase64, ...metadata } = result;
    const content: Record<string, unknown>[] = [{ type: 'text', text: JSON.stringify(metadata) }];
    if (typeof previewPngBase64 === 'string') content.push({ type: 'image', mimeType: 'image/png', data: previewPngBase64 });
    return success({ content, structuredContent: metadata, isError: false });
  } catch (e) {
    // Only intentional public error codes; never expose SQL, tokens or exception messages.
    const known = new Set(['idempotency_key_mismatch','api_scope_denied','api_entitlement_required','api_quota_exceeded','api_idempotency_required','api_idempotency_conflict','api_request_in_progress','api_request_indeterminate','api_usage_unavailable','api_result_not_replayable','invalid_collection','collection_not_found','collection_needs_explicit_names','collection_rate_limited','too_many_missing_logos','invalid_style','invalid_selection','invalid_settings','invalid_names','invalid_sector','invalid_origin','invalid_count','invalid_title','invalid_partial','unknown_selection_field','choose_names_or_sector','selection_needs_review','wall_not_found','invalid_wall_id']);
    const code = e instanceof Error && known.has(e.message) ? e.message : 'tool_unavailable';
    return success({ content: [{ type: 'text', text: code }], isError: true });
  }
}
