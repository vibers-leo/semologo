import type { VariantManifest } from './brands';

const pending = new Map<string, Promise<VariantManifest | null>>();
/** Fetch one brand on demand; never ship the full reviewed archive to the browser. */
export function fetchVariants(id: string): Promise<VariantManifest | null> {
  const cached = pending.get(id);
  if (cached) return cached;
  const request = fetch(`/api/logo-variants/?id=${encodeURIComponent(id)}`)
    .then(async response => {
      if (!response.ok) throw new Error('variants unavailable');
      const data = await response.json();
      return data && Array.isArray(data.variants) ? data as VariantManifest : null;
    }).catch(() => { pending.delete(id); return null; });
  pending.set(id, request);
  if (pending.size > 100) pending.delete(pending.keys().next().value!);
  return request;
}
