from pathlib import Path
import json,subprocess,hashlib,io,zipfile,fitz
from lxml import etree as E
from PIL import Image,ImageDraw
import cairosvg
root=Path.cwd();out=root/'marketing/assets/institutions-20261010-b5';q=json.load(open(root/'marketing/assets/public-institution-vectors-20261007/prepared-review.json'))['visual_queue'];patches={};variants={};uploads=[];review=[]
for idx in [61,209]:
 r=q[idx];id=r['candidates'][0];remote=subprocess.check_output(['curl','-fsSL','--max-time','60',r['url']]);local=(root/r['source_file']).read_bytes();assert remote==local
 assert zipfile.ZipFile(io.BytesIO(remote)).testzip() is None
 variants[id]={'schema':1,'algo_v':2,'id':id,'primary':'','variants':[]};review.append({'id':id,'name':r['name'],'source_page':r['source_page'],'source_url':r['url'],'sha256':hashlib.sha256(remote).hexdigest(),'member_key':r['member_key']})
def extract(id,key,original,page,box,form,text,label):
 doc=fitz.open(out/id/original);p=doc[page];pdf=fitz.open();pdf.insert_pdf(doc,from_page=page,to_page=page);tmp=out/id/(key+'-page.pdf');pdf.save(tmp);sv=out/id/(key+'-full.svg');subprocess.run(['pdftocairo','-svg',str(tmp),str(sv)],check=True);el=E.fromstring(p.get_svg_image().encode());assert not el.xpath('//*[local-name()="image"]')

 for node in el.xpath('//*[local-name()="path" and @fill="#ffffff"]'):
  if node.get('d') in ['M0 .003H841.89V595.278H0Z','M.001 .003H841.88998V595.278H.001Z']:node.getparent().remove(node)
 vb=list(map(float,el.get('viewBox').split()));b=[box[0]/p.rect.width*vb[2],box[1]/p.rect.height*vb[3],(box[2]-box[0])/p.rect.width*vb[2],(box[3]-box[1])/p.rect.height*vb[3]]
 el.set('viewBox',' '.join(map(str,b)));el.set('width',str(b[2]));el.set('height',str(b[3]));im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=E.tostring(el),output_width=1600))).convert('RGBA');bb=im.getbbox();assert bb and bb[0]>0 and bb[1]>0 and bb[2]<im.width and bb[3]<im.height,(key,bb,im.size)
 pad=8;nv=[b[0]+(bb[0]-pad)/im.width*b[2],b[1]+(bb[1]-pad)/im.height*b[3],(bb[2]-bb[0]+2*pad)/im.width*b[2],(bb[3]-bb[1]+2*pad)/im.height*b[3]];el.set('viewBox',' '.join(map(str,nv)));el.set('width',str(nv[2]));el.set('height',str(nv[3]));svg=E.tostring(el);png=cairosvg.svg2png(bytestring=svg,output_width=1200);rel='sources/official-institution-20261010-b5/'+hashlib.sha256(svg).hexdigest()[:16]
 for ext,data in [('svg',svg),('png',png)]:
  f=out/id/(key+'.'+ext);f.write_bytes(data);uploads.append({'id':id,'file':str(f.relative_to(root)),'key':'_clients/'+id+'/'+rel+'.'+ext,'sha256':hashlib.sha256(data).hexdigest()})
 variants[id]['variants'].append({'key':key,'form':form,'lockup':form,'text_layout':text,'asset_group':'symbol' if form=='symbol' else 'logotype','lang':'none' if text=='none' else 'en' if text=='en' else 'ko','color':'original','label':label,'files':{'svg':rel+'.svg','png':rel+'.png'},'provider':'기관 공식 CI 원본','source_url':next(x['source_page'] for x in review if x['id']==id),'origin':'derived','order':len(variants[id]['variants'])})
id='gongu-ci-0246'
extract(id,'symbol','original-0.ai',0,(280,175,565,395),'symbol','none','심볼마크')
for page,kind in [(1,'A'),(2,'B')]:
 for box,lang,txt in [((130,140,375,415),'ko','국문'),((460,140,715,430),'ko-en-vertical','국영문 상하조합')]:extract(id,'vertical-'+kind+'-'+lang,'original-0.ai',page,box,'vertical',lang,'세로조합형 '+kind+' · '+txt)
for box,lang,txt in [((170,130,710,260),'ko','국문 좌우조합'),((170,310,710,445),'ko-en-vertical','국영문 좌우조합')]:extract(id,'horizontal-'+lang,'original-0.ai',3,box,'horizontal',lang,txt)
for box,lang,txt in [((245,125,590,225),'ko','국문 로고타입'),((245,325,590,445),'ko-en-vertical','국영문 로고타입')]:extract(id,'wordmark-'+lang,'original-0.ai',4,box,'wordmark',lang,txt)
for box,lang,txt in [((205,218,535,285),'ko','국문 좌우조합'),((205,405,490,475),'en','영문 좌우조합'),((205,599,495,665),'ko-en-vertical','국영문 좌우조합')]:extract('kdi','horizontal-'+lang,'original-6.ai',0,box,'horizontal',lang,txt)
for r in review:
 id=r['id'];vs=variants[id];vs['primary']='vertical-B-ko-en-vertical' if id=='gongu-ci-0246' else 'horizontal-ko-en-vertical';f=next(v for v in vs['variants'] if v['key']==vs['primary'])['files'];patches[id]={'has_svg':True,'has_png':True,'logo_svg':f['svg'],'svg_transparent':f['svg'],'logo_png':f['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+id+'/'+f['png'],'official_source_page':r['source_page'],'official_zip_url':r['source_url'],'asset_origin':'공식 기관 CI 원본 · 조합별 전체 도형 범위 검수','light':False,'light_logo':False,'dark_variant':False}
(out/'release.json').write_text(json.dumps({'patches':patches,'variants':variants},ensure_ascii=False,indent=2));(out/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2));(out/'review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2))
c=Image.new('RGB',(1200,((len(uploads)//2+2)//3)*230),'#ddd');d=ImageDraw.Draw(c)
for j,(id,v) in enumerate((id,v) for id,vs in variants.items() for v in vs['variants']):
 im=Image.open(out/id/(v['key']+'.png')).convert('RGBA');im.thumbnail((375,175));x=j%3*400;y=j//3*230;c.paste(im,(x+(400-im.width)//2,y+(180-im.height)//2),im);d.text((x+8,y+195),id+' '+v['key'],fill='black')
c.save(out/'contact.jpg');print('PASS',len(patches),'institutions',len(uploads)//2,'variants')
