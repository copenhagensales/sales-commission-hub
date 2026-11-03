import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sammeHemmelighed, verifyWebhookSecret } from "./webhook-auth.ts";

Deno.test("sammeHemmelighed: ens/forskellig/længde", () => {
  assertEquals(sammeHemmelighed("abc", "abc"), true);
  assertEquals(sammeHemmelighed("abc", "abd"), false);
  assertEquals(sammeHemmelighed("abc", "abcd"), false);
  assertEquals(sammeHemmelighed("", ""), true);
});
Deno.test("verifyWebhookSecret: requireConfigured afviser (503) uden variabel; uden flaget som hidtil (åben)", () => {
  Deno.env.delete("TEST_HOOK_SECRET");
  const req = new Request("https://x.test/f?authKey=a", { method: "POST" });
  assertEquals(verifyWebhookSecret(req, "TEST_HOOK_SECRET", { requireConfigured: true })?.status, 503);
  assertEquals(verifyWebhookSecret(req, "TEST_HOOK_SECRET", {}), null);
});
Deno.test("verifyWebhookSecret: header accepteres, forkert/manglende afvises (401), querystring kun når tilladt", () => {
  Deno.env.set("TEST_HOOK_SECRET", "hemmelig");
  const ok = new Request("https://x.test/f", { method: "POST", headers: { "x-webhook-secret": "hemmelig" } });
  const forkert = new Request("https://x.test/f", { method: "POST", headers: { "x-webhook-secret": "forkert" } });
  const query = new Request("https://x.test/f?authKey=hemmelig", { method: "POST" });
  assertEquals(verifyWebhookSecret(ok, "TEST_HOOK_SECRET", { headerNames: ["x-webhook-secret"], queryNames: [] }), null);
  assertEquals(verifyWebhookSecret(forkert, "TEST_HOOK_SECRET", { headerNames: ["x-webhook-secret"], queryNames: [] })?.status, 401);
  assertEquals(verifyWebhookSecret(query, "TEST_HOOK_SECRET", { headerNames: ["x-webhook-secret"], queryNames: [] })?.status, 401);
  assertEquals(verifyWebhookSecret(query, "TEST_HOOK_SECRET", { queryNames: ["authKey"] }), null);
  Deno.env.delete("TEST_HOOK_SECRET");
});
