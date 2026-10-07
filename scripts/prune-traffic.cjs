// Run inside semologo with its existing DB environment. Never print credentials.
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL });
  try {
    // Delete old events even if a session has more recent activity.
    await p.query("DELETE FROM semologo.traffic_events WHERE created_at < now()-interval '90 days'");
    await p.query("DELETE FROM semologo.traffic_sessions WHERE last_seen < now()-interval '90 days'");
    console.log('Traffic 90-day retention applied');
  } finally { await p.end(); }
})().catch(() => { console.error('Traffic retention failed'); process.exitCode=1; });
