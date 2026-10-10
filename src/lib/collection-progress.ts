import { Pool } from 'pg';
export type CollectionProgress = { id: string; name: string; as_of: string; source_url: string; source_kind: string; count_unit: string; total: number; collected: number; verified: number; candidates: number; checked_at: string | null; sector?: string; country?: string; sport?: string; league?: string; season?: string; roster_status?: string; scope_note?: string };
let pool: Pool | undefined;
export async function collectionProgress(): Promise<CollectionProgress[]> {
  if (!process.env.DB_VIBERS_MAIN_URL) return [];
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
  const result = await pool.query(`SELECT c.id,c.name,s.as_of::text,s.source_url,s.count_unit,s.expected_count AS total,
    coalesce(c.scope->>'source_kind','unknown') AS source_kind,
    c.scope->>'checked_at' AS checked_at,
    c.scope->>'sector' AS sector, c.scope->>'country' AS country, c.scope->>'sport' AS sport,
    c.scope->>'league' AS league, c.scope->>'season' AS season,
    c.scope->>'roster_status' AS roster_status, c.scope->>'scope_note' AS scope_note,
    count(m.member_key) FILTER(WHERE m.brand_id IS NOT NULL AND p.status='published')::int AS collected,
    count(m.member_key) FILTER(WHERE m.review_status='verified' AND m.metadata->>'png_verified'='true' AND p.status='published')::int AS verified,
    count(m.member_key) FILTER(WHERE m.brand_id IS NOT NULL OR jsonb_array_length(coalesce(m.metadata->'candidates','[]'::jsonb))>0)::int AS candidates
    FROM semologo.collections c JOIN semologo.collection_snapshots s ON s.collection_id=c.id
    LEFT JOIN semologo.collection_members m ON m.snapshot_id=s.id
    LEFT JOIN semologo.logo_posts p ON p.id=m.brand_id
    WHERE s.id=(SELECT newest.id FROM semologo.collection_snapshots newest WHERE newest.collection_id=c.id ORDER BY as_of DESC,id DESC LIMIT 1)
    GROUP BY c.id,c.name,c.scope,s.id ORDER BY c.id`);
  return result.rows;
}

export type CollectionMember = { member_key: string; name: string; brand_id: string | null; review_status: string; png_verified: boolean; candidates: string[] };
export async function collectionMembers(id: string): Promise<CollectionMember[]> {
  if (!process.env.DB_VIBERS_MAIN_URL) return [];
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000 });
  const result = await pool.query(`SELECT m.member_key,m.name,m.brand_id,m.review_status,
    coalesce(m.metadata->>'png_verified','false')='true' AS png_verified,
    coalesce(m.metadata->'candidates','[]'::jsonb) AS candidates
    FROM semologo.collection_members m
    WHERE m.snapshot_id=(SELECT id FROM semologo.collection_snapshots WHERE collection_id=$1 ORDER BY as_of DESC,id DESC LIMIT 1)
    ORDER BY m.name`, [id]);
  return result.rows;
}
