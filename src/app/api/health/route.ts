import { NextResponse } from "next/server";

/** 경량 readiness probe. 외부 CDN·카탈로그를 호출하지 않습니다. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
