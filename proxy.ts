import { NextResponse, type NextRequest } from "next/server";

const message = "Please contact your developer to settle the remaining balance and restore access.";

// Self-contained notice: no app rendering, database, scripts, or external assets.
const suspensionHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Website temporarily unavailable</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; min-height: 100svh; display: grid; place-items: center; padding: 24px; background: #f0f7f3; color: #183c2c; font-family: system-ui, sans-serif; }
    main { width: 100%; max-width: 560px; padding: clamp(24px, 6vw, 48px); background: white; border: 1px solid #d5e5db; border-radius: 20px; box-shadow: 0 12px 40px #183c2c0d; text-align: center; }
    .label { margin: 0 0 20px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #47705a; }
    h1 { margin: 0 0 16px; font-size: clamp(26px, 6vw, 36px); line-height: 1.2; overflow-wrap: break-word; }
    .message { margin: 0; color: #486052; font-size: 16px; line-height: 1.7; }
  </style>
</head>
<body><main aria-labelledby="notice-title">
  <p class="label">Access temporarily suspended</p>
  <h1 id="notice-title">Website temporarily unavailable</h1>
  <p class="message">${message}</p>
</main></body>
</html>`;

export function proxy(request: NextRequest) {
  if (process.env.SITE_SUSPENDED !== "true") return NextResponse.next();

  const headers = {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff"
  };

  if (request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { message: "Website temporarily unavailable" },
      { status: 503, headers }
    );
  }

  return new NextResponse(suspensionHtml, {
    status: 503,
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    }
  });
}

// Include APIs, server actions, internal requests and public files. The notice
// needs no assets, so there are no excluded paths that could bypass suspension.
export const config = { matcher: "/:path*" };
