const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('path');
const file = path.resolve('src/lib/reviewed-logo-assets.ts');
const moduleRef = { exports: {} };
const localRequire = require('node:module').createRequire(file);
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
new Function('exports', 'require', 'module', output)(moduleRef.exports,
  name => name === './cdn' ? { CDN: 'https://logo.vibers.co.kr/_clients', VERSION: 'test' } : localRequire(name), moduleRef);
const { applyReviewedAssets, reviewedVariants, reviewedMergeTarget } = moduleRef.exports;
const cjwf = applyReviewedAssets({ id: 'gongu-ci-1495', has_svg: false, has_png: true });
assert.equal(cjwf.has_svg, true);
assert.match(cjwf.preview_png, /lockup-reviewed-20261010\/696131becdce4029.png$/);
assert.equal(cjwf.variants_n, 10);
assert.equal(reviewedVariants[cjwf.id].variants.length, 10);
assert.equal(applyReviewedAssets({ id: 'official-ci-next-02' }).merged_into, cjwf.id);
assert.equal(applyReviewedAssets({ id: 'official-ci-next-02' }).hidden, true);
console.log('Reviewed representative paths, 10 CJWF variants and duplicate redirect: passed');

assert.equal(reviewedMergeTarget("official-ci-next-02"), "gongu-ci-1495");
assert.equal(reviewedMergeTarget("not-a-reviewed-brand"), null);
const { reviewedCatalogSeeds } = moduleRef.exports;
assert.ok(reviewedCatalogSeeds.some(b => b.id === 'naver-blog' && b.name_ko === '네이버 블로그'));
assert.equal(reviewedVariants['naver-blog'].variants.length, 6);
assert.equal(reviewedVariants['smartstore-naver'].variants.length, 2);
assert.equal(reviewedVariants.naver.variants.length, 5);
assert.equal(reviewedMergeTarget('naver-2'), 'naver');
assert.equal(reviewedMergeTarget('naver--src-83d3c48'), 'naver');
assert.ok(applyReviewedAssets({id:'naver-blog'}).aliases.includes('네이버블로그'));
console.log('NAVER variants, aliases, merged identities and sitemap seed: passed');

const nh = applyReviewedAssets({id:'nhbank',logo_svg:true,has_svg:true,icon_png:'logo-icon.png'});
assert.equal(nh.has_svg,true);
assert.ok(nh.logo_svg && nh.svg_transparent.startsWith('sources/official-nhbank-bepa-20261010/'));
assert.ok(nh.rejected_asset_files.includes('logo-icon.png'));
assert.ok(nh.logo_png.startsWith('sources/bank-corrections-'));
assert.ok(reviewedVariants.nhbank.variants.every(v => !v.files.svg || v.files.svg.startsWith('sources/official-nhbank-bepa-20261010/')));
assert.equal(reviewedVariants.nhbank.variants.filter(v => v.files.svg).length, 8);
assert.equal(reviewedMergeTarget('industrial-bank-of-korea'),'ibk');
assert.equal(reviewedMergeTarget('ibk-co'),'ibk');
assert.equal(reviewedMergeTarget('ibk-en'),'ibk');
assert.ok(reviewedVariants.ibk.variants.some(v=>v.lang==='en'));
assert.ok(applyReviewedAssets({id:'kbstar'}).rejected_asset_files.includes('logo-800.png'));
console.log('Bank contamination exclusion and IBK identity merges: passed');

for (const id of ['no-verca', 'noordned', 'paddington']) {
  const repaired = applyReviewedAssets({id,has_svg:true,logo_svg:true});
  assert.equal(repaired.has_svg,false);
  assert.equal(repaired.logo_svg,null);
  assert.ok(repaired.presentation.file.startsWith('sources/raster-recovery-20261010/'));
  assert.ok(reviewedVariants[id].variants.every(v => !v.files.svg));
}
for (const id of ['kudu','htv-x']) {
  const repaired = applyReviewedAssets({id});
  assert.equal(repaired.presentation.bg,'dark');
  assert.ok(repaired.presentation.file.startsWith('sources/quality-public-recovery-20261010/'));
}
assert.equal(applyReviewedAssets({id:'capture-one'}).has_svg,true);
console.log('Reviewed PNG repairs and white-logo background choices: passed');
