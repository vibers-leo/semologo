import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY!;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY!;

function signedDate(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .slice(2); // YYMMDDTHHMMSSZ
}

function makeAuthHeader(method: string, path: string, query: string, datetime: string): string {
  const message = `${datetime}\n${method}\n${path}\n${query}`;
  const signature = createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("q") || "";

  if (!keyword) return NextResponse.json({ error: "q required" }, { status: 400 });
  if (!ACCESS_KEY || !SECRET_KEY) {
    return NextResponse.json({ url: `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}` });
  }

  // Generate affiliate deeplink for brand search
  const method = "POST";
  const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
  const query = "";
  const datetime = signedDate();
  const auth = makeAuthHeader(method, path, query, datetime);

  const coupangSearchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;

  try {
    const res = await fetch(`https://api-gateway.coupang.com${path}`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coupangUrls: [coupangSearchUrl] }),
    });

    if (!res.ok) {
      return NextResponse.json({ url: coupangSearchUrl });
    }

    const data = await res.json();
    const affiliateUrl = data?.data?.[0]?.shortenUrl || data?.data?.[0]?.originalUrl || coupangSearchUrl;
    return NextResponse.json({ url: affiliateUrl });
  } catch {
    return NextResponse.json({ url: coupangSearchUrl });
  }
}
