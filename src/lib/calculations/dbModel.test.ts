import { describe, it, expect } from "vitest";
import {
  allocateByWeights,
  computeAtpCost,
  computeLeaderSalary,
  computeSellerSalaryCost,
  computeTeamDb,
  prorateMonthlyAmount,
  prorationFactor,
  resolveCompensation,
  shares,
  vacationRateFor,
  withVacationPay,
} from "./dbModel";
import { DEFAULT_CALCULATION_SETTINGS } from "./calculationSettings";

const rates = DEFAULT_CALCULATION_SETTINGS.vacationPayRates;

describe("resolveCompensation", () => {
  it("bruger den eksplicitte model — ikke beløbets størrelse", () => {
    const low = resolveCompensation({
      compensation_model: "monthly_fixed",
      monthly_salary: 900,
    });
    expect(low.model).toBe("monthly_fixed");
    expect(low.monthlySalary).toBe(900);
    expect(low.hourlyRate).toBe(0);
    expect(low.hasBasis).toBe(true);

    const high = resolveCompensation({
      compensation_model: "hourly",
      hourly_rate: 1500,
    });
    expect(high.model).toBe("hourly");
    expect(high.hourlyRate).toBe(1500);
    expect(high.hasBasis).toBe(true);
  });

  it("markerer manglende grundlag når lønrækken ikke findes", () => {
    const result = resolveCompensation(null);
    expect(result.hasBasis).toBe(false);
    expect(result.missingReason).toBe("no_salary_row");
    expect(result.monthlySalary).toBe(0);
  });

  it("markerer manglende grundlag når modellen mangler beløb", () => {
    const hourly = resolveCompensation({
      compensation_model: "hourly",
      hourly_rate: 0,
      monthly_salary: 25000,
    });
    expect(hourly.hasBasis).toBe(false);
    expect(hourly.missingReason).toBe("missing_hourly_rate");

    const monthly = resolveCompensation({
      compensation_model: "monthly_fixed",
      monthly_salary: 0,
    });
    expect(monthly.hasBasis).toBe(false);
    expect(monthly.missingReason).toBe("missing_monthly_salary");
  });

  it("accepterer procentleder med minimumsløn men uden procentsats", () => {
    const result = resolveCompensation({
      compensation_model: "percentage",
      percentage_rate: 0,
      minimum_salary: 30000,
    });
    expect(result.model).toBe("percentage");
    expect(result.hasBasis).toBe(true);
    expect(result.minimumSalary).toBe(30000);
  });

  it("udleder modellen for gamle rækker uden compensation_model", () => {
    expect(resolveCompensation({ percentage_rate: 16 }).model).toBe("percentage");
    expect(resolveCompensation({ hourly_rate: 190 }).model).toBe("hourly");
    expect(resolveCompensation({ monthly_salary: 40000 }).model).toBe("monthly_fixed");

    const empty = resolveCompensation({ monthly_salary: 0, hourly_rate: 0 });
    expect(empty.hasBasis).toBe(false);
    expect(empty.missingReason).toBe("missing_model");
  });
});

describe("proratering", () => {
  it("beregner andel af måneden ud fra arbejdsdage", () => {
    expect(prorationFactor(11, 22)).toBe(0.5);
    expect(prorationFactor(22, 22)).toBe(1);
    expect(prorationFactor(0, 22)).toBe(0);
  });

  it("dividerer ikke med 0", () => {
    expect(prorationFactor(10, 0)).toBe(1);
  });

  it("proraterer et fast månedsbeløb", () => {
    expect(prorateMonthlyAmount(40000, 11, 22)).toBe(20000);
    expect(prorateMonthlyAmount(40000, 22, 22)).toBe(40000);
    expect(prorateMonthlyAmount(30000, 7, 22)).toBe(9545.45);
  });
});

describe("feriepenge pr. medarbejdertype", () => {
  it("bruger 12,5 % for sælger, assistent og stab og 1 % for leder", () => {
    expect(vacationRateFor("seller", rates)).toBe(0.125);
    expect(vacationRateFor("assistant", rates)).toBe(0.125);
    expect(vacationRateFor("staff", rates)).toBe(0.125);
    expect(vacationRateFor("leader", rates)).toBe(0.01);
  });

  it("lægger feriepenge oveni grundlønnen", () => {
    const seller = computeSellerSalaryCost(20000, rates);
    expect(seller.base).toBe(20000);
    expect(seller.vacationPay).toBe(2500);
    expect(seller.total).toBe(22500);

    const leader = withVacationPay(50000, rates.leader);
    expect(leader.vacationPay).toBe(500);
    expect(leader.total).toBe(50500);
  });

  it("følger redigerede satser", () => {
    const custom = { seller: 0.1, assistant: 0.15, staff: 0.125, leader: 0.02 };
    expect(computeSellerSalaryCost(10000, custom).total).toBe(11000);
    expect(withVacationPay(10000, custom.assistant).total).toBe(11500);
  });
});

describe("computeAtpCost", () => {
  it("ganger aktive medarbejdere med satsen og proraterer", () => {
    expect(computeAtpCost({ activeMemberCount: 10, ratePerMember: 381, prorationFactor: 1 })).toBe(3810);
    expect(computeAtpCost({ activeMemberCount: 10, ratePerMember: 381, prorationFactor: 0.5 })).toBe(1905);
  });

  it("giver 0 uden aktive medarbejdere", () => {
    expect(computeAtpCost({ activeMemberCount: 0, ratePerMember: 381, prorationFactor: 1 })).toBe(0);
  });

  it("ignorerer negative værdier", () => {
    expect(computeAtpCost({ activeMemberCount: -5, ratePerMember: 381, prorationFactor: 1 })).toBe(0);
    expect(computeAtpCost({ activeMemberCount: 5, ratePerMember: -381, prorationFactor: 1 })).toBe(0);
  });
});

describe("computeLeaderSalary", () => {
  it("beregner procent af DB før lederløn", () => {
    const result = computeLeaderSalary({
      dbBeforeLeader: 500000,
      percentageRate: 16,
      minimumSalary: 0,
      prorationFactor: 1,
      leaderVacationRate: rates.leader,
    });
    expect(result.calculated).toBe(80000);
    expect(result.salary).toBe(80000);
    expect(result.vacationPay).toBe(800);
    expect(result.totalCost).toBe(80800);
    expect(result.usesMinimum).toBe(false);
  });

  it("bruger minimumsløn som gulv — ikke som tillæg", () => {
    const result = computeLeaderSalary({
      dbBeforeLeader: 100000,
      percentageRate: 16,
      minimumSalary: 35000,
      prorationFactor: 1,
      leaderVacationRate: rates.leader,
    });
    expect(result.calculated).toBe(16000);
    expect(result.proratedMinimum).toBe(35000);
    expect(result.salary).toBe(35000);
    expect(result.usesMinimum).toBe(true);
  });

  it("proraterer minimumslønnen efter periodens længde", () => {
    const result = computeLeaderSalary({
      dbBeforeLeader: 50000,
      percentageRate: 10,
      minimumSalary: 30000,
      prorationFactor: 0.5,
      leaderVacationRate: rates.leader,
    });
    expect(result.proratedMinimum).toBe(15000);
    expect(result.salary).toBe(15000);
  });

  it("giver aldrig negativ lederløn ved negativt DB", () => {
    const result = computeLeaderSalary({
      dbBeforeLeader: -200000,
      percentageRate: 20,
      minimumSalary: 0,
      prorationFactor: 1,
      leaderVacationRate: rates.leader,
    });
    expect(result.calculated).toBe(-40000);
    expect(result.salary).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("returnerer manglende grundlag i stedet for 0 kr. når teamet ikke har leder/lønrække", () => {
    const result = computeLeaderSalary({
      dbBeforeLeader: 500000,
      percentageRate: 0,
      minimumSalary: 0,
      prorationFactor: 1,
      leaderVacationRate: rates.leader,
      hasBasis: false,
    });
    expect(result.hasBasis).toBe(false);
    expect(result.salary).toBe(0);
  });
});

describe("computeTeamDb", () => {
  const base = {
    adjustedRevenue: 1000000,
    adjustedSellerCommission: 400000,
    sickPayAmount: 5000,
    otherCosts: 25000,
    assistantCost: 45000,
    atpCost: 3810,
    leader: { percentageRate: 16, minimumSalary: 35000 },
    prorationFactor: 1,
    rates,
  };

  it("trækker assistentløn og ATP FØR lederlønnen beregnes", () => {
    const result = computeTeamDb(base);
    // 1.000.000 − (400.000 + 50.000) − 5.000 − 25.000 − 45.000 − 3.810
    expect(result.sellerSalaryCost).toBe(450000);
    expect(result.dbBeforeLeader).toBe(471190);
    expect(result.leader.salary).toBeCloseTo(75390.4, 2);
    expect(result.finalDb).toBeCloseTo(471190 - 75390.4 * 1.01, 2);
  });

  it("assistentløn på 0 giver højere lederløn end assistentløn med beløb", () => {
    const withAssistant = computeTeamDb(base);
    const withoutAssistant = computeTeamDb({ ...base, assistantCost: 0 });
    expect(withoutAssistant.leader.salary).toBeGreaterThan(withAssistant.leader.salary);
    expect(withoutAssistant.dbBeforeLeader - withAssistant.dbBeforeLeader).toBe(45000);
  });

  it("giver samme resultat uanset hvilken fane der kalder den (ét kodested)", () => {
    const a = computeTeamDb(base);
    const b = computeTeamDb({ ...base });
    expect(a).toEqual(b);
  });
});

describe("fordeling ud på klienter", () => {
  it("fordeler efter omsætningsandel", () => {
    const result = allocateByWeights(90000, [600000, 300000, 100000]);
    expect(result[0]).toBe(54000);
    expect(result[1]).toBe(27000);
    expect(result[2]).toBe(9000);
    expect(result.reduce((s, v) => s + v, 0)).toBeCloseTo(90000, 6);
  });

  it("fordeler efter positiv DB-andel og ignorerer negative DB", () => {
    const result = allocateByWeights(50000, [100000, -40000, 100000]);
    expect(result[0]).toBe(25000);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(25000);
  });

  it("fordeler ikke når summen er 0", () => {
    expect(allocateByWeights(50000, [0, 0])).toEqual([0, 0]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});
