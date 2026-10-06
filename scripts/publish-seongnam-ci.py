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
 root=ROOT/'marketing/assets/seongnam-official-20261006/publish'
 verified=[]
 for p in sorted(root.iterdir()):
  rel=p.name if p.suffix=='.zip' else 'sources/official-ci-20261006/'+p.name
  key='_clients/seongnam/'+rel;raw=p.read_bytes()
  try:
   old=s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()
   if old != raw: raise RuntimeError('Refusing to overwrite different asset: '+key)
  except s3.exceptions.NoSuchKey: pass
  s3.put_object(Bucket='vibers-bucket',Key=key,Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(p.name)[0] or 'application/octet-stream',CacheControl='public, max-age=31536000, immutable')
  assert s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()==raw
  verified.append({'key':key,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
 (root.parent/'uploaded-verified.json').write_text(json.dumps(verified,indent=2))
 print('PASS',len(verified),'assets uploaded and byte verified')
if __name__=='__main__':main()
