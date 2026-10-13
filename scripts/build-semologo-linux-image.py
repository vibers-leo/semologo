"""Build committed HEAD in an existing local Linux Docker context, export to HDD.

Usage: python3 scripts/build-semologo-linux-image.py --context CONTEXT
Does not start a VM, change Docker's default context, or deploy to production.
"""
from pathlib import Path
import argparse, subprocess, tempfile, json, os, hashlib

R=Path(__file__).resolve().parents[1]
H=Path('/Volumes/HDD-1TB/semologo-migration')
parser=argparse.ArgumentParser();parser.add_argument('--context',required=True);args=parser.parse_args()
def output(cmd,**kw):return subprocess.check_output(cmd,text=True,**kw).strip()
assert H.is_dir() and '/Volumes/HDD-1TB' in output(['/sbin/mount']),'Connect 1F HDD first'
docker=['docker','--context',args.context]
assert output(docker+['info','--format','{{.OSType}}'])=='linux','Start the selected local Linux Docker VM first'
sha=output(['git','rev-parse','HEAD'],cwd=R);tag='semologo:local-'+sha[:12]
remote=r'''import pathlib,shlex,json
allowed=['NEXT_PUBLIC_CDN_URL','NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID','NEXT_PUBLIC_COUPANG_WIDGET_ID','NEXT_PUBLIC_COUPANG_TRACKING_CODE']
values={}
for line in pathlib.Path('/root/projects/semologo/.env').read_text().splitlines():
 line=line.removeprefix('export ')
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in allowed:
  parts=shlex.split(v,comments=True);values[k]=parts[0] if parts else ''
for line in pathlib.Path('/root/projects/semologo/.webhook.conf').read_text().splitlines():
 if line.startswith('BUILD_ARGS='):
  parts=shlex.split(line.split('=',1)[1],comments=True)
  tokens=shlex.split(parts[0]) if parts else []
  for i,t in enumerate(tokens):
   if t=='--build-arg' and i+1<len(tokens):
    k,sep,v=tokens[i+1].partition('=')
    if k in allowed and sep:values[k]=v
assert all(values.get(k) for k in allowed[:8]),'Required public build settings missing'
assert not any('$' in v for v in values.values()),'Unresolved build setting; inspect configuration'
print(json.dumps(values))
'''
settings=json.loads(subprocess.run(['ssh','vibers','python3','-'],input=remote,text=True,capture_output=True,check=True).stdout)
artifacts=H/'task-tmp/prebuilt-images';artifacts.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='semologo-context-',dir=H/'task-tmp') as temp:
    context=Path(temp);archive=context/'source.tar'
    subprocess.run(['git','archive','--format=tar','--output='+str(archive),sha],cwd=R,check=True)
    # Docker accepts a tar build context on stdin. Avoid extracting thousands of
    # tiny files onto the HDD, which can take much longer than the image build.
    # Pass public build settings through the client environment, never a secret file.
    command=docker+['buildx','build','--platform','linux/amd64','--load','--tag',tag,'--label','org.opencontainers.image.revision='+sha]
    for k in settings:command+=['--build-arg',k]
    with archive.open('rb') as source:
        subprocess.run(command+['-'],stdin=source,env={**os.environ,**settings},check=True)
    archive.unlink()
    assert output(docker+['image','inspect',tag,'--format','{{.Os}}/{{.Architecture}}'])=='linux/amd64'
    target=artifacts/('semologo-'+sha[:12]+'.tar')
    subprocess.run(docker+['image','save','--output',str(target),tag],check=True)
    digest=hashlib.file_digest(target.open('rb'),'sha256').hexdigest()
    receipt={'revision':sha,'tag':tag,'platform':'linux/amd64','sha256':digest,'artifact':str(target),'deployed':False}
    target.with_suffix('.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))
