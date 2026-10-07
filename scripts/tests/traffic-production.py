"""First-party event E2E; creates only its own isolated session and removes it."""
import json, uuid, subprocess, urllib.request, urllib.error
base='https://semologo.com';sid=str(uuid.uuid4())
def request(path,body=None,origin=None):
 command=['curl','--silent','--show-error','--max-time','20','-A','Mozilla/5.0','-o','/dev/null','-w','%{http_code}',base+path]
 if origin:command+=['-H','Origin: '+origin]
 if body is not None:command+=['-H','Content-Type: application/json','--data-binary',json.dumps(body)]
 return int(subprocess.check_output(command,text=True))
assert request('/api/admin/traffic/?days=7')==403,'Unauthenticated access must fail'
assert request('/api/traffic/',{'x':1},'https://example.invalid')==403,'Wrong origin must fail'
assert request('/api/traffic/',{'x':1},base)==400,'Invalid event must fail'
try:
 for event,params in [('page_view',{}),('search_submitted',{'search_term':'traffic-e2e-validation','result_count':1}),('logo_downloaded',{'brand_id':'traffic-e2e-validation','file_name':'logo.png','download_method':'download'})]:
  body={'session_id':sid,'event':event,'path':'/test?token=discard','attribution':{'utm_source':'e2e','utm_campaign':'validation','landing_path':'/test?secret=discard','referrer':'https://example.invalid/a?secret=discard'},'params':params}
  assert request('/api/traffic/',body,base)==204,f'{event} not stored'
 js=f'''const {{Pool}}=require('pg');(async()=>{{const p=new Pool({{connectionString:process.env.DB_VIBERS_MAIN_URL}});try{{const s=await p.query('SELECT attribution FROM semologo.traffic_sessions WHERE session_id=$1',['{sid}']);const e=await p.query('SELECT event,path,params FROM semologo.traffic_events WHERE session_id=$1',['{sid}']);if(e.rowCount!==3||s.rows[0].attribution.referrer!=='example.invalid'||s.rows[0].attribution.landing_path!=='/test'||e.rows.some(x=>x.path!=='/test'))throw Error('Event storage mismatch');console.log('PASS anonymous session, UTM, search and download stored; private query removed')}}finally{{await p.end()}}}})().catch(e=>{{console.error(e.message);process.exitCode=1}});'''
 subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,check=True)
 print('PASS production origin/validation/admin access guards')
finally:
 js=f'''const {{Pool}}=require('pg');(async()=>{{const p=new Pool({{connectionString:process.env.DB_VIBERS_MAIN_URL}});await p.query('DELETE FROM semologo.traffic_sessions WHERE session_id=$1',['{sid}']);await p.end();console.log('E2E session removed')}})().catch(()=>{{process.exitCode=1}});'''
 subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,check=True)
