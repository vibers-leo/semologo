import fitz,json
from pathlib import Path
p=Path('marketing/assets/requested-finance-business-20261011/shinhan-securities');d=fitz.open(p/'official-report.pdf');box=fitz.Rect(884,529,998,556);drawings=[x for x in d[0].get_drawings() if box.contains(x['rect'])];assert len(drawings)==7
out=fitz.open();page=out.new_page(width=d[0].rect.width,height=d[0].rect.height)
for x in drawings:
 shape=page.new_shape()
 for it in x['items']:
  if it[0]=='l':shape.draw_line(it[1],it[2])
  elif it[0]=='c':shape.draw_bezier(it[1],it[2],it[3],it[4])
  elif it[0]=='re':shape.draw_rect(it[1])
  elif it[0]=='qu':shape.draw_quad(it[1])
  else:raise ValueError(it[0])
 shape.finish(fill=x['fill'],color=x['color'],width=x['width'] or 0,closePath=x['closePath'],even_odd=x.get('even_odd',False),fill_opacity=x.get('fill_opacity') or 1,stroke_opacity=x.get('stroke_opacity') or 1);shape.commit()
page.set_cropbox(box);s=page.get_svg_image(text_as_path=True);assert '<image' not in s;(p/'logo.svg').write_text(s);page.get_pixmap(matrix=fitz.Matrix(12,12),alpha=True).save(p/'logo.png');print('PASS 7 original vector paths, no raster')
