const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('assert');
const file = require('path').resolve(__dirname, '../src/lib/logo-variant-label.ts');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { logoVariantForm, logoVariantLabel } = exportsObject;
const reviewed = { form: 'horizontal', lockup: 'wordmark', text_layout: 'ko-en-vertical', label: '공식 국영문' };
assert.equal(logoVariantForm(reviewed), 'wordmark');
assert.equal(logoVariantLabel(reviewed), '로고타입 · 국영문 상하조합 · 공식 국영문');
assert.equal(logoVariantForm({ form: 'vertical' }), 'vertical');
assert.equal(logoVariantLabel({ form: 'horizontal', label: '가로조합형', text_layout: 'ko-en-horizontal' }), '국영문 좌우조합 · 가로조합형');
assert.equal(logoVariantLabel({ form: 'symbol', label: '심볼마크', text_layout: 'none' }), '심볼마크');
console.log('PASS: reviewed lockup overrides legacy form; text arrangement and official labels survive.');
