import { createHash } from 'node:crypto';
import { redis } from './redis';
/** Pilot traffic bound only, not a paid entitlement or usage ledger. Fail closed. */
export async function wallPilotAllowed(owner: string) {
  const r = redis();
  if (!r) throw new Error('limiter_unavailable');
  const key = `semologo:wall-mcp:${createHash('sha256').update(owner).digest('hex')}:${Math.floor(Date.now()/60000)}`;
  const count = await r.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n", 1, key);
  return Number(count) <= 30;
}
