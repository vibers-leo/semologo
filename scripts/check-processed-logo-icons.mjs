import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {monochromeIconVector,processedIconSvg} from '../src/lib/processed-logo-icon.ts';
const svg=(body,attrs='')=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attrs}>${body}</svg>`);
const source=svg('<path fill="#cc1122" fill-rule="evenodd" d="M10 10H90V90H10Z M30 30H70V70H30Z"/>');
const vector=monochromeIconVector(source);assert.equal(vector.color,'#cc1122');assert.match(vector.body,/M30 30H70V70H30Z/);assert.match(vector.body,/evenodd/);
for(const body of ['<script>alert(1)</script>','<image href="https://example.com/a.svg"/>','<image href="data:image/svg+xml;base64,AA=="/>','<foreignObject/>','<path onclick="a()" d="M0 0L1 1"/>','<path style="fill:url(https://example.com/x)"/>','<path fill="#123456"/><path fill="#654321"/>','<text>A</text>'])assert.throws(()=>monochromeIconVector(svg(body)));
assert.throws(()=>monochromeIconVector(Buffer.from('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>')));
assert.throws(()=>monochromeIconVector(svg('<path d="M0 0L1 1"/>','onload="alert(1)"')));
assert.throws(()=>monochromeIconVector(svg('<path d="M0 0L1 1"/>','viewBox="0 0 1 1"')));
assert.throws(()=>processedIconSvg(vector,'circle','red" onload="a'));
for(const shape of ['circle','square']){
 const output=processedIconSvg(vector,shape,'#cc1122');const {data,info}=await sharp(output).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1024);assert.equal(info.height,1024);const pixel=(x,y)=>Array.from(data.subarray((y*1024+x)*info.channels,(y*1024+x+1)*info.channels));
 assert.deepEqual(pixel(512,512).slice(0,3),[204,17,34],'The interior counter must keep the background, not become white.');assert.deepEqual(pixel(512,300).slice(0,3),[255,255,255]);if(shape==='circle')assert.equal(pixel(0,0)[3],0);
}
const baemin=monochromeIconVector(readFileSync('marketing/assets/baemin-guide-fix-20261010/baemin/wordmark-black.svg'));const out=processedIconSvg(baemin,'circle','#2ac1bc');await sharp(out).png().toFile('marketing/assets/processed-logo-icons-20261010/baemin-processed-example.png');writeFileSync('marketing/assets/processed-logo-icons-20261010/baemin-processed-example.svg',out);
console.log('PASS: malicious SVG, external references, entities, multicolor, duplicate attributes blocked; counter shape and 1024 PNG preserved.');
