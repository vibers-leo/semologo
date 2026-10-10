const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../src/lib/logo-optical-size.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out,Map,setTimeout,clearTimeout});
const bounds=(w,h)=>({width:w,height:h,x:0,y:0,inkWidth:w,inkHeight:h});
const square=out.opticalFit(bounds(100,100),200,180),wide=out.opticalFit(bounds(800,100),200,180);
assert(square.height<140,'Square marks should have breathing room');
assert(wide.width>160&&wide.width<=176,'Wide marks grow but retain side margins');
for(const ratio of [.2,.5,1,2,4,8,20]){const b=bounds(100*ratio,100),f=out.opticalFit(b,200,180);assert(f.width<=176.001&&f.height<=129.601);assert(Math.abs(f.width/f.height-ratio)<.0001);}
const padded={width:500,height:300,x:90,y:60,inkWidth:300,inkHeight:100};
const f=out.opticalFit(padded,200,180),scale=f.width/padded.width;
assert(Math.abs(f.offsetX+(padded.x+padded.inkWidth/2-padded.width/2)*scale)<.001,'Actual ink stays centered');
console.log('PASS optical proportions, side margins, no distortion, and off-center whitespace compensation.');
