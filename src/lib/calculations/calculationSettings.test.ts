import { describe, it, expect } from "vitest";
import {
  DEFAULT_CALCULATION_SETTINGS,
  clampSettingNumber,
  clampWorkdays,
  formatRatePercent,
  normalizeVacationRate,
  parseCalculationSettings,
  toSettingValue,
} from "./calculationSettings";

describe("DEFAULT_CALCULATION_SETTINGS", () => {
  it("er identiske med den tidligere hardkodede adfærd", () => {
    expect(DEFAULT_CALCULATION_SETTINGS.vacationPayRates).toEqual({
      seller: 0.125,
      assistant: 0.125,
      staff: 0.125,
      leader: 0.01,
    });
    expect(DEFAULT_CALCULATION_SETTINGS.workdaysPerMonth).toBe(22);
    expect(DEFAULT_CALCULATION_SETTINGS.atpBarselRate).toBe(381);
    expect(DEFAULT_CALCULATION_SETTINGS.stabTeamId).toBe(
      "09012ce9-e307-4f6d-a51e-f72af7200d74"
    );
  });
});

describe("parseCalculationSettings", () => {
  it("falder tilbage til defaults når tabellen er tom", () => {
    expect(parseCalculationSettings([])).toEqual(DEFAULT_CALCULATION_SETTINGS);
    expect(parseCalculationSettings(null)).toEqual(DEFAULT_CALCULATION_SETTINGS);
  });

  it("læser gemte satser", () => {
    const settings = parseCalculationSettings([
      { key: "vacation_pay_rates", value: { seller: 0.13, assistant: 0.125, staff: 0.125, leader: 0.02 } },
      { key: "workdays_per_month", value: { days: 21 } },
      { key: "atp_barsel_rate", value: { amount: 400 } },
      { key: "stab_team_id", value: { team_id: "11111111-2222-3333-4444-555555555555" } },
    ]);
    expect(settings.vacationPayRates.seller).toBe(0.13);
    expect(settings.vacationPayRates.leader).toBe(0.02);
    expect(settings.workdaysPerMonth).toBe(21);
    expect(settings.atpBarselRate).toBe(400);
    expect(settings.stabTeamId).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("tolker procenttal som brøk", () => {
    const settings = parseCalculationSettings([
      { key: "vacation_pay_rates", value: { seller: 12.5, leader: 1 } },
    ]);
    expect(settings.vacationPayRates.seller).toBe(0.125);
    // 1 tolkes som brøk (100 %) er urealistisk, men grænsen respekteres
    expect(settings.vacationPayRates.leader).toBe(1);
  });

  it("ignorerer ukendte nøgler og ugyldige værdier", () => {
    const settings = parseCalculationSettings([
      { key: "ukendt_noegle", value: { foo: 1 } },
      { key: "workdays_per_month", value: { days: "ikke et tal" } },
      { key: "atp_barsel_rate", value: null },
      { key: "stab_team_id", value: { team_id: "ikke-et-uuid" } },
    ]);
    expect(settings.workdaysPerMonth).toBe(22);
    expect(settings.atpBarselRate).toBe(381);
    expect(settings.stabTeamId).toBe(DEFAULT_CALCULATION_SETTINGS.stabTeamId);
  });

  it("tillader eksplicit at fjerne Stab-teamet", () => {
    const settings = parseCalculationSettings([
      { key: "stab_team_id", value: { team_id: null } },
    ]);
    expect(settings.stabTeamId).toBeNull();
  });
});

describe("grænser", () => {
  it("klamper arbejdsdage til 1–31 hele dage", () => {
    expect(clampWorkdays(0, 22)).toBe(1);
    expect(clampWorkdays(45, 22)).toBe(31);
    expect(clampWorkdays(21.4, 22)).toBe(21);
  });

  it("klamper ATP-satsen", () => {
    expect(clampSettingNumber(-10, { min: 0, max: 100000 }, 381)).toBe(0);
    expect(clampSettingNumber(999999, { min: 0, max: 100000 }, 381)).toBe(100000);
    expect(clampSettingNumber("abc", { min: 0, max: 100000 }, 381)).toBe(381);
  });

  it("afviser negative feriepengesatser", () => {
    expect(normalizeVacationRate(-0.1, 0.125)).toBe(0.125);
    expect(normalizeVacationRate(150, 0.125)).toBe(0.125);
  });
});

describe("toSettingValue", () => {
  it("bygger de jsonb-værdier der gemmes", () => {
    const s = DEFAULT_CALCULATION_SETTINGS;
    expect(toSettingValue("vacation_pay_rates", s)).toEqual(s.vacationPayRates);
    expect(toSettingValue("workdays_per_month", s)).toEqual({ days: 22 });
    expect(toSettingValue("atp_barsel_rate", s)).toEqual({ amount: 381 });
    expect(toSettingValue("stab_team_id", s)).toEqual({ team_id: s.stabTeamId });
  });
});

describe("formatRatePercent", () => {
  it("formaterer brøk som dansk procent", () => {
    expect(formatRatePercent(0.125)).toBe("12,5 %");
    expect(formatRatePercent(0.01)).toBe("1 %");
  });
});
