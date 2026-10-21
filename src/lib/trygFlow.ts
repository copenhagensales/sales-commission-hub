/**
 * Leveringsstatus Tryg (intern): flow-balance mellem modtagne og lukkede emner.
 * Ren beregning — data hentes i useTrygFlowStatus. Modtaget = emner oprettet på
 * dagen; Lukket = Tryg-rapportens lukkende statusser på dagen. Ingen totaler på tværs.
 */

export type FlowDailyRow = {
  day: string; // YYYY-MM-DD (dansk dag)
  account: string;
  adversus_campaign_id: string;
  kind: string; // "received" | "closed"
  agent_reference: string;
  status: string;
  lead_count: number;
};

export type FlowStatus = "green" | "yellow" | "red";

export type FlowLine = {
  line: string;
  receivedThisWeek: number | null;
  receivedLastWeek: number | null;
  closedToYesterday: number;
  missing: number | null;
  pacePerWorkday: number;
  requiredPerWorkday: number | null;
  status: FlowStatus | null;
  shortfallPerDay: number | null;
  extraSellers: number | null;
  pool: number | null;
};

export function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOfIso(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDaysIso(day, -((dow + 6) % 7));
}

export function isWorkday(day: string, holidays: Set<string>): boolean {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dow >= 1 && dow <= 5 && !holidays.has(day);
}

/** Status: grøn hvis krævet ≤ tempo, gul hvis ≤ 120 % af tempo, ellers rød. */
export function flowStatus(required: number, pace: number): FlowStatus {
  if (required <= pace) return "green";
  if (required <= pace * 1.2) return "yellow";
  return "red";
}

export function computeFlowLines(input: {
  rows: FlowDailyRow[];
  lines: string[];
  lineOf: (account: string, campaignId: string) => string | null;
  closing: Set<string>;
  holidays: Set<string>;
  today: string;
}): FlowLine[] {
  const { rows, lines, lineOf, closing, holidays, today } = input;
  const weekStart = mondayOfIso(today);
  const lastWeekStart = addDaysIso(weekStart, -7);
  const yesterday = addDaysIso(today, -1);

  const last10: string[] = [];
  for (let d = yesterday; last10.length < 10; d = addDaysIso(d, -1)) {
    if (isWorkday(d, holidays)) last10.push(d);
  }
  const last10Set = new Set(last10);
  let remaining = 0;
  for (let d = today; d <= addDaysIso(weekStart, 4); d = addDaysIso(d, 1)) {
    if (isWorkday(d, holidays)) remaining += 1;
  }

  return lines.map((line) => {
    const mine = rows.filter((r) => lineOf(r.account, r.adversus_campaign_id) === line);
    const received = mine.filter((r) => r.kind === "received");
    const closed = mine.filter((r) => r.kind === "closed" && closing.has(r.status));
    const sum = (list: FlowDailyRow[], from: string, to: string) =>
      list.filter((r) => r.day >= from && r.day <= to).reduce((s, r) => s + r.lead_count, 0);

    const closedToYesterday = sum(closed, weekStart, yesterday);
    const recent = closed.filter((r) => last10Set.has(r.day));
    const pace = recent.reduce((s, r) => s + r.lead_count, 0) / 10;
    const sellerRows = recent.filter((r) => r.agent_reference !== "");
    const sellerDays = new Set(sellerRows.map((r) => `${r.agent_reference}|${r.day}`)).size;
    const perSellerDay = sellerDays > 0 ? sellerRows.reduce((s, r) => s + r.lead_count, 0) / sellerDays : 0;

    if (received.length === 0) {
      return {
        line,
        receivedThisWeek: null,
        receivedLastWeek: null,
        closedToYesterday,
        missing: null,
        pacePerWorkday: pace,
        requiredPerWorkday: null,
        status: null,
        shortfallPerDay: null,
        extraSellers: null,
        pool: null,
      };
    }

    const receivedThisWeek = sum(received, weekStart, today);
    const missing = Math.max(0, receivedThisWeek - closedToYesterday);
    const required = remaining > 0 ? missing / remaining : missing > 0 ? Number.POSITIVE_INFINITY : 0;
    const status = flowStatus(required, pace);
    const shortfall = status === "red" && Number.isFinite(required) ? required - pace : null;
    const firstDay = received.map((r) => r.day).sort()[0];
    const pool = sum(received, firstDay, today) - sum(closed, firstDay, yesterday);

    return {
      line,
      receivedThisWeek,
      receivedLastWeek: sum(received, lastWeekStart, addDaysIso(lastWeekStart, 6)),
      closedToYesterday,
      missing,
      pacePerWorkday: pace,
      requiredPerWorkday: Number.isFinite(required) ? required : null,
      status,
      shortfallPerDay: shortfall,
      extraSellers: shortfall !== null && perSellerDay > 0 ? shortfall / perSellerDay : null,
      pool,
    };
  });
}
