// Prøver for _shared/adversus-budget.ts (F1a-2): organisationsnøgle og fail-open kun for salg. Kør: deno test supabase/functions/_shared/adversus-budget_test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { budgetNoegle, erBudgetFejl, lavAdversusBudget, ORG_NOEGLE } from "./adversus-budget.ts";

Deno.test("to API-brugere deler én organisationsnøgle", async () => {
  assertEquals(await budgetNoegle("lovablecph-api"), ORG_NOEGLE);
  assertEquals(await budgetNoegle("Eesy TM"), ORG_NOEGLE);
  assertEquals(await budgetNoegle(""), ORG_NOEGLE);
});

Deno.test("begrænser utilgængelig: salg fail-open, kald fejler lukket", async () => {
  const svc = { rpc: () => Promise.resolve({ data: null, error: { code: "42883", message: "function missing" } }) };
  const salg = lavAdversusBudget(svc, ORG_NOEGLE, "salg");
  assertEquals(await salg.reserver(), null);
  const kald = lavAdversusBudget(svc, ORG_NOEGLE, "kald");
  const fejl = await assertRejects(() => kald.reserver(), Error, "ADVERSUS_BUDGET_UTILGAENGELIG");
  assertEquals(erBudgetFejl(fejl), true);
});

Deno.test("reservation ok giver lease og frigiver via rpc", async () => {
  const kaldt: string[] = [];
  const svc = { rpc: (fn: string) => { kaldt.push(fn); return Promise.resolve(fn === "adversus_api_budget_reserver" ? { data: { ok: true, lease: "abc" }, error: null } : { data: null, error: null }); } };
  const b = lavAdversusBudget(svc, ORG_NOEGLE, "optagelse");
  const lease = await b.reserver();
  assertEquals(lease, "abc");
  await b.frigiv(lease);
  assertEquals(kaldt, ["adversus_api_budget_reserver", "adversus_api_budget_frigiv"]);
});
