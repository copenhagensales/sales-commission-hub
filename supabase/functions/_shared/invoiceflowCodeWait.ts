// Ren logik for "vent til login er gennemført" (engangskode tastet i Live View). Testes af Vitest.

export const CODE_WAIT_TIMEOUT_MS = 15 * 60_000;
export const CODE_POLL_MS = 3_000;
export const INVOICE_REACH_MS = 20_000;

/** code = kode-side vises stadig, logged_in = portalen er forbi login. */
export type LoginProbe = "code" | "logged_in";
export type WaitDecision = "continue" | "wait" | "timeout";

export function decideCodeWait(probe: LoginProbe, startedAtMs: number, nowMs: number, timeoutMs = CODE_WAIT_TIMEOUT_MS): WaitDecision {
  if (probe === "logged_in") return "continue";
  if (nowMs - startedAtMs >= timeoutMs) return "timeout";
  return "wait";
}

/**
 * Poller hvert intervalMs, indtil login er gennemført, timeout er nået, eller denne kørsels
 * tidsbudget er brugt (så en opfølgningskørsel kan tage over).
 */
export async function waitForLogin(
  probe: () => Promise<LoginProbe>,
  o: { startedAtMs: number; budgetMs: number; timeoutMs?: number; intervalMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> },
): Promise<"continue" | "timeout" | "still_waiting"> {
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const interval = o.intervalMs ?? CODE_POLL_MS;
  const budgetEnd = now() + o.budgetMs;
  for (;;) {
    const d = decideCodeWait(await probe(), o.startedAtMs, now(), o.timeoutMs);
    if (d !== "wait") return d;
    if (now() + interval > budgetEnd) return "still_waiting";
    await sleep(interval);
  }
}
