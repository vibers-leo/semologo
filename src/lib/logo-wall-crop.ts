import sharp from 'sharp';

/** Tighten transparent or white-paper padding without altering the visible mark. */
export async function cropLogoWallPng(data: Buffer): Promise<{ data: Buffer; heightFraction: number }> {
  const original = await sharp(data, { limitInputPixels: 16_000_000 }).metadata();
  if (!original.width || !original.height) return { data, heightFraction: 1 };
  const corner = await sharp(data).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
  const paper = corner[3] < 16 || (corner[3] > 245 && corner[0] > 245 && corner[1] > 245 && corner[2] > 245);
  if (!paper) return { data, heightFraction: 1 };
  try {
    const result = await sharp(data).trim({ threshold: 16 }).png().toBuffer({ resolveWithObject: true });
    const { width, height } = result.info;
    if (!width || !height || width < original.width * .05 || height < original.height * .05) return { data, heightFraction: 1 };
    return { data: result.data, heightFraction: height / original.height };
  } catch {
    return { data, heightFraction: 1 };
  }
}
