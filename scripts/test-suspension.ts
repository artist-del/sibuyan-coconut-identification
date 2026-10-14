import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "../proxy";

async function main() {
  const original = process.env.SITE_SUSPENDED;
  try {
    for (const url of ["/", "/records", "/admin", "/api/identify", "/api/auth/session", "/_next/static/test.js", "/_next/image?url=test", "/coconut.ico"]) {
      assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true);
    }
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined) delete process.env.SITE_SUSPENDED;
      else process.env.SITE_SUSPENDED = value;
      for (const path of ["/", "/admin", "/api/identify"]) {
        assert.equal(proxy(new NextRequest(`https://example.test${path}`)).headers.get("x-middleware-next"), "1");
      }
    }

    process.env.SITE_SUSPENDED = "true";
    for (const path of ["/", "/records", "/identify", "/dashboard", "/admin", "/auth/login", "/auth/register", "/missing", "/_next/image?url=test", "/_next/static/test.js", "/records?_rsc=test"]) {
      for (const method of ["GET", "POST"]) {
        const response = proxy(new NextRequest(`https://example.test${path}`, {
          method,
          headers: { cookie: "next-auth.session-token=existing-session; __Secure-next-auth.session-token=existing-session" }
        }));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("location"), null);
        assert.equal(response.headers.get("x-middleware-next"), null);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
        const html = await response.text();
        assert.match(html, /Website temporarily unavailable/);
        assert.match(html, /settle the remaining balance/);
        assert.match(html, /name="viewport"/);
        assert.doesNotMatch(html, /<script|<link|src=/);
      }
    }

    for (const path of ["/api", "/api/health", "/api/auth/session", "/api/auth/callback/credentials", "/api/identify", "/api/cloudinary/upload", "/api/export", "/api/varieties", "/api/users/me"]) {
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        const response = proxy(new NextRequest(`https://example.test${path}`, { method }));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { message: "Website temporarily unavailable" });
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      }
    }

    process.env.SITE_SUSPENDED = "false";
    assert.equal(proxy(new NextRequest("https://example.test/records")).headers.get("x-middleware-next"), "1");
    console.log("Suspension checks passed: defaults, pages, sessions, APIs, methods, restoration.");
  } finally {
    if (original === undefined) delete process.env.SITE_SUSPENDED;
    else process.env.SITE_SUSPENDED = original;
  }
}

main().catch((error: unknown) => {
  console.error("Suspension checks failed:", error);
  process.exitCode = 1;
});
