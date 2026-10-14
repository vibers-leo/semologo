// Reviewable additions from the user-provided anonymous Community SVG sheet.
// This script stages immutable assets only; publication is a separate step.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'marketing/assets/figma-global-collection-20261010');
const out = path.join(root, 'marketing/assets/figma-global-next-20261014');
const sourceReport = JSON.parse(fs.readFileSync(path.join(source, 'analysis.json')));
const cms = JSON.parse(fs.readFileSync(path.join(source, 'cms-reviewed8-snapshot.json')));
const byId = new Map(cms.map(row => [row.id, row]));
const choices = [
  ['discord', 1, 'symbol', '단독 심볼'],
  ['dotnet', 14, 'vertical', 'Microsoft .NET 조합'],
  ['ebanx', 32, 'horizontal', 'EBANX 가로조합'],
  ['elastic', 37, 'symbol', '컬러 심볼'],
  ['elm', 43, 'symbol', '다색 심볼'],
  ['elo', 44, 'symbol', '원형 심볼'],
  ['ethereum', 65, 'symbol', '회색 심볼'],
  ['firebase', 88, 'symbol', '다색 심볼'],
  ['flickr', 97, 'wordmark', '검정 글자형'],
];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  fs.mkdirSync(out, {recursive: true});
  const release = {patches: {}, variants: {}};
  const uploads = [];
  const proof = [];
  for (const [id, index, form, label] of choices) {
    const item = `item-${String(index).padStart(4, '0')}`;
    const sourceItem = sourceReport.items[index - 1];
    if (sourceItem.id !== item || sourceItem.missing_refs.length || sourceItem.external_refs.length ||
        sourceItem.tags.image || sourceItem.quality_flags.some(flag => flag !== 'filter')) {
      throw Error(`Source is not a self-contained vector: ${item}`);
    }
    const row = byId.get(id);
    if (!row || row.status !== 'published' || !row.version_id || row.payload.hidden || row.payload.merged_into) {
      throw Error(`Canonical published identity required: ${id}`);
    }
    const svg = fs.readFileSync(path.join(source, 'items', item, 'logo.svg'));
    if (sha(svg) !== sourceItem.sha256) throw Error(`Source hash mismatch: ${item}`);
    const response = await fetch(`https://logo.vibers.co.kr/_clients/${id}/variants.json`);
    if (!response.ok) throw Error(`Current CDN manifest unavailable: ${id} ${response.status}`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.variants)) throw Error(`Invalid CDN manifest: ${id}`);
    const prior = row.asset_manifest?.variants?.variants || [];
    const byKey = new Map(manifest.variants.map(v => [v.key, v]));
    for (const v of prior) byKey.set(v.key, v);
    const key = `community-global-${item}`;
    if (byKey.has(key)) throw Error(`Already published: ${id} ${key}`);

    const png = await sharp(svg, {density: 450, limitInputPixels: 100000000})
      .resize({width: 2000, height: 2000, fit: 'inside', withoutEnlargement: false})
      .ensureAlpha().png().toBuffer();
    const image = sharp(png);
    const meta = await image.metadata();
    const corners = await image.extract({left: 0, top: 0, width: 1, height: 1}).raw().toBuffer();
    if (meta.width < 500 || meta.height < 100 || corners[3] !== 0) {
      throw Error(`Poor transparent render: ${item} ${meta.width}x${meta.height} alpha=${corners[3]}`);
    }
    const preview = await sharp(png).resize({width: 640, height: 640, fit: 'inside'}).png().toBuffer();
    const files = {};
    for (const [name, body] of [['logo.svg', svg], ['logo.png', png], ['preview.png', preview]]) {
      const hash = sha(body);
      const rel = `sources/community-global-20261014/${hash.slice(0, 20)}/${name}`;
      const local = path.join(out, id, rel);
      fs.mkdirSync(path.dirname(local), {recursive: true});
      fs.writeFileSync(local, body);
      uploads.push({id, file: path.relative(root, local), key: `_clients/${id}/${rel}`, sha256: hash, bytes: body.length});
      files[name] = rel;
    }
    byKey.set(key, {
      key, form, color: 'original', label: `${label} · 커뮤니티 수록 · 시기 미확인`,
      files: {svg: files['logo.svg'], png: files['logo.png']}, preview_png: files['preview.png'],
      provider: '사용자 제공 Figma Community SVG', origin: 'community', official: false,
      source_note: '1,400 SVG Logos Collection 수록 벡터. 공식 배포본 또는 현재 CI임을 확인한 자료가 아님.',
      source_sha256: sourceReport.source_sha256, source_item: item,
      review_status: 'verified', png_width: meta.width, png_height: meta.height,
      order: Math.max(99, ...[...byKey.values()].map(v => Number(v.order) || 0)) + 1,
    });
    manifest.variants = [...byKey.values()];
    release.variants[id] = manifest;
    release.patches[id] = {variants_n: manifest.variants.length};
    proof.push({id, item, source_sha256: sourceItem.sha256, source_flags: sourceItem.quality_flags,
      png_width: meta.width, png_height: meta.height, transparent_corner: true,
      previous_variant_keys: [...byKey.keys()].filter(k => k !== key), representative_unchanged: true});
  }
  fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'uploads.json'), JSON.stringify(uploads, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'review-proof.json'), JSON.stringify({source_sha256: sourceReport.source_sha256,
    compared_image: 'marketing/assets/figma-global-collection-20261010/comparison-next8.jpg',
    compared_additional_image: 'marketing/assets/figma-global-collection-20261010/comparison-next17.jpg',
    variants: proof, published: false}, null, 2) + '\n');
  console.log(`STAGED ${proof.length} existing brands, ${uploads.length} immutable objects; not published`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
