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
