import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

let pool: Pool | null = null;
function getPool() {
  if (!process.env.DB_VIBERS_MAIN_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 3, idleTimeoutMillis: 10_000 });
  return pool;
}

export async function GET(request: Request) {
  const db = getPool();
  if (!db) return NextResponse.json({ posts: [], source: "disabled" });
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 1000);
  try {
    const result = await db.query(
      `SELECT payload FROM semologo.logo_posts
       WHERE status = 'published'
       ORDER BY updated_at DESC
       LIMIT $1`, [limit],
    );
    return NextResponse.json({ posts: result.rows.map(row => row.payload), source: "postgres" }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("logo posts postgres read failed", error);
    return NextResponse.json({ posts: [], source: "error" }, { status: 503 });
  }
}
