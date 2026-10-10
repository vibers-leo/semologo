"""Read-only sample of public logo bytes. Does not establish population quality."""
import concurrent.futures,datetime,io,json,pathlib,re,subprocess,time
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/growth-quality-20261011')
def get(url):
 t=time.monotonic();p=subprocess.run(['curl','--http1.1','-fLsS','--max-time','20','--max-filesize','6291456',url],capture_output=True)
 return p,time.monotonic()-t
def check(b):
 id=b['id'];base='https://logo.vibers.co.kr/_clients/'+id+'/'
 paths=[]
 if b.get('preview_png'):paths.append(b['preview_png'])
 paths.append(b.get('logo_png') if isinstance(b.get('logo_png'),str) else 'logo.png')
 if 'logo-transparent.png' not in b.get('rejected_asset_files',[]):paths.append('logo-transparent.png')
 result={'id':id,'svg_claimed':bool(b.get('has_svg') or b.get('logo_svg')),'png_attempts':[]}
 for path in dict.fromkeys(paths):
  url=path if path.startswith('http') else ('https://semologo.com'+path if path.startswith('/') else base+path)
  p,elapsed=get(url);attempt={'url':url,'curl_exit':p.returncode,'seconds':round(elapsed,3)}
  try:
   assert p.returncode==0
   with Image.open(io.BytesIO(p.stdout)) as im:
    im.load();attempt.update(format=im.format,size=list(im.size));assert im.format=='PNG'
    rgba=im.convert('RGBA');attempt['alpha_extrema']=rgba.getchannel('A').getextrema();attempt['transparent_pixels_present']=attempt['alpha_extrema'][0]<255
    attempt['all_four_corners_opaque_white']=all(rgba.getpixel(x)==(255,255,255,255) for x in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)])
   attempt['status']='decoded-png';result['png']=attempt;result['png_attempts'].append(attempt);break
  except Exception:attempt['status']='unavailable-or-not-png';result['png_attempts'].append(attempt)
 if result['svg_claimed']:
  path=b.get('svg_transparent') or (b.get('logo_svg') if isinstance(b.get('logo_svg'),str) else 'logo.svg');url=path if path.startswith('http') else ('https://semologo.com'+path if path.startswith('/') else base+path);p,e=get(url)
  result['svg']={'url':url,'curl_exit':p.returncode,'seconds':round(e,3),'svg_root_present':bool(re.search(rb'<svg\b',p.stdout)),'raster_or_active_content':bool(re.search(rb'<(?:image|script|foreignObject)\b|data:image',p.stdout,re.I))}
 return result
def main():
 OUT.mkdir(exist_ok=True);p,_=get('https://semologo.com/api/catalog/?limit=30');assert p.returncode==0;r=json.loads(p.stdout);assert len(r['brands'])==30
 (OUT/'catalog.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(check,r['brands']))
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sample':'first30 default fame ranking; not random; not population estimate','public_catalog_items':r['total'],'sample_n':len(rows),'decoded_png':sum('png' in b for b in rows),'transparent_png':sum(b.get('png',{}).get('transparent_pixels_present',False) for b in rows),'verified_svg_bytes':sum(b.get('svg',{}).get('svg_root_present',False) and not b.get('svg',{}).get('raster_or_active_content',True) for b in rows),'note':'Opaque corners are review candidates, not proof of unwanted background. No images modified. Recovery API not exercised.','rows':rows}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False))
if __name__=='__main__':main()
