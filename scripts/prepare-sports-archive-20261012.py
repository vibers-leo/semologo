"""Preserve existing sets and append reviewed archive vectors / mascot views."""
from pathlib import Path
import json, subprocess, hashlib, xml.etree.ElementTree as ET
import fitz, numpy as np, cairosvg
from PIL import Image, ImageDraw

R=Path(__file__).resolve().parents[1]
D=R/'marketing/assets/sports-archive-20261012'; D.mkdir(exist_ok=True)
T=Path('/Volumes/HDD-1TB/semologo-migration/task-tmp')
ids=['sk-wyverns','heroes','lotte-giants','ssglanders']
js="const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});p.query(\"SELECT p.id,p.payload,p.status,v.asset_manifest FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id=ANY($1::text[])\","+json.dumps([ids])+").then(r=>console.log(JSON.stringify(r.rows))).finally(()=>p.end());"
rows=json.loads(subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True).stdout)
assert len(rows)==len(ids)
(D/'cms-before.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
manifests={}
for row in rows:
    id=row['id']; assert row['status']=='published' and not row['payload'].get('hidden')
    raw=subprocess.run(['curl','-4','--fail','--silent','--max-time','30',f'https://logo.vibers.co.kr/_clients/{id}/variants.json'],capture_output=True)
    m=json.loads(raw.stdout) if raw.returncode==0 else {'id':id,'variants':[]}
    for v in (row['asset_manifest'] or {}).get('variants',{}).get('variants',[]):
        index=next((i for i,x in enumerate(m['variants']) if x['key']==v['key']),None)
        if index is None:m['variants'].append(v)
        else:assert m['variants'][index]['files']==v['files']; m['variants'][index]=v
    manifests[id]=m
uploads=[]; previews=[]
def append(id,key,label,svg,metadata,form):
    root=ET.fromstring(svg)
    assert not any(x.tag.split('}')[-1] in ['image','script','foreignObject'] for x in root.iter())
    assert 'data:image' not in svg.decode()
    path=D/(key+'.svg'); path.write_bytes(svg)
    box=list(map(float,root.get('viewBox').replace(',',' ').split()))
    scale=2000/max(box[2:]); png=path.with_suffix('.png')
    cairosvg.svg2png(url=str(path),write_to=str(png),output_width=round(box[2]*scale),output_height=round(box[3]*scale))
    im=Image.open(png).convert('RGBA'); assert im.getbbox(); im.thumbnail((640,640))
    preview=D/(key+'-preview.png'); im.save(preview); files={}
    for ext,p in [('svg',path),('png',png),('preview',preview)]:
        sha=hashlib.sha256(p.read_bytes()).hexdigest(); file='sources/sports-archive-20261012/'+sha[:20]+p.suffix
        files[ext]=file; uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
    m=manifests[id]; assert not any(v['key']==key for v in m['variants'])
    m['variants'].append({'key':key,'label':label,'form':form,'lang':'none','color':'original','files':{x:files[x] for x in ['svg','png']},'preview_png':files['preview'],'order':len(m['variants']),**metadata})
    previews.append((key,preview))

category=json.loads((T/'kbo-commons-category.json').read_text())['query']['pages'].values()
archives=[('sk-wyverns','File:SK Wyverns insignia.svg','SK 와이번스 · 모자 심볼 · 위키미디어 2015판'),('heroes','File:Nexen Heroes insignia.svg','넥센 히어로즈 · 모자 심볼 · 위키미디어 2014판'),('lotte-giants','File:Busan Giants cap insignia.svg','롯데 자이언츠 · 부산 모자 심볼 · 위키미디어 수록본')]
for id,title,label in archives:
    info=next(p for p in category if p['title']==title)['imageinfo'][0]
    svg=subprocess.run(['curl','-4','--fail','--silent','--max-time','30',info['url'].split('?')[0]],capture_output=True,check=True).stdout
    key='commons-'+title[5:-4].lower().replace(' ','-')+'-20261012'
    append(id,key,label,svg,{'origin':'wikimedia','official_distribution':False,'provider':'Wikimedia Commons · 구단 원출처 표기','source_url':info['descriptionurl'],'license':info['extmetadata']['LicenseShortName']['value'],'source_note':'Commons 파일 페이지의 제작자·출처·라이선스 보존. 구단의 현 공식 배포본으로 표시하지 않음. 로고 도입 연도는 미확인.','historical':id!='lotte-giants'},'symbol')
    (D/(key+'-source.json')).write_text(json.dumps(info,ensure_ascii=False,indent=2))

base=R/'marketing/assets/baseball-official-20261012/ssg'
for stem,name in [('Landy','랜디'),('Poorie','푸리'),('Batty','배티')]:
    page=fitz.open(next(base.rglob('Mascot_'+stem+'.ai')))[0]
    pix=page.get_pixmap(alpha=True); a=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)[:,:,-1]
    xs=np.flatnonzero(a.max(axis=0)>0); groups=np.split(xs,np.where(np.diff(xs)>5)[0]+1); assert len(groups)==4
    for i,g in enumerate(groups[1:],start=2):
        x0,x1=int(g[0]),int(g[-1]); ys=np.flatnonzero(a[:,x0:x1+1].max(axis=1)>0)
        box=fitz.Rect(x0-5,int(ys[0])-5,x1+6,int(ys[-1])+6)
        root=ET.fromstring(page.get_svg_image(text_as_path=True)); root.set('viewBox',f'{box.x0} {box.y0} {box.width} {box.height}');root.set('width',str(box.width));root.set('height',str(box.height))
        append('ssglanders',f'official-ssg-{stem.lower()}-view-{i}-20261012',f'{name} 마스코트 · '+{2:'사선',3:'측면',4:'후면'}[i],ET.tostring(root),{'origin':'official','official_distribution':True,'source_url':'https://www.ssglanders.com/landers/emblem','source_note':'공식 AI 원본에서 SVG 뷰포트만 분리. 캐릭터 재작성 없음.'},'mascot')

release={'patches':{id:{'variants_n':len(m['variants'])} for id,m in manifests.items()},'variants':manifests}
(D/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
(D/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n')
sheet=Image.new('RGB',(1200,900),'#e8e8e8'); draw=ImageDraw.Draw(sheet)
for n,(key,p) in enumerate(previews):
    im=Image.open(p); im.thumbnail((270,245)); x=(n%4)*300; y=(n//4)*300
    sheet.paste(im,(x+(300-im.width)//2,y+35),im); draw.text((x+6,y+8),key.replace('-20261012',''),fill='black')
sheet.save(D/'review.jpg')
print('READY: 3 archive/alternate insignias and 9 extra mascot views; visual review required')
