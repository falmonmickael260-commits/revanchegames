import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../src/lib/security-headers";

const asMap = (production: boolean) => Object.fromEntries(securityHeaders(production).map(({ key, value }) => [key, value]));

test("production HTTPS policy avoids unverified subdomains", () => {
  assert.equal(asMap(true)["Strict-Transport-Security"], "max-age=31536000");
  assert.equal(asMap(false)["Strict-Transport-Security"], undefined);
});

test("baseline CSP blocks plugins and third-party framing without blocking hosted games", () => {
  const headers = asMap(true);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'self'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.match(headers["Content-Security-Policy"], /base-uri 'self'/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /(?:default|frame|script|connect)-src/);
  assert.match(headers["Content-Security-Policy-Report-Only"], /script-src 'self'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
});

test("browser permissions preserve gaming and voice features", () => {
  assert.doesNotMatch(asMap(true)["Permissions-Policy"], /microphone|fullscreen|gamepad|clipboard|web-share|payment/);
});
