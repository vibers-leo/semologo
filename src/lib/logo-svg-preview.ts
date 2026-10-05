/** Offline SVG renderer input: no scripts, network references or XML entities. */
export function prepareSvgPreview(input: Buffer): Buffer {
  let svg = input.toString('utf8');
  // Standard legacy SVG declaration is unnecessary; remove it before parsing.
  svg = svg.replace(/<!DOCTYPE\s+svg\s+PUBLIC\s+"-\/\/W3C\/\/DTD SVG 1\.1\/\/EN"\s+"https?:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd"\s*>/gi, '');
  if (!/<svg\b/i.test(svg) || /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<html\b/i.test(svg)) throw new Error('unsupported');
  for (const match of svg.matchAll(/\b(?:[\w-]+:)?href\s*=\s*["']([^"']*)["']|url\(\s*["']?([^)'"\s]*)/gi)) {
    const ref = (match[1] ?? match[2]).replace(/&quot;|&apos;/g, '').trim();
    if (ref.startsWith('#')) continue;
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(ref)) throw new Error('unsupported');
    const png = Buffer.from(ref.slice(ref.indexOf(',') + 1), 'base64');
    if (png.length < 24 || png.length > 12_000_000 || !png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || png.readUInt32BE(16) * png.readUInt32BE(20) > 16_000_000) throw new Error('unsupported');
  }
  return Buffer.from(svg);
}
