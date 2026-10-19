import sharp from 'sharp';

/** Recolor visible pixels while keeping anti-aliasing and transparency intact. */
export async function recolorLogoWallPng(data: Buffer, color: 'original' | 'white' | 'black'): Promise<Buffer> {
  if (color === 'original') return data;
  const { data: pixels, info } = await sharp(data, { limitInputPixels: 16_000_000 })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const value = color === 'white' ? 255 : 0;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = value; pixels[i + 1] = value; pixels[i + 2] = value;
  }
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
}
