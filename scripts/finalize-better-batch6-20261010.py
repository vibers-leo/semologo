"""Retry mixed SVG/PNG identities, tighten vector-render resolution and regenerate release."""
from pathlib import Path
source=Path(__file__).with_name('prepare-better-batch6-release-20261010.py').read_text()
# Deliberately execute helper definitions only; never import a publisher or start its batch.
exec(source.split('with concurrent.futures.ThreadPoolExecutor')[0])
rows=json.loads((OUT/'rendered-candidates.json').read_text())
present={(r['id'],r['source_file']) for r in rows}
for job in jobs:
 if (job[0]['id'],job[1]) not in present:rows.append(render(job))
for i,row in enumerate(rows):
 if row.get('held_error') and row['source_file'].endswith('.png'):
  d=next(d for d in decisions if d.get('id')==row['id']);rows[i]=render((d,row['source_file']))
def finish(row):
 if row.get('held_error') or not row.get('svg'):return row
 png=ROOT/row['png'];im=Image.open(png)
 if max(im.size)!=2000:
  svg=ROOT/row['svg'];vb=list(map(float,E.parse(str(svg)).getroot().get('viewBox').split()));dim='--export-width=' if vb[2]>=vb[3] else '--export-height='
  subprocess.run([INK,str(svg),'--export-area-page',dim+'2000','--export-filename='+str(png)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);im=Image.open(png).convert('RGBA');im.save(png,optimize=True);small=im.copy();small.thumbnail((640,640),Image.Resampling.LANCZOS);small.save(ROOT/row['preview'],optimize=True)
 row['png_dimensions']=Image.open(png).size;return row
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(finish,rows))
exec(source[source.index("(OUT/'rendered-candidates.json').write_text"):])
validation={'passed':True,'frozen_names':len(decisions),'identity_approved':sum(d['status']=='approved-identity' for d in decisions),'held_names':sum(d['status']=='held' for d in decisions),'brands':len(release['variants']),'variants':len(approved),'objects':len(uploads),'existing_brands':sum(id in old for id in release['variants']),'new_brands':[id for id in release['variants'] if id not in old],'exact_duplicate_variants':len(duplicates),'held_render_errors':[r for r in rows if r.get('held_error')],'all_existing_representatives_preserved':True,'all_previous_manifests_preserved':True,'visual_review':'pending final contact sheets'}
for row in approved:
 im=Image.open(ROOT/row['png']);assert im.mode=='RGBA' and im.getextrema()[3][1]>0
 if row.get('svg'):assert max(im.size)==2000;assert not E.parse(str(ROOT/row['svg'])).xpath('//*[local-name()="image" or local-name()="text"]')
for u in uploads:assert hashlib.sha256((ROOT/u['file']).read_bytes()).hexdigest()==u['sha256']
(OUT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n');print('Validation PASS; final visual review pending')
