"""Guard against opaque PNG regressions, lost calendar whites and tiny em-sized SVG rasterization."""
import importlib.util,io,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/google-background-review-20261009'
def main():
 release=json.loads((OUT/'release.json').read_text());assert len(release['patches'])==13
 for id,p in release['patches'].items():
  im=Image.open(OUT/'release'/id/p['logo_png']).convert('RGBA');assert max(im.size)>=790,(id,im.size);assert im.getextrema()[3]==(0,255),id
  alpha=im.getchannel('A');assert sum(v==0 for v in alpha.getdata())>im.width*im.height*.02,id
  if id=='google-calendar':assert sum(a==255 and min(r,g,b)>250 for r,g,b,a in im.getdata())>im.width*im.height*.15
 spec=importlib.util.spec_from_file_location('p',ROOT/'scripts/prepare-google-transparent-release.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
 raw=b'<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256"><defs><linearGradient id="g"><stop stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path fill="url(#g)" d="M0 0h256v256H0z"/></svg>'
 im=Image.open(io.BytesIO(p.render(raw))).convert('RGBA');assert im.size==(800,800);samples={im.getpixel((x,400))[0] for x in range(800)};assert len(samples)>200, 'Low resolution raster upscaled instead of rendering vector at target size'
 print('PASS 13 transparent high-resolution PNGs, internal calendar white, em SVG resolution and gradient preservation')
if __name__=='__main__':main()
