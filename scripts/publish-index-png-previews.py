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
 root=ROOT/'marketing/assets/index-png-serving-20261007'
 items=[x for x in json.loads((root/'manifest.json').read_text())['items'] if x['status']=='png-ready']
 def upload(item):
  raw=(ROOT/item['file']).read_bytes();key='_clients/'+item['id']+'/sources/png-preview-20261007/logo.png'
  try:
   old=s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()
   if old!=raw:raise RuntimeError('Conflicting immutable object '+key)
  except s3.exceptions.NoSuchKey:pass
  s3.put_object(Bucket='vibers-bucket',Key=key,Body=raw,ACL='public-read',ContentType='image/png',CacheControl='public,max-age=31536000,immutable')
  assert s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()==raw
  return item['id'],'https://logo.vibers.co.kr/'+key
 with ThreadPoolExecutor(max_workers=4) as ex: urls=dict(ex.map(upload,items))
 (ROOT/'src/lib/index-png-assets.json').write_text(json.dumps(urls,indent=2)+'\n')
 (root/'uploaded-verified.json').write_text(json.dumps(urls,indent=2)+'\n')
 print('PASS uploaded and byte verified',len(urls),'PNG files')
if __name__=='__main__':main()
