const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('.') && !path.extname(request)) {
    const candidate = path.resolve(path.dirname(parent.filename), request + '.ts');
    if (fs.existsSync(candidate)) return candidate;
  }
  return resolveFilename.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { cmsBrand } = require('../src/lib/cms-brand.ts');
const rejected = ['logo-800.png', 'logo-transparent.png', 'logo-icon.png'];
const presentation = { file: 'sources/verified/crest.png', svgFile: 'sources/verified/crest.svg', bg: 'light' };
const result = cmsBrand('aipeppers', { name_ko: 'SOOP SOOPers', rejected_asset_files: rejected, presentation });
for (const file of rejected) assert.ok(result.rejected_asset_files.includes(file), `CMS rejection lost: ${file}`);
assert.ok(result.rejected_asset_files.includes('logo.png'), 'bundled rejection must also survive');
assert.deepEqual(result.presentation, presentation, 'manual representative must survive');
const ordinary = cmsBrand('test-brand-with-no-review', { name_ko: 'Test' });
assert.equal(ordinary.rejected_asset_files, undefined, 'do not invent rejections for unreviewed brands');
console.log('PASS: CMS and bundled asset rejections survive review merging; representative preserved');
