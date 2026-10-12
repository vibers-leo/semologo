from pathlib import Path
import xml.etree.ElementTree as E,json,hashlib,subprocess,shlex,mimetypes,io
import cairosvg,boto3
from botocore.config import Config
from PIL import Image
R=Path('/Volumes/HDD-1TB/semologo-migration/20261005/project');D=R/'marketing/assets/cyberpixie-transparent-20261012';D.mkdir(exist_ok=True)
raw=Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/cyberpixie.svg').read_bytes();(D/'original.svg').write_bytes(raw)
t=E.fromstring(raw);g=t[0];assert g[0].get('fill')=='#fff' and g[0].get('d')=='M0 0h192.756v192.756H0V0z';g.remove(g[0]);out=E.tostring(t);png=cairosvg.svg2png(bytestring=out,output_width=2000,output_height=2000);im=Image.open(io.BytesIO(png));box=im.getbbox();assert box; x,y,x2,y2=box;pad=12;x=max(0,x-pad);y=max(0,y-pad);x2=min(2000,x2+pad);y2=min(2000,y2+pad)
t.set('viewBox',f'{x/2000*192.756} {y/2000*192.756} {(x2-x)/2000*192.756} {(y2-y)/2000*192.756}');t.set('width',str(x2-x));t.set('height',str(y2-y));out=E.tostring(t);png=cairosvg.svg2png(bytestring=out,output_width=2000);assert Image.open(io.BytesIO(png)).getextrema()[3][0]==0
files={}; uploads=[]
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 line=line.removeprefix('export ')
 if '=' in line:
  k,v=line.split('=',1)
  if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required'))
for ext,b in [('svg',out),('png',png)]:
 f='sources/transparent-20261012/'+hashlib.sha256(b).hexdigest()[:16]+'.'+ext;files[ext]=f;(D/('transparent.'+ext)).write_bytes(b);key='_clients/cyberpixie/'+f;s3.put_object(Bucket='vibers-bucket',Key=key,Body=b,ACL='public-read',ContentType=mimetypes.guess_type(f)[0],CacheControl='public,max-age=31536000,immutable');assert subprocess.run(['curl','-fsSL','https://logo.vibers.co.kr/'+key],capture_output=True,check=True).stdout==b
patch={'has_svg':True,'has_png':True,'logo_svg':files['svg'],'svg_transparent':files['svg'],'logo_png':files['png'],'preview_png':'https://logo.vibers.co.kr/_clients/cyberpixie/'+files['png'],'presentation':{'file':files['png'],'bg':'light'},'light':False,'light_logo':False,'dark_variant':False,'asset_review_status':'verified','variants_n':2}
manifest={'id':'cyberpixie','primary':'transparent-reviewed','variants':[{'key':'transparent-reviewed','label':'투명 배경 로고','form':'logo','color':'original','files':files,'origin':'derived','provider':'보유 SVG · 전체 흰 배경 도형만 제거','order':0},{'key':'original','label':'원본 SVG · 흰 배경','form':'logo','files':{'svg':'logo.svg'},'origin':'collected','order':1}]}
data={'patch':patch,'manifest':manifest}
js='const data='+json.dumps(data,ensure_ascii=False)+';'+'''const {Pool}=require('pg');(async()=>{let p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL});let d=await p.connect();try{await d.query('BEGIN');let b=await d.query("SELECT payload FROM semologo.logo_posts WHERE id='cyberpixie' AND status='published' FOR UPDATE");if(b.rowCount!==1)throw Error('identity');console.log(JSON.stringify(b.rows[0]));await d.query("UPDATE semologo.logo_posts SET payload=payload||$1::jsonb,updated_at=now() WHERE id='cyberpixie'",[JSON.stringify({...data.patch,metadata:{...b.rows[0].payload.metadata,has_svg:true,has_png:true}})]);await d.query("UPDATE semologo.logo_versions SET asset_manifest=coalesce(asset_manifest,'{}'::jsonb)||$1::jsonb WHERE brand_id='cyberpixie' AND is_current",[JSON.stringify({variants:data.manifest})]);await d.query('COMMIT')}catch(e){await d.query('ROLLBACK');throw e}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);(D/'before.json').write_text(r.stdout);(D/'release.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));s3.put_object(Bucket='vibers-bucket',Key='_clients/cyberpixie/variants.json',Body=json.dumps(manifest,ensure_ascii=False).encode(),ACL='public-read',ContentType='application/json',CacheControl='public,max-age=60');print('PASS transparent SVG/PNG CDN verified, CMS representative updated')
