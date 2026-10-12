import type { VariantManifest } from './brands';

const resolved = new Map<string, VariantManifest | null>();
export function cachedVariants(id: string): VariantManifest | null { return resolved.get(id) ?? null; }

const pending = new Map<string, Promise<VariantManifest | null>>();
/** Fetch one brand on demand; never ship the full reviewed archive to the browser. */
export function fetchVariants(id: string): Promise<VariantManifest | null> {
  const cached = pending.get(id);
  if (cached) return cached;
  const request = fetch(`/api/logo-variants/?id=${encodeURIComponent(id)}`)
    .then(async response => {
      if (!response.ok) throw new Error('variants unavailable');
      const data = await response.json();
      const manifest = data && Array.isArray(data.variants) ? data as VariantManifest : null;
      resolved.set(id, manifest);
      if (resolved.size > 100) resolved.delete(resolved.keys().next().value!);
      return manifest;
    }).catch(() => { pending.delete(id); return null; });
  pending.set(id, request);
  if (pending.size > 100) pending.delete(pending.keys().next().value!);
  return request;
}
