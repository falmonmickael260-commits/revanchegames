import test from "node:test";
import assert from "node:assert/strict";
import { readLimitedBody, RequestError } from "../src/lib/request-security";

test("rejects oversized declared and streamed bodies", async () => {
  await assert.rejects(readLimitedBody(new Request("https://example.com", { method: "POST", headers: { "content-length": "100" }, body: "x" }), 10), (e: unknown) => e instanceof RequestError && e.status === 413);
  await assert.rejects(readLimitedBody(new Request("https://example.com", { method: "POST", body: "12345678901" }), 10), (e: unknown) => e instanceof RequestError && e.status === 413);
});
test("rejects malformed lengths", async () => {
  await assert.rejects(readLimitedBody(new Request("https://example.com", { method: "POST", headers: { "content-length": "NaN" }, body: "x" }), 10), (e: unknown) => e instanceof RequestError && e.status === 400);
});
test("accepts a small valid body", async () => {
  assert.equal(new TextDecoder().decode(await readLimitedBody(new Request("https://example.com", { method: "POST", body: "ok" }), 10)), "ok");
});
