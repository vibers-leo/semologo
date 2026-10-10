"""Publish only three reviewed PNG repairs, then apply guarded representative corrections."""
from pathlib import Path
import json,subprocess,hashlib,io,urllib.request
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/quality-followup-20261010/recovery-release';IDS={'no-verca','noordned','paddington'}
release=json.loads((OUT/'release.json').read_text());corrections=release['patches'];assert set(corrections)==IDS
backup=OUT/'correction-patches.json'
if backup.exists():assert json.loads(backup.read_text())==corrections or all('svg_transparent' not in p for p in corrections.values());corrections=json.loads(backup.read_text())
else:backup.write_text(json.dumps(corrections,ensure_ascii=False,indent=2)+'\n')
for patch in release['patches'].values():patch.pop('svg_transparent',None)
(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
corrections=json.loads(backup.read_text())
uploads=json.loads((OUT/'uploads.json').read_text());bykey={u['key']:u for u in uploads}
subprocess.run(['python3',str(ROOT/'scripts/publish-community-variants-20261010.py'),'--release-dir',str(OUT)],check=True)
proof=[]
for id,patch in corrections.items():
 assert patch['has_svg'] is False and patch['logo_svg'] is None and patch['svg_transparent'] is None
 assert patch['presentation']['file']==patch['logo_png'];key='_clients/'+id+'/'+patch['logo_png'];assert key in bykey
 for field in ['logo_png','preview_png']:
  url=patch[field] if patch[field].startswith('https:') else 'https://logo.vibers.co.kr/_clients/'+id+'/'+patch[field]
  raw=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','30',url],capture_output=True,check=True).stdout;key=url.split('logo.vibers.co.kr/',1)[1];assert hashlib.sha256(raw).hexdigest()==bykey[key]['sha256'];im=Image.open(io.BytesIO(raw));im.load();assert im.format=='PNG';proof.append(dict(id=id,field=field,sha256=bykey[key]['sha256'],dimensions=im.size))
(OUT/'representative-cdn-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
subprocess.run(['python3',str(ROOT/'scripts/apply-verified-quality-patches-20261010.py'),'--release-dir',str(OUT)],check=True)
