"""Add an ID-tracked publication lane for domestic priority discovery results."""
import hashlib
import py_compile
from pathlib import Path

ROOT = Path('/root/projects/semologo-publisher/scripts')
MARKER = 'kr-public-institutions-20261025'
core = ROOT / 'fleet-auto-core.py'
pipeline = ROOT / 'run-auto-fleet-pipeline.py'
original_core, original_pipeline = core.read_text(), pipeline.read_text()
if 'def public_priority_jobs(' in original_pipeline:
    raise SystemExit('Priority publication lane already installed')

needle = "and status='succeeded' and (created_at,id)>"
assert original_core.count(needle) == 1
new_core = original_core.replace(needle,
    "and status='succeeded' and coalesce(input->>'priority','') <> '" + MARKER + "' and (created_at,id)>")

helper = '''
def public_priority_jobs(processed, limit):
    source = 'const done='+json.dumps(processed)+';const n='+str(limit)+';' + r''' + "'''" + '''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});try{const q=await p.query("select id,result,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\\\"T\\\"HH24:MI:SS.US\\\"Z\\\"') created_at from fleet.job where tenant='internal' and project='semologo' and kind='semologo-domain-discover' and status='succeeded' and input->>'priority'='kr-public-institutions-20261025' and not(id=ANY($1::uuid[])) order by created_at,id limit $2",[done,n]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})''' + "'''" + '''
    return CORE['node']('vibers-fleet', source)

'''

needle = 'def cycle(limit, apply):\n'
assert original_pipeline.count(needle) == 1
updated = original_pipeline.replace(needle, helper + needle)
needle = "    jobs = CORE['jobs_after'](cursor, limit)\n"
assert updated.count(needle) == 1
updated = updated.replace(needle, """    priority_file = STATE / 'public-institution-priority-processed.json'
    priority_done = json.loads(priority_file.read_text()) if priority_file.exists() else []
    jobs = public_priority_jobs(priority_done, limit)
    priority_lane = bool(jobs)
    if not jobs:
        jobs = CORE['jobs_after'](cursor, limit)
""")
needle = "                   if jobs else cursor)"
assert updated.count(needle) == 1
updated = updated.replace(needle, "                   if jobs and not priority_lane else cursor)")
needle = "        temporary = cursor_file.with_suffix('.tmp')\n        temporary.write_text(json.dumps(next_cursor) + '\\n')\n        temporary.replace(cursor_file)"
assert updated.count(needle) == 1
updated = updated.replace(needle, """        destination = priority_file if priority_lane else cursor_file
        value = sorted(set(priority_done + [job['id'] for job in jobs])) if priority_lane else next_cursor
        temporary = destination.with_suffix('.tmp')
        temporary.write_text(json.dumps(value) + '\\n')
        temporary.replace(destination)""")
updated = updated.replace("'mode': receipt['mode'], 'jobs': len(jobs)",
    "'mode': receipt['mode'], 'priorityLane': priority_lane, 'jobs': len(jobs)")

for path, before, after in [(core, original_core, new_core), (pipeline, original_pipeline, updated)]:
    backup = path.with_name(path.name + '.before-public-priority-20261025')
    if backup.exists():
        raise SystemExit('Backup already exists; inspect current install before retrying')
    backup.write_text(before)
    temporary = path.with_suffix('.priority-install.py')
    temporary.write_text(after)
    py_compile.compile(str(temporary), doraise=True)
    temporary.replace(path)
    print(path.name, hashlib.sha256(after.encode()).hexdigest())
