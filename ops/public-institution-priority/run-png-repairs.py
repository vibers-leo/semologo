"""Bounded repair of existing white PNGs using official PNGs and full-name OCR."""
import collections,fcntl,hashlib,io,json,re,runpy,shutil,subprocess,sys,tempfile,unicodedata
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit,unquote
from PIL import Image
BASE=Path('/root/projects/semologo-png-repair');BASE.mkdir(exist_ok=True)
runner=runpy.run_path('/root/projects/semologo-publisher/run.py');runner['credentials']()
core=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-core.py')
pub=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-publish.py')
digest=lambda b:hashlib.sha256(b).hexdigest()
def norm(s):
 s=unicodedata.normalize('NFKC',s or '').lower()
 s=re.sub(r'주식회사|재단법인|\(주\)|\(재\)','',s)
 return ''.join(c for c in s if c.isalnum())
def ocr(raw,name,folder):
 im=Image.open(io.BytesIO(raw)).convert('RGBA');im=im.crop(im.getchannel('A').getbbox())
 bg=Image.new('RGB',im.size,'#18181b' if pub['light_artwork'](raw) else 'white');bg.paste(im,mask=im.getchannel('A'))
 bg=bg.resize((1200,max(60,round(bg.height*1200/bg.width))))
 path=folder/'ocr.png';bg.save(path);expected=norm(name)
 if len(expected)<4:return ''
 for mode in ['7','11']:
  r=subprocess.run(['tesseract',str(path),'stdout','-l','kor+eng','--psm',mode],capture_output=True,text=True,timeout=15)
  if r.returncode==0 and expected in norm(r.stdout):
   if re.search(r'\d+\s*주년|anniversary|celebrating\s+\d+',r.stdout,re.I):continue
   return r.stdout.strip()[:300]
 return ''
def main():
 with (BASE/'run.lock').open('w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:return
  languages=subprocess.check_output(['tesseract','--list-langs'],stderr=subprocess.DEVNULL).decode()
  assert 'kor' in languages,'Korean OCR is required; never loosen name matching'
  ledger=BASE/'processed-jobs.json';done=json.loads(ledger.read_text()) if ledger.exists() else []
  code='const done='+json.dumps(done)+';'+r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});(async()=>{try{const q=await p.query("SELECT id,input,result FROM fleet.job WHERE tenant='internal' AND project='semologo' AND kind='semologo-domain-discover' AND status='succeeded' AND input->>'priority'='kr-public-institutions-20261025' AND NOT(id=ANY($1::uuid[])) ORDER BY CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(input->'targets') t WHERE coalesce((t->>'down')::int,0)>0) THEN 0 ELSE 1 END,created_at DESC LIMIT 6",[done]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
  jobs=core['node']('vibers-fleet',code)
  if not jobs:
   helper=Path('/root/projects/vibers-fleet/releases/20261025-semologo-public-priority/install-vector-repair-gates.py')
   if helper.exists():subprocess.run([sys.executable,str(helper),'--replay'],check=True)
   print(json.dumps({'status':'caught_up','jobs':0}),flush=True);return
  s3=core['s3_client']();plan=[];held=[]
  folder=BASE/datetime.now(timezone.utc).strftime('batch-%Y%m%dT%H%M%S');folder.mkdir();(folder/'reviewed-png').mkdir()
  for job in jobs:
   results=core['STAGE']['read_job'](s3,job)
   by_domain={r.get('domain'):r for r in results}
   for target in job['input'].get('targets',[]):
    ident=target.get('brand_id')
    if not ident:continue
    found={}
    try:
     state=pub['current'](core['node'],ident)
     if not state:raise ValueError('existing-identity-missing')
     b=state['payload'];meta=b.get('metadata') or {}
     if b.get('hidden') or meta.get('hidden') or b.get('merged_into'):raise ValueError('noncanonical-identity')
     if b.get('has_svg') or meta.get('has_svg') or b.get('logo_svg'):raise ValueError('native-vector-repair-lane-required')
     if b.get('name_ko')!=target['name']:raise ValueError('name-changed')
     selected=(b.get('presentation') or {}).get('file') or b.get('logo_png') or 'logo.png'
     if not isinstance(selected,str) or '..' in selected or selected.startswith(('http','/')):raise ValueError('nonlocal-current-file')
     original=pub['get'](s3,'_clients/'+ident+'/'+selected)
     old=Image.open(io.BytesIO(original)).convert('RGBA');old=old.crop(old.getchannel('A').getbbox());buf=io.BytesIO();old.save(buf,format='PNG')
     w,h=old.size;edge=[old.getpixel((x,y)) for y in [0,h-1] for x in range(w)]+[old.getpixel((x,y)) for x in [0,w-1] for y in range(h)]
     nearwhite=sum(p[3]>=250 and min(p[:3])>=245 for p in edge)/len(edge)>=.97
     if not nearwhite:raise ValueError('current-logo-already-transparent-or-needs-manual-review')
     domain=core['host'](target.get('homepage'));found=by_domain.get(domain,{})
     if found.get('status')!='candidate_review_required':raise ValueError('no-usable-official-logo-signal')
     accepted=None
     for url in found.get('logoCandidates',[])[:3]:
      try:
       if core['host'](url)!=domain:continue
       path=unquote(urlsplit(url).path)
       if core['BAD_PATH'].search(path) or re.search(r'anniver|\d+th|commemorat|certif',path,re.I):continue
       final,mime,raw=core['STAGE']['secure_get'](url,domain,2_000_000)
       if not raw.startswith(b'\x89PNG'):continue
       im=Image.open(io.BytesIO(raw));im.load()
       if im.width<150 or im.height<25 or im.width*im.height>4_000_000:continue
       rgba=im.convert('RGBA');box=rgba.getchannel('A').getbbox()
       if not box or rgba.getchannel('A').getextrema()[0]!=0:continue
       cropped=io.BytesIO();rgba.crop(box).save(cropped,format='PNG')
       if not pub['png_surface'](raw)['transparent'] or pub['png_surface'](cropped.getvalue())['white_canvas']:continue
       text=ocr(raw,target['name'],folder)
       if not text:continue
       filename=ident+'.png';(folder/'reviewed-png'/filename).write_bytes(raw)
       accepted={'id':ident,'name':target['name'],'filename':filename,'sourceUrl':url,
         'sourcePage':found['pageUrl'],'sha256':digest(raw),'identity_reviewed':True,
         'ocr_reviewed':True,'ocr':text,'method':'first-party-transparent-png-full-name-ocr'}
       break
      except Exception:continue
     if not accepted:raise ValueError('no-transparent-png-with-exact-full-name-ocr')
     if not any(p['id']==ident for p in plan):plan.append(accepted)
    except Exception as e:held.append({'id':ident,'name':target['name'],'reason':str(e)[:160],
     'jobId':job['id'],'officialSite':target.get('homepage'),'sourceCandidates':found.get('logoCandidates',[])})
  (folder/'reviewed-png-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2))
  (folder/'held.json').write_text(json.dumps(held,ensure_ascii=False,indent=2))
  if plan:
   subprocess.run([sys.executable,
    '/root/projects/vibers-fleet/releases/20261025-semologo-public-priority/publish-png-repairs.py',str(folder)],check=True)
  done=sorted(set(done+[j['id'] for j in jobs]));tmp=ledger.with_suffix('.tmp');tmp.write_text(json.dumps(done));tmp.replace(ledger)
  print(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'jobs':len(jobs),'jobIds':[j['id'] for j in jobs],'qualified':len(plan),'held':len(held),
   'heldReasons':dict(collections.Counter(h['reason'] for h in held)),'receipt':str(folder)},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
