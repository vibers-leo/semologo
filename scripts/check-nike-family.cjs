const fs=require('fs'),assert=require('node:assert/strict');const r=JSON.parse(fs.readFileSync('src/lib/reviewed-nike-family-20261013.json','utf8'));
assert.equal(r.variants.nike.variants.length,10);assert.equal(r.variants.nike.variants[0].form,'symbol');assert.ok(r.patches.nike.icon_png.endsWith('/icon.png'));
for(const[id,m]of Object.entries(r.variants)){assert.ok(m.variants.some(v=>v.key===m.primary),id);assert.equal(m.variants.length,new Set(m.variants.map(v=>v.key)).size,id);assert.equal(r.patches[id].variants_n,m.variants.length);}
for(const id of ['nike--src-a11f159','nike-8','nike-3-1'])assert.equal(r.patches[id].merged_into,'nike');for(const id of ['nike-golf-1','nike-golf-2','nike-golf-3'])assert.equal(r.patches[id].merged_into,'nike-golf');assert.equal(r.patches['logo-of-nike-ipod'].merged_into,'nike-ipod');assert.equal(r.patches['chernikeeff-6157'].merged_into,'chernikeeff');
assert.ok(r.variants['nike-golf'].variants.some(v=>v.label.includes('이동')));assert.ok(r.variants['nike-com'].variants.some(v=>v.label.includes('이동')));assert.equal(r.patches['nike-com'].hidden,undefined);
for(const id of ['nike-7','nike-11','nike-react-2'])assert.equal(r.patches[id].hidden,true);
console.log('PASS Nike core/golf/dotcom/iPod/football group boundaries, duplicate redirects, primary/icon identity, manifest keys/counts, ambiguous artwork held');
