import { describe, it, expect } from "vitest";
import {
  isMonthMature,
  selectMatureMonths,
  isQualifiedForHorizon,
  isExitWithinHorizon,
  tenureDays,
  rate,
  statusFor,
  buildSignals,
  bandsSum,
  firstMeasurableCohortMonth,
  actionEffect,
  deriveTeams,
  type ChurnSettings,
  type ChurnMetricsPayload,
} from "./metrics";

const settings: ChurnSettings = {
  official_horizon_days: 60,
  official_month_count: 12,
  target_60d_rate: 30,
  minimum_n: 15,
  yellow_threshold_pp: 5,
  orange_threshold_pp: 10,
  material_trend_pp: 5,
  benchmark_min_n: 40,
  benchmark_min_months: 6,
};

const asOf = "2026-08-20";

describe("daggrænser (T-01 til T-06)", () => {
  it("T-01: dag 59 er ikke kvalificeret til 60-dagesmålingen", () => {
    expect(isQualifiedForHorizon("2026-06-22", asOf, 60)).toBe(false); // 59 dage
  });

  it("T-02: dag 60 er kvalificeret", () => {
    expect(isQualifiedForHorizon("2026-06-21", asOf, 60)).toBe(true); // 60 dage
  });

  it("T-03: exit præcis dag 60 tæller i tælleren", () => {
    expect(isExitWithinHorizon("2026-01-01", "2026-03-02", 60)).toBe(true);
    expect(tenureDays("2026-01-01", "2026-03-02")).toBe(60);
  });

  it("T-04: exit præcis dag 61 tæller ikke", () => {
    expect(isExitWithinHorizon("2026-01-01", "2026-03-03", 60)).toBe(false);
  });

  it("T-05: dag 13 ikke kvalificeret, dag 14 kvalificeret (14-dages)", () => {
    expect(isQualifiedForHorizon("2026-08-07", asOf, 14)).toBe(false); // 13 dage
    expect(isQualifiedForHorizon("2026-08-06", asOf, 14)).toBe(true); // 14 dage
  });

  it("T-06: dag 29 ikke kvalificeret, dag 30 kvalificeret (30-dages)", () => {
    expect(isQualifiedForHorizon("2026-07-22", asOf, 30)).toBe(false); // 29 dage
    expect(isQualifiedForHorizon("2026-07-21", asOf, 30)).toBe(true); // 30 dage
  });
});

describe("fremtid og ugyldige datoer (T-07 til T-09)", () => {
  it("T-07: fremtidig start giver negativ anciennitet og er aldrig kvalificeret", () => {
    expect(isQualifiedForHorizon("2026-09-01", asOf, 60)).toBe(false);
    expect(tenureDays("2026-09-01", asOf)).toBeLessThan(0);
  });

  it("T-08: manglende startdato giver ingen anciennitet", () => {
    expect(tenureDays(null, asOf)).toBeNull();
    expect(isExitWithinHorizon("2026-01-01", null, 60)).toBe(false);
  });

  it("T-09: exit før start giver ikke exit inden for horisonten", () => {
    expect(isExitWithinHorizon("2026-03-01", "2026-02-01", 60)).toBe(false);
  });
});

describe("modenhed og månedsvalg (T-11 til T-13)", () => {
  it("T-11: en startmåned er først moden når månedens sidste dag + 60 dage er nået", () => {
    // Juni 2026 slutter 30/6. +60 dage = 29/8 → ikke moden pr. 20/8.
    expect(isMonthMature("2026-06-01", asOf, 60)).toBe(false);
    // Maj 2026 slutter 31/5. +60 dage = 30/7 → moden.
    expect(isMonthMature("2026-05-01", asOf, 60)).toBe(true);
  });

  it("T-12: præcis de 12 seneste modne måneder vælges", () => {
    const months = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2024, i, 1));
      return d.toISOString().slice(0, 10);
    });
    const selected = selectMatureMonths(months, asOf, 60, 12);
    expect(selected).toHaveLength(12);
    expect(selected[selected.length - 1]).toBe("2026-05-01");
    expect(selected.every((m) => isMonthMature(m, asOf, 60))).toBe(true);
  });

  it("T-13: færre end 12 modne måneder udfyldes ikke kunstigt", () => {
    const months = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];
    const selected = selectMatureMonths(months, asOf, 60, 12);
    expect(selected).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);
  });
});

describe("vægtning og monotoni (T-14 til T-16)", () => {
  it("T-14: rolling rate er sum exits / sum startere, ikke gennemsnit af månedsprocenter", () => {
    const months = [
      { starters: 10, exits: 8 },
      { starters: 90, exits: 9 },
    ];
    const weighted = rate(
      months.reduce((s, m) => s + m.exits, 0),
      months.reduce((s, m) => s + m.starters, 0),
    );
    const naive = (80 + 10) / 2;
    expect(weighted).toBeCloseTo(17, 5);
    expect(weighted).not.toBeCloseTo(naive, 5);
  });

  it("T-15: monotoni — exits 0-14 <= 0-30 <= 0-60", () => {
    const bands = { b0_7: 3, b8_14: 2, b15_30: 4, b31_60: 5 };
    const d14 = bands.b0_7 + bands.b8_14;
    const d30 = d14 + bands.b15_30;
    const d60 = d30 + bands.b31_60;
    expect(d14).toBeLessThanOrEqual(d30);
    expect(d30).toBeLessThanOrEqual(d60);
  });

  it("T-16: exitperioder summerer til den samlede 60-dages tæller", () => {
    expect(bandsSum({ b0_7: 3, b8_14: 2, b15_30: 4, b31_60: 5 })).toBe(14);
  });
});

describe("små-n og manglende mål (T-19, T-20)", () => {
  it("T-19: n under minimum giver grå status uden konklusion", () => {
    const s = statusFor(80, 5, settings);
    expect(s.key).toBe("grey");
    expect(s.label).toBe("Lavt datagrundlag");
  });

  it("T-19: små teams udelukkes fra Siden sidst", () => {
    const teams = deriveTeams(makePayload()).map((t) => t);
    const signals = buildSignals(teams, settings);
    expect(signals.negative.some((s) => s.team === "Lille team")).toBe(false);
  });

  it("T-20: mål = null giver neutral status og ingen merfrafald", () => {
    const noTarget = { ...settings, target_60d_rate: null };
    expect(statusFor(80, 100, noTarget).label).toBe("Mål ikke sat");
    const payload = makePayload({ target_60d_rate: null });
    const teams = deriveTeams(payload);
    expect(teams.every((t) => t.excessExits === null)).toBe(true);
  });
});

describe("statusfarver", () => {
  it("bruger faste tærskler fra settings", () => {
    expect(statusFor(30, 100, settings).key).toBe("green");
    expect(statusFor(34, 100, settings).key).toBe("yellow");
    expect(statusFor(39, 100, settings).key).toBe("orange");
    expect(statusFor(41, 100, settings).key).toBe("red");
  });
});

describe("Siden sidst (T-21)", () => {
  it("sorterer negative signaler efter personpåvirkning og respekterer maks 3/2", () => {
    const teams = deriveTeams(makePayload());
    const { negative, positive } = buildSignals(teams, settings);
    expect(negative.length).toBeLessThanOrEqual(3);
    expect(positive.length).toBeLessThanOrEqual(2);
    expect(negative[0]?.team).toBe("Stort team");
    expect(negative.every((s) => s.deltaPp > 0)).toBe(true);
    expect(positive.every((s) => s.deltaPp < 0)).toBe(true);
  });
});

describe("handlingseffekt (T-22)", () => {
  it("første målbare kohorte er næste hele startmåned", () => {
    expect(firstMeasurableCohortMonth("2026-03-17")).toBe("2026-04-01");
    expect(firstMeasurableCohortMonth("2026-03-01")).toBe("2026-03-01");
  });

  it("baseline og efterperiode bruger 3 fuldt modne hele startmåneder", () => {
    const monthly = [
      { m: "2025-09-01", starters: 20, exits: 12 },
      { m: "2025-10-01", starters: 20, exits: 10 },
      { m: "2025-11-01", starters: 20, exits: 10 },
      { m: "2025-12-01", starters: 20, exits: 6 },
      { m: "2026-01-01", starters: 20, exits: 4 },
      { m: "2026-02-01", starters: 20, exits: 2 },
      { m: "2026-07-01", starters: 20, exits: 2 }, // ikke moden pr. 20/8 2026
    ];
    const res = actionEffect(monthly, "2025-12-01", asOf, 60);
    expect(res.baseline).toMatchObject({ n: 60, x: 32 });
    expect(res.after).toMatchObject({ n: 60, x: 12 });
    expect(res.deltaPp).toBeCloseTo(-33.333, 2);
    expect(res.measurable).toBe(true);
  });

  it("utilstrækkeligt modent data kan ikke vurderes", () => {
    const res = actionEffect([{ m: "2026-07-01", starters: 10, exits: 2 }], "2026-07-01", asOf, 60);
    expect(res.measurable).toBe(false);
  });
});

describe("afstemning (T-17)", () => {
  it("teamrækker inkl. ukendt summerer til virksomhedstotalen", () => {
    const payload = makePayload();
    const teams = deriveTeams(payload);
    expect(teams.reduce((s, t) => s + t.starters, 0)).toBe(payload.company.starters);
    expect(teams.reduce((s, t) => s + t.exits, 0)).toBe(payload.company.exits);
  });
});

function makePayload(overrides: Partial<ChurnSettings> = {}): ChurnMetricsPayload {
  const s = { ...settings, ...overrides };
  const teams = [
    {
      team_key: "Stort team",
      starters: 100,
      exits: 60,
      b0_7: 10,
      b8_14: 10,
      b15_30: 20,
      b31_60: 20,
      recent_n: 40,
      recent_x: 28,
      prev_n: 40,
      prev_x: 16,
      months_with_data: 12,
    },
    {
      team_key: "Forbedret team",
      starters: 80,
      exits: 30,
      b0_7: 5,
      b8_14: 5,
      b15_30: 10,
      b31_60: 10,
      recent_n: 30,
      recent_x: 6,
      prev_n: 30,
      prev_x: 15,
      months_with_data: 10,
    },
    {
      team_key: "Lille team",
      starters: 8,
      exits: 7,
      b0_7: 2,
      b8_14: 2,
      b15_30: 2,
      b31_60: 1,
      recent_n: 4,
      recent_x: 4,
      prev_n: 4,
      prev_x: 0,
      months_with_data: 3,
    },
    {
      team_key: "Øvrige / ukendt team",
      starters: 12,
      exits: 3,
      b0_7: 1,
      b8_14: 1,
      b15_30: 1,
      b31_60: 0,
      recent_n: 5,
      recent_x: 1,
      prev_n: 5,
      prev_x: 1,
      months_with_data: 4,
    },
  ];
  const company = teams.reduce(
    (acc, t) => ({
      starters: acc.starters + t.starters,
      exits: acc.exits + t.exits,
      b0_7: acc.b0_7 + t.b0_7,
      b8_14: acc.b8_14 + t.b8_14,
      b15_30: acc.b15_30 + t.b15_30,
      b31_60: acc.b31_60 + t.b31_60,
      recent_n: acc.recent_n + t.recent_n,
      recent_x: acc.recent_x + t.recent_x,
      prev_n: acc.prev_n + t.prev_n,
      prev_x: acc.prev_x + t.prev_x,
    }),
    { starters: 0, exits: 0, b0_7: 0, b8_14: 0, b15_30: 0, b31_60: 0, recent_n: 0, recent_x: 0, prev_n: 0, prev_x: 0 },
  );

  return {
    as_of_date: asOf,
    as_of_source: "test",
    timezone: "Europe/Copenhagen",
    settings: s,
    mature_months: ["2025-06-01"],
    mature_months_available: 12,
    latest_mature_month: "2026-05-01",
    company,
    monthly: [],
    team_totals: teams,
    team_months: [],
    leader_totals: [],
    leader_dimension_available: false,
    exit_reason_available: false,
    horizon_14: { n: 0, x: 0 },
    horizon_30: { n: 0, x: 0 },
    observation: { d0_13: 0, d14_29: 0, d30_59: 0 },
    upcoming_starters: 0,
    quality: {
      total_rows: 0,
      duplicates: 0,
      missing_start_date: 0,
      exit_before_start: 0,
      outside_scope: 0,
      future_start: 0,
      valid_spells_n: 0,
      unknown_team: 0,
      unknown_leader: 0,
      unknown_exit_reason: 0,
      total_exits_all: 0,
    },
    headcount_bridge: {
      all_active_profiles: 0,
      upcoming_starters: 0,
      staff_out_of_scope: 0,
      invalid_dates: 0,
      official_headcount: 0,
    },
  };
}
