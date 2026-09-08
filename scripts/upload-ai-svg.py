"""Upload only reviewed files and byte-verify every object before catalog publication."""
import json,shlex,hashlib,mimetypes,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import boto3
from botocore.config import Config
ROOT=Path(__file__).resolve().parents[1];W=ROOT/'artifacts/ai-svg-collection';C=Path('/Volumes/Untitled/brand-logos/_clients')
def main():
 env={}
 for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
  if line.startswith('export '):line=line[7:]
  if '=' not in line:continue
  k,v=line.split('=',1)
  if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:
   parts=shlex.split(v,comments=True);env[k]=parts[0] if parts else ''
 s3=boto3.client('s3',region_name='kr-standard',endpoint_url='https://kr.object.ncloudstorage.com',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',max_pool_connections=16,retries={'max_attempts':5}))
 bucket='vibers-bucket';assert bucket in [b['Name'] for b in s3.list_buckets()['Buckets']]
 if '--version' in sys.argv:
  raw=(C.parent/'version.txt').read_bytes();s3.put_object(Bucket=bucket,Key='version.txt',Body=raw,ACL='public-read',ContentType='text/plain',CacheControl='no-cache');assert s3.get_object(Bucket=bucket,Key='version.txt')['Body'].read()==raw;print('version uploaded and verified');return
 files=json.loads((W/'upload-files.json').read_text());verified=[];backup=W/'bucket-before';backup.mkdir(exist_ok=True)
 def put(rel):
  p=C/rel;key='_clients/'+rel;raw=p.read_bytes()
  # Back up overwritten metadata; source assets use dedicated provider paths.
  if p.suffix=='.json':
   try:
    old=s3.get_object(Bucket=bucket,Key=key)['Body'].read();target=backup/rel;target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():target.write_bytes(old)
   except s3.exceptions.NoSuchKey:pass
  s3.put_object(Bucket=bucket,Key=key,Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(p.name)[0] or 'application/octet-stream',CacheControl='public, max-age=31536000, immutable')
  assert s3.get_object(Bucket=bucket,Key=key)['Body'].read()==raw,key
  return {'file':rel,'sha256':hashlib.sha256(raw).hexdigest()}
 for phase in [ [f for f in files if not f.endswith('.json')], [f for f in files if f.endswith('.json') and '/' in f], [f for f in files if '/' not in f] ]:
  with ThreadPoolExecutor(max_workers=12) as ex:
   for item in ex.map(put,phase):
    verified.append(item)
    if len(verified)%200==0:print('verified',len(verified),'/',len(files),flush=True)
  (W/'uploaded-verified.json').write_text(json.dumps(verified,indent=2))
 assert len(verified)==len(files);print('PASS all',len(verified),'objects byte-verified')
if __name__=='__main__':main()
