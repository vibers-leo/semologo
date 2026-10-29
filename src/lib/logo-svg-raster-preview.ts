import sharp from 'sharp';
import { prepareSvgPreview } from './logo-svg-preview';

// Existing catalogue SVGs sometimes carry a JPEG. Normalize only that embedded
// raster for offline preview; never publish this as a new native vector asset.
const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1sAAAAASUVORK5CYII=';
export async function prepareSvgRasterPreview(input: Buffer): Promise<Buffer> {
  if (input.length > 12_000_000) throw new Error('large');
  const svg = input.toString('utf8');
  const embedded = [...new Set(svg.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=\s]+/g) ?? [])];
  if (!embedded.length) return prepareSvgPreview(input);
  if (embedded.length > 256) throw new Error('large');
  let validation = svg;
  for (const uri of embedded) validation = validation.split(uri).join(placeholder);
  // Reject scripts, external URLs, entities and unsupported image formats before
  // invoking any decoder. The original strict SVG validator stays unchanged.
  prepareSvgPreview(Buffer.from(validation));
  let result = svg, total = 0, pixels = 0;
  const deadline = Date.now() + 8000;
  for (const uri of embedded) {
    const jpeg = Buffer.from(uri.slice(uri.indexOf(',') + 1).replace(/\s/g, ''), 'base64');
    if (jpeg.length < 4 || jpeg[0] !== 255 || jpeg[1] !== 216 || jpeg[2] !== 255) throw new Error('unsupported');
    if (Date.now() > deadline) throw new Error('temporary');
    const metadata = await sharp(jpeg, { limitInputPixels: 16_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('unsupported');
    pixels += metadata.width * metadata.height;
    if (pixels > 16_000_000) throw new Error('large');
    const png = await sharp(jpeg, { limitInputPixels: 16_000_000 }).timeout({ seconds: 3 }).png().toBuffer();
    total += png.length;
    if (total > 12_000_000) throw new Error('large');
    result = result.split(uri).join(`data:image/png;base64,${png.toString('base64')}`);
  }
  return prepareSvgPreview(Buffer.from(result));
}
