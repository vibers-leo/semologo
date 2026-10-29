import { previewWallFits } from './logo-wall-balance';
import { wallInkMetrics } from './logo-wall-ink';
import sharp, { type OverlayOptions } from 'sharp';
import { logoWallLayout, wallCardBackground, wallStageBackground } from './logo-wall-layout';

/** Static 1200×630 overview. Only decoded PNG buffers from the authorized export enter the compositor. */
export async function logoWallPreview(settings: unknown, logos: { data: Buffer; light?: boolean; scale?: number; cardBackground?: 'inherit' | 'white' | 'transparent' | 'light' | 'dark' }[]) {
  const layout = logoWallLayout(settings);
  const columns = Math.max(layout.columns, Math.ceil(Math.sqrt(logos.length * 2)));
  const rows = Math.max(1, Math.ceil(logos.length / columns));
  const gap = 12; const width = (1120 - gap * (columns - 1)) / columns; const height = (550 - gap * (rows - 1)) / rows;
  const metrics=await Promise.all(logos.map(l=>wallInkMetrics(l.data)));
  const fits=previewWallFits(metrics,Math.max(1,width-16),Math.max(1,height-16),logos.map(l=>l.scale||100));
  const overlays: OverlayOptions[] = [];
  for (let i = 0; i < logos.length; i++) {
    const logo = logos[i]; const tileWidth = Math.max(1, Math.floor(width)); const tileHeight = Math.max(1, Math.floor(height));
    const fitted=fits[i];
    const scaled=await sharp(logo.data,{limitInputPixels:16000000}).resize(fitted.width,fitted.height,{fit:'inside'}).png().toBuffer();
    // Export has already colored each PNG, including per-logo overrides.
    const asset = scaled;
    const meta = await sharp(asset).metadata();
    const tile = await sharp({ create: { width: tileWidth, height: tileHeight, channels: 4, background: wallCardBackground(layout, logo.light, logo.cardBackground) } }).composite([{ input: asset, left: Math.max(0, Math.floor((tileWidth - meta.width!) / 2)), top: Math.max(0, Math.floor((tileHeight - meta.height!) / 2)) }]).png().toBuffer();
    overlays.push({ input: tile, left: 40 + Math.floor((i % columns) * (width + gap)), top: 40 + Math.floor(Math.floor(i / columns) * (height + gap)) });
  }
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: wallStageBackground(layout) } }).composite(overlays).png().toBuffer();
}
