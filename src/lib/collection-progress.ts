import { Pool } from 'pg';
export type CollectionProgress = { id: string; name: string; as_of: string; source_url: string; source_kind: string; count_unit: string; total: number; verified: number; candidates: number; checked_at: string | null };
let pool: Pool | undefined;
export async function collectionProgress(): Promise<CollectionProgress[]> {
  if (!process.env.DB_VIBERS_MAIN_URL) return [];
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
  const result = await pool.query(`SELECT c.id,c.name,s.as_of::text,s.source_url,s.count_unit,s.expected_count AS total,
    coalesce(c.scope->>'source_kind','unknown') AS source_kind,
    c.scope->>'checked_at' AS checked_at,
    count(m.member_key) FILTER(WHERE m.review_status='verified' AND m.metadata->>'png_verified'='true')::int AS verified,
    count(m.member_key) FILTER(WHERE jsonb_array_length(coalesce(m.metadata->'candidates','[]'::jsonb))>0)::int AS candidates
    FROM semologo.collections c JOIN semologo.collection_snapshots s ON s.collection_id=c.id
    LEFT JOIN semologo.collection_members m ON m.snapshot_id=s.id
    WHERE s.id=(SELECT newest.id FROM semologo.collection_snapshots newest WHERE newest.collection_id=c.id ORDER BY as_of DESC,id DESC LIMIT 1)
    GROUP BY c.id,c.name,c.scope,s.id ORDER BY c.id`);
  return result.rows;
}
