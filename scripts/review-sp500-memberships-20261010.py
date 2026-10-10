"""Read-only identity/PNG evidence; never publish a collection or overwrite its roster."""
from pathlib import Path
import json,subprocess,hashlib,io,concurrent.futures,re
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/sp500-membership-review-20261010';OUT.mkdir(exist_ok=True)
MAP={'ABT':'abbott-laboratories','ABBV':'abbvie','ACN':'accenture','ABNB':'airbnb','ALL':'allstate','AXP':'american-express','T':'att','ADSK':'autodesk','BAC':'bank-of-america','BA':'boeing','CAT':'caterpillar','CVX':'chevron','CSCO':'cisco','KO':'the-coca-cola-company','COST':'costco','CVS':'cvs-health','DHR':'danaher-corporation','DELL':'dell-technologies','XOM':'exxon-mobil','FDX':'fedex-corporation','F':'ford-motor-company','GS':'goldmansachs','HD':'homedepo'}
MAP.update({"AFL":"aflac","AEP":"american-electric-power","AIG":"american-international-group","BBY":"best-buy","BLK":"blackrock","C":"citigroup"});MAP["T"]="atandt"
ids=list(MAP.values())
js='const {Pool}=require("pg");(async()=>{let p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL});let r=await p.query("SELECT id,payload,status FROM semologo.logo_posts WHERE id=ANY($1)",['+json.dumps(ids)+']);console.log(JSON.stringify(r.rows));await p.end()})()'
r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);(OUT/'brand-cms.json').write_text(r.stdout);brands={b['id']:b for b in json.loads(r.stdout)}
base=json.loads((OUT/'cms-before.json').read_text());members=base['members'];rows=[]
def audit(pair):
 ticker,id=pair;member=next(m for m in members if ticker in m['metadata']['tickers']);b=brands[id];p=b['payload'];assert b['status']=='published' and not p.get('hidden') and not p.get('merged_into')
 candidates=[]
 for f in [p.get('preview_png'),p.get('logo_png'),'logo.png','logo-transparent.png']:
  if f:
   url=f if f.startswith('https://') else f'https://logo.vibers.co.kr/_clients/{id}/{f}'
   if url not in candidates:candidates.append(url)
 evidence={'snapshot_id':member['snapshot_id'],'member_key':member['member_key'],'name':member['name'],'tickers':member['metadata']['tickers'],'brand_id':id,'previous_status':member['review_status'],'candidate_company_name':p.get('name_en'),'identity_reviewed':False,'png_verified':False}
 for url in candidates:
  try:
   raw=subprocess.run(['curl','-fsSL','--max-time','20','--max-filesize','9000000','-H','Referer: https://semologo.com/','-H','Origin: https://semologo.com',url],capture_output=True,check=True).stdout
   im=Image.open(io.BytesIO(raw));im.load();assert im.format=='PNG' and max(im.size)>32
   f=OUT/(id+'.png');f.write_bytes(raw);evidence.update(png_verified=True,png_url=url,asset_sha256=hashlib.sha256(raw).hexdigest(),dimensions=im.size,file=str(f.relative_to(ROOT)));break
  except Exception:pass
 return evidence
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(audit,MAP.items()))
(OUT/'candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
sheet=Image.new('RGB',(1200,150*8),'#e2e2e2');d=ImageDraw.Draw(sheet)
for i,row in enumerate(rows):
 x=i%4*300;y=i//4*150;d.text((x+5,y+5),row['tickers'][0]+' / '+row['brand_id'],fill='black')
 if row['png_verified']:
  im=Image.open(ROOT/row['file']).convert('RGBA');im.thumbnail((280,115));sheet.paste(im,(x+10,y+28),im)
 else:d.text((x+10,y+28),'PNG FAILED',fill='red')
sheet.save(OUT/'contact.jpg');print('Decoded',sum(r['png_verified'] for r in rows),'/',len(rows),'PNGs; visual identity review pending')
