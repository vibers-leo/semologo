from pathlib import Path
import fitz,shutil
root=Path(__file__).resolve().parents[1]/'marketing/assets/seongnam-official-20261006';out=root/'publish';out.mkdir(exist_ok=True)
for key,box,name in [('CI_BS04',(188,440,376,510),'horizontal'),('CI_BS05',(181,400,265,550),'vertical'),('CI_BS01',(85,170,275,350),'symbol')]:
 d=fitz.open(root/(key+'.ai'));clip=fitz.Rect(box);paths=[x for x in d[0].get_drawings() if clip.contains(x['rect']) and x.get('fill') is not None]
 assert paths,name
 bound=fitz.Rect(paths[0]['rect'])
 for p in paths:bound|=p['rect']
 doc=fitz.open();page=doc.new_page(width=595.276,height=841.89)
 for p in paths:
  shape=page.new_shape()
  for it in p['items']:
   if it[0]=='l':shape.draw_line(it[1],it[2])
   elif it[0]=='c':shape.draw_bezier(it[1],it[2],it[3],it[4])
   elif it[0]=='re':shape.draw_rect(it[1])
   elif it[0]=='qu':shape.draw_quad(it[1])
   else:raise ValueError(it[0])
  shape.finish(fill=p['fill'],color=p.get('color'),width=p.get('width') or 0,closePath=p.get('closePath',True),even_odd=p.get('even_odd',False),fill_opacity=p.get('fill_opacity') or 1,stroke_opacity=p.get('stroke_opacity') or 1);shape.commit()
 page.set_cropbox(bound+(-2,-2,2,2))
 (out/(name+'.svg')).write_text(page.get_svg_image())
 page.get_pixmap(matrix=fitz.Matrix(800/page.rect.width,800/page.rect.width),alpha=True).save(out/(name+'.png'))
 print(name,len(paths),page.rect)
shutil.copy2('/Users/juuuno/Downloads/Ci_AI.zip',out/'official-ci-20261006.zip')
