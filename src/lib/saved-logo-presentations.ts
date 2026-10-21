import 'server-only';
import type { Brand } from './brands';
import { trafficDb } from './traffic-db';
import { applyPresentation, validPresentation, type LogoPresentation } from './logo-presentation';
import { cmsBrand } from './cms-brand';

/** Shared DB defaults: reviewed transparent PNGs, then explicit admin choices. */
export async function savedLogoPresentations(ids: string[]): Promise<Record<string, LogoPresentation>> {
  if (!ids.length) return {};
  const result = await trafficDb().query(`
    SELECT wanted.id, post.payload, preview.png_file, preview.svg_file
    FROM unnest($1::text[]) AS wanted(id)
    LEFT JOIN semologo.logo_posts post ON post.id=wanted.id AND post.status='published'
    LEFT JOIN semologo.logo_background_previews preview ON preview.id=wanted.id
  `, [[...new Set(ids)]]);
  const presentations: Record<string, LogoPresentation> = {};
  for (const row of result.rows) {
    const brand = row.payload ? cmsBrand(row.id, row.payload) : undefined;
    if (brand?.hidden) continue;
    const rejected = brand?.rejected_asset_files || [];
    const automatic = {
      file: row.png_file,
      bg: 'light',
      ...(row.svg_file ? { svgFile: row.svg_file } : {}),
    };
    if (validPresentation(automatic) && !rejected.includes(automatic.file)) presentations[row.id] = automatic;
    const manual = row.payload?.presentation;
    if (validPresentation(manual) && !rejected.includes(manual.file)) presentations[row.id] = manual;
  }
  return presentations;
}

/** Resolve before rendering so logged-out users receive the same PNG on first paint. */
export async function withSavedLogoPresentations(brands: Brand[]): Promise<Brand[]> {
  if (!brands.length || !process.env.DB_VIBERS_MAIN_URL) return brands;
  try {
    const values = await savedLogoPresentations(brands.map(brand => brand.id));
    return brands.map(brand => applyPresentation(brand, values[brand.id] || brand.presentation));
  } catch (error) {
    console.error('[logo-presentation] shared defaults unavailable',
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'lookup_failed');
    return brands;
  }
}
