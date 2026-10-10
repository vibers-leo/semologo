import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(`${root}dist/assets`, { recursive: true });
const result = spawnSync('bun', ['build', './src/main.js', '--target', 'browser', '--format', 'esm', '--minify', '--outdir', './dist/assets'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const html = readFileSync(`${root}index.html`, 'utf8')
  .replace('/src/main.js', './assets/main.js')
  .replace('</head>', '<link rel="stylesheet" href="./assets/main.css"></head>');
writeFileSync(`${root}dist/index.html`, html);
console.log('Native local bundle ready.');
