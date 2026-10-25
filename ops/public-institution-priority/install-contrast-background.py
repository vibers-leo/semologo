"""Choose readable backgrounds for light gray official artwork too."""
from pathlib import Path
import py_compile,runpy,io
from PIL import Image
p=Path('/root/projects/semologo-publisher/scripts/fleet-auto-publish.py');old=p.read_text()
if 'median_luminance' not in old:
 start=old.index('def light_artwork(png):');end=old.index('\ndef get(',start)
 function='''def light_artwork(png):
    with Image.open(io.BytesIO(png)) as opened:
        image=opened.convert('RGBA')
    image.thumbnail((400,400))
    linear=[v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4 for v in range(256)]
    values=sorted(.2126*linear[r]+.7152*linear[g]+.0722*linear[b]
                  for r,g,b,a in image.get_flattened_data() if a>160)
    if not values:return False
    median_luminance=values[len(values)//2]
    light_bg=linear[250]
    dark_bg=.9278*linear[20]+.0722*linear[24]
    contrast=lambda bg:(max(bg,median_luminance)+.05)/(min(bg,median_luminance)+.05)
    return contrast(dark_bg)>contrast(light_bg)*1.1

'''
 new=old[:start]+function+old[end:];p.with_name(p.name+'.before-contrast-background-20261025').write_text(old)
 tmp=p.with_suffix('.contrast.py');tmp.write_text(new);py_compile.compile(str(tmp),doraise=True);tmp.replace(p)
f=runpy.run_path(str(p))['light_artwork']
for color,want_dark in [((204,204,204),True),((255,255,255),True),((30,30,30),False),((0,50,160),False)]:
 image=Image.new('RGBA',(200,50),(*color,255));buf=io.BytesIO();image.save(buf,format='PNG');assert f(buf.getvalue())==want_dark
print('PASS light-gray and white artwork prefer dark; black/blue artwork prefer light')
