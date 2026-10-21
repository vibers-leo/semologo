import { NextRequest, NextResponse } from "next/server";

async function firebaseAuthHelper(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new NextResponse(null, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  }
  // Only the fixed project's public auth helpers are proxied. Never forward
  // application cookies or Authorization headers to a third party.
  const upstream = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://ai-recipe-lab.firebaseapp.com");
  try {
    const result = await fetch(upstream, {
      method: request.method, cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const headers = new Headers(result.headers);
    // fetch decodes upstream compression; do not advertise the old encoding/size.
    for (const key of ["content-encoding", "content-length", "connection", "transfer-encoding"]) headers.delete(key);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    return new NextResponse(request.method === "HEAD" ? null : result.body, { status: result.status, headers });
  } catch {
    return new NextResponse("Sign-in is temporarily unavailable. Please try again.", {
      status: 503, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/__/auth/")) return firebaseAuthHelper(request);
  const target = new URL(request.url);
  if (/\.[^/]+\/$/.test(pathname) && !pathname.startsWith("/.well-known/")) {
    target.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(target, 308);
  }
  // Keep the existing trailing slash convention. Use native URL serialization,
  // with skipProxyUrlNormalize, so NextURL cannot undo the added slash.
  if (!pathname.endsWith("/") && !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/.well-known/") && !/\.[^/]+$/.test(pathname)) {
    target.pathname = pathname + "/";
    return NextResponse.redirect(target, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
