import fs from 'node:fs';
const key = process.env.INDEXNOW_KEY;
const site = 'https://semologo.com';
if (!key) throw new Error('INDEXNOW_KEY required');
const urls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const body = { host: 'semologo.com', key, keyLocation: `${site}/${key}.txt`, urlList: urls };
const response = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: {'content-type':'application/json; charset=utf-8'}, body: JSON.stringify(body) });
console.log(`IndexNow HTTP ${response.status}`);
if (!response.ok) console.log(await response.text());
