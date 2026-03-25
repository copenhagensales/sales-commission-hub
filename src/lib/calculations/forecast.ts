/**
 * Forecast Calculation Library
 * 
 * Pure functions for computing sales forecasts.
 * Uses EWMA for established employees and ramp/survival curves for cohorts.
 */

import type {
  EmployeePerformance,
  EmployeeForecastResult,
  CohortForecastInput,
  CohortForecastResult,
  ForecastResult,
  ForecastDriver,
  ForecastRampProfile,
  ForecastSurvivalProfile,
  ForecastVsActual,
  TeamChurnRates,
} from "@/types/forecast";

// ============================================================================
// CONSTANTS
// ============================================================================

const EWMA_DECAY = 0.85;
export const LOW_FACTOR = 0.85;
export const HIGH_FACTOR = 1.12;
const DEFAULT_WEEKLY_HOURS = 37;

// ============================================================================
// EWMA CALCULATION
// ============================================================================

/**
 * Exponential Weighted Moving Average for sales-per-hour.
 * Recent weeks are weighted more heavily.
 * @param weeklySph - Array of weekly sales/hour, index 0 = most recent
 */
export function calculateEwmaSph(weeklySph: number[]): number {
  if (weeklySph.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < weeklySph.length; i++) {
    const weight = Math.pow(EWMA_DECAY, i);
    weightedSum += weeklySph[i] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

// ============================================================================
// RAMP FACTOR LOOKUP
// ============================================================================

/**
 * Get ramp factor for a given number of days since start.
 */
export function getRampFactor(daysSinceStart: number, profile: ForecastRampProfile): number {
  if (daysSinceStart <= 7) return profile.day_1_7_factor;
  if (daysSinceStart <= 14) return profile.day_8_14_factor;
  if (daysSinceStart <= 30) return profile.day_15_30_factor;
  if (daysSinceStart <= 60) return profile.day_31_60_factor;
  return profile.steady_state_factor;
}

// ============================================================================
// SURVIVAL INTERPOLATION
// ============================================================================

/**
 * Interpolate survival factor for a given day.
 */
export function getSurvivalFactor(daysSinceStart: number, profile: ForecastSurvivalProfile): number {
  if (daysSinceStart <= 0) return 1.0;
  
  const points = [
    { day: 0, survival: 1.0 },
    { day: 7, survival: profile.survival_day_7 },
    { day: 14, survival: profile.survival_day_14 },
    { day: 30, survival: profile.survival_day_30 },
    { day: 60, survival: profile.survival_day_60 },
  ];
  
  // Find surrounding points
  for (let i = 0; i < points.length - 1; i++) {
    if (daysSinceStart >= points[i].day && daysSinceStart <= points[i + 1].day) {
      const range = points[i + 1].day - points[i].day;
      const progress = (daysSinceStart - points[i].day) / range;
      return points[i].survival + (points[i + 1].survival - points[i].survival) * progress;
    }
  }
  
  return points[points.length - 1].survival;
}

// ============================================================================
// ESTABLISHED CHURN RATE
// ============================================================================

/**
 * Get monthly churn probability for an established employee based on tenure and team history.
 */
export function getEstablishedChurnRate(daysSinceStart: number, teamName: string | null, teamChurnRates?: TeamChurnRates): number {
  if (!teamChurnRates || !teamName) return 0.02; // fallback 2%/month
  
  const rates = teamChurnRates.get(teamName);
  if (!rates) return 0.02;
  
  if (daysSinceStart <= 60) return rates.bucket0_60;
  if (daysSinceStart <= 180) return rates.bucket61_180;
  return rates.bucket180plus;
}

// ============================================================================
// MOMENTUM CORRECTION
// ============================================================================

/**
 * Apply momentum correction for future periods.
 * Compares the 2 most recent weeks' SPH against the full EWMA.
 * If recent performance is >5% above EWMA, boost SPH (capped at +25%).
 */
export function applyMomentum(weeklySph: number[], ewmaSph: number): { adjustedSph: number; momentumFactor: number } {
  if (weeklySph.length < 2 || ewmaSph <= 0) {
    return { adjustedSph: ewmaSph, momentumFactor: 1.0 };
  }

  const recentSph = (weeklySph[0] + weeklySph[1]) / 2;
  const ratio = recentSph / ewmaSph;

  if (ratio > 1.05) {
    const momentumFactor = Math.min(ratio, 1.25);
    return { adjustedSph: ewmaSph * momentumFactor, momentumFactor };
  }

  return { adjustedSph: ewmaSph, momentumFactor: 1.0 };
}

// ============================================================================
// EMPLOYEE FORECAST
// ============================================================================

/**
 * Calculate forecast for a single established employee.
 * When isFuturePeriod is true, momentum correction is applied.
 */
export function forecastEstablishedEmployee(emp: EmployeePerformance, teamChurnRates?: TeamChurnRates, isFuturePeriod?: boolean): EmployeeForecastResult {
  const ewmaSph = calculateEwmaSph(emp.weeklySalesPerHour);
  
  // Apply momentum only for future periods
  const { adjustedSph, momentumFactor } = isFuturePeriod
    ? applyMomentum(emp.weeklySalesPerHour, ewmaSph)
    : { adjustedSph: ewmaSph, momentumFactor: 1.0 };
  
  const effectiveHours = emp.plannedHours * emp.personalAttendanceFactor;
  const expected = effectiveHours * adjustedSph;
  
  const churnProbability = getEstablishedChurnRate(emp.daysSinceStart, emp.teamName, teamChurnRates);
  const churnLoss = expected * churnProbability * 0.5; // Mid-month departure: avg half month lost
  
  return {
    employeeId: emp.employeeId,
    employeeName: emp.employeeName,
    teamName: emp.teamName,
    avatarUrl: emp.avatarUrl,
    isEstablished: true,
    isNew: false,
    plannedHours: emp.plannedHours,
    expectedSph: adjustedSph,
    attendanceFactor: emp.personalAttendanceFactor,
    forecastSales: Math.round(expected),
    forecastSalesLow: Math.round(expected * LOW_FACTOR),
    forecastSalesHigh: Math.round(expected * HIGH_FACTOR),
    churnProbability,
    churnLoss: Math.round(churnLoss),
    momentumFactor: momentumFactor > 1.0 ? momentumFactor : undefined,
    missingAgentMapping: emp.missingAgentMapping,
    plannedEndDate: emp.plannedEndDate,
    isOnCall: emp.isOnCall,
  };
}

/**
 * Calculate forecast for a new employee (≤60 days) using ramp-up model.
 */
export function forecastNewEmployee(
  emp: EmployeePerformance,
  rampProfile: ForecastRampProfile,
  baselineSph: number,
  teamChurnRates?: TeamChurnRates,
): EmployeeForecastResult {
  const rampFactor = getRampFactor(emp.daysSinceStart, rampProfile);
  const rampedSph = baselineSph * rampFactor;
  const effectiveHours = emp.plannedHours * emp.personalAttendanceFactor;
  const expected = effectiveHours * rampedSph;
  
  const churnProbability = getEstablishedChurnRate(emp.daysSinceStart, emp.teamName, teamChurnRates);
  const churnLoss = expected * churnProbability * 0.5; // Mid-month departure: avg half month lost
  
  return {
    employeeId: emp.employeeId,
    employeeName: emp.employeeName,
    teamName: emp.teamName,
    avatarUrl: emp.avatarUrl,
    isEstablished: false,
    isNew: true,
    rampFactor,
    plannedHours: emp.plannedHours,
    expectedSph: rampedSph,
    attendanceFactor: emp.personalAttendanceFactor,
    forecastSales: Math.round(expected),
    forecastSalesLow: Math.round(expected * LOW_FACTOR),
    forecastSalesHigh: Math.round(expected * HIGH_FACTOR),
    churnProbability,
    churnLoss: Math.round(churnLoss),
    missingAgentMapping: emp.missingAgentMapping,
    plannedEndDate: emp.plannedEndDate,
    isOnCall: emp.isOnCall,
  };
}

// ============================================================================
// HYBRID NEW HIRE FORECAST
// ============================================================================

/**
 * Calculate reliability weight for blending ramp vs empirical SPH.
 * Returns 0 when data is insufficient, scales to 1 as data grows.
 */
export function calculateReliabilityWeight(
  totalHours: number,
  totalSales: number,
  validWeeks: number,
): number {
  if (validWeeks < 2 || totalHours < 20) return 0;
  const weekFactor = Math.min((validWeeks - 1) / 5, 1);
  const hourFactor = Math.min(totalHours / 80, 1);
  return Math.min(weekFactor * hourFactor, 1);
}

/**
 * Hybrid forecast for new employees (≤60 days).
 * Blends ramp-up model with empirical EWMA SPH based on data reliability.
 * Applies momentum with a conservative ±15% cap for new hires.
 */
export function forecastNewEmployeeHybrid(
  emp: EmployeePerformance,
  rampProfile: ForecastRampProfile,
  baselineSph: number,
  teamChurnRates?: TeamChurnRates,
): EmployeeForecastResult {
  const rampFactor = getRampFactor(emp.daysSinceStart, rampProfile);
  const rampedSph = baselineSph * rampFactor;

  const totalHours = emp.totalHoursWorked ?? 0;
  const totalSales = emp.totalSalesCount ?? 0;
  const validWeeks = emp.validWeekCount ?? 0;

  const w = calculateReliabilityWeight(totalHours, totalSales, validWeeks);

  let finalSph = rampedSph;
  let empiricalSphUsed: number | undefined;
  let hybridBlend = false;

  if (w > 0 && emp.weeklySalesPerHour.length >= 2) {
    const rawEmpiricalSph = calculateEwmaSph(emp.weeklySalesPerHour);

    // Guardrail: clamp empirical SPH to [0.6x, 1.4x] of campaign baseline SPH
    // Using baselineSph (not rampedSph) so high-performing new hires aren't suppressed by low ramp factors
    const clampLow = baselineSph * 0.6;
    const clampHigh = baselineSph * 1.4;
    const clampedEmpiricalSph = Math.max(clampLow, Math.min(clampHigh, rawEmpiricalSph));

    // Asymmetric blending: if empirical >= ramp AND reliability is sufficient,
    // trust proven performance instead of dragging it down with low ramp average
    if (clampedEmpiricalSph >= rampedSph && w >= 0.5) {
      finalSph = clampedEmpiricalSph;
    } else {
      finalSph = (1 - w) * rampedSph + w * clampedEmpiricalSph;
    }
    empiricalSphUsed = rawEmpiricalSph;
    hybridBlend = true;

    // Momentum for new hires: only if ≥3 valid weeks, cap ±15%
    if (validWeeks >= 3 && emp.weeklySalesPerHour.length >= 2) {
      const recentSph = (emp.weeklySalesPerHour[0] + emp.weeklySalesPerHour[1]) / 2;
      const ratio = recentSph / finalSph;
      if (ratio > 1.05) {
        finalSph *= Math.min(ratio, 1.15); // cap +15%
      } else if (ratio < 0.95) {
        finalSph *= Math.max(ratio, 0.85); // cap -15%
      }
    }
  }

  const effectiveHours = emp.plannedHours * emp.personalAttendanceFactor;
  const expected = effectiveHours * finalSph;

  const churnProbability = getEstablishedChurnRate(emp.daysSinceStart, emp.teamName, teamChurnRates);
  const churnLoss = expected * churnProbability * 0.5;

  return {
    employeeId: emp.employeeId,
    employeeName: emp.employeeName,
    teamName: emp.teamName,
    avatarUrl: emp.avatarUrl,
    isEstablished: false,
    isNew: true,
    rampFactor,
    plannedHours: emp.plannedHours,
    expectedSph: finalSph,
    attendanceFactor: emp.personalAttendanceFactor,
    forecastSales: Math.round(expected),
    forecastSalesLow: Math.round(expected * LOW_FACTOR),
    forecastSalesHigh: Math.round(expected * HIGH_FACTOR),
    churnProbability,
    churnLoss: Math.round(churnLoss),
    missingAgentMapping: emp.missingAgentMapping,
    plannedEndDate: emp.plannedEndDate,
    isOnCall: emp.isOnCall,
    reliabilityWeight: w > 0 ? w : undefined,
    empiricalSph: empiricalSphUsed,
    hybridBlend,
  };
}

// ============================================================================
// COHORT FORECAST
// ============================================================================

/**
 * Calculate forecast for a new hire cohort using week-by-week simulation.
 * Instead of a single midpoint ramp/survival, this iterates day by day,
 * applying the correct ramp and survival factor for each day.
 */
export function forecastCohort(input: CohortForecastInput): CohortForecastResult {
  const { cohort, rampProfile, survivalProfile, campaignBaselineSph, weeklyHoursPerHead, attendanceFactor, periodStart, periodEnd, holidays } = input;
  
  const cohortStart = new Date(cohort.start_date);
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  
  // Effective start = latest of cohort start and period start
  const effectiveStart = cohortStart > pStart ? cohortStart : pStart;
  const effectiveEnd = pEnd;
  
  // Total calendar days in active window
  const totalCalendarDays = Math.max(0, Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
  
  if (totalCalendarDays <= 0) {
    return {
      cohortId: cohort.id,
      startDate: cohort.start_date,
      plannedHeadcount: cohort.planned_headcount,
      effectiveHeads: 0,
      rampFactor: 0,
      survivalFactor: 1,
      forecastHours: 0,
      forecastSales: 0,
      forecastSalesLow: 0,
      forecastSalesHigh: 0,
      note: cohort.note,
      activeDays: 0,
      weightedRampFactor: 0,
      weightedSurvivalFactor: 1,
      baselineSph: campaignBaselineSph,
    };
  }
  
  // Day-by-day simulation — only count workdays (Mon-Fri, skip holidays)
  const dailyHours = weeklyHoursPerHead / 5; // hours per head per WORKDAY
  let totalSales = 0;
  let totalHours = 0;
  let rampSum = 0;
  let survivalSum = 0;
  let workDays = 0;
  
  for (let d = 0; d < totalCalendarDays; d++) {
    const currentDate = new Date(effectiveStart);
    currentDate.setDate(currentDate.getDate() + d);
    
    // Skip weekends
    const dow = currentDate.getDay();
    if (dow === 0 || dow === 6) continue;
    
    // Skip holidays
    if (holidays) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (holidays.has(dateStr)) continue;
    }
    
    workDays++;
    
    // How many calendar days since cohort started (for ramp/survival lookup)
    const daysSinceCohortStart = Math.max(0, Math.floor((currentDate.getTime() - cohortStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    const dayRamp = getRampFactor(daysSinceCohortStart, rampProfile);
    const daySurvival = getSurvivalFactor(daysSinceCohortStart, survivalProfile);
    
    rampSum += dayRamp;
    survivalSum += daySurvival;
    
    const headsToday = cohort.planned_headcount * daySurvival;
    const hoursToday = headsToday * dailyHours * attendanceFactor;
    const salesToday = hoursToday * campaignBaselineSph * dayRamp;
    
    totalHours += hoursToday;
    totalSales += salesToday;
  }
  
  if (workDays === 0) {
    return {
      cohortId: cohort.id,
      startDate: cohort.start_date,
      plannedHeadcount: cohort.planned_headcount,
      effectiveHeads: 0,
      rampFactor: 0,
      survivalFactor: 1,
      forecastHours: 0,
      forecastSales: 0,
      forecastSalesLow: 0,
      forecastSalesHigh: 0,
      note: cohort.note,
      activeDays: 0,
      weightedRampFactor: 0,
      weightedSurvivalFactor: 1,
      baselineSph: campaignBaselineSph,
    };
  }
  
  const weightedRampFactor = rampSum / workDays;
  const weightedSurvivalFactor = survivalSum / workDays;
  const effectiveHeads = cohort.planned_headcount * weightedSurvivalFactor;
  
  return {
    cohortId: cohort.id,
    startDate: cohort.start_date,
    plannedHeadcount: cohort.planned_headcount,
    effectiveHeads: Math.round(effectiveHeads * 10) / 10,
    rampFactor: weightedRampFactor,
    survivalFactor: weightedSurvivalFactor,
    forecastHours: Math.round(totalHours),
    forecastSales: Math.round(totalSales),
    forecastSalesLow: Math.round(totalSales * LOW_FACTOR),
    forecastSalesHigh: Math.round(totalSales * HIGH_FACTOR),
    note: cohort.note,
    activeDays: workDays,
    weightedRampFactor,
    weightedSurvivalFactor,
    baselineSph: campaignBaselineSph,
  };
}

// ============================================================================
// FULL FORECAST
// ============================================================================

export function calculateFullForecast(
  employees: EmployeePerformance[],
  cohortInputs: CohortForecastInput[],
  periodStart: string,
  periodEnd: string,
  clientId: string,
  clientCampaignId: string | null,
  teamChurnRates?: TeamChurnRates,
  rampProfile?: ForecastRampProfile,
  baselineSph?: number,
  isFuturePeriod?: boolean,
  enableHybridNewHire?: boolean,
): ForecastResult {
  // Split employees into established (>60 days) and new (≤60 days)
  const established = employees.filter(e => e.isEstablished);
  const newHires = employees.filter(e => !e.isEstablished);
  
  const establishedResults = established.map(e => forecastEstablishedEmployee(e, teamChurnRates, isFuturePeriod));
  const newResults = (rampProfile && baselineSph != null)
    ? newHires.map(e => 
        enableHybridNewHire
          ? forecastNewEmployeeHybrid(e, rampProfile, baselineSph, teamChurnRates)
          : forecastNewEmployee(e, rampProfile, baselineSph, teamChurnRates)
      )
    : newHires.map(e => forecastEstablishedEmployee(e, teamChurnRates, isFuturePeriod)); // fallback
  
  const employeeResults = [...establishedResults, ...newResults];
  const cohortResults = cohortInputs.map(forecastCohort);
  
  const totalEstablishedChurnLoss = employeeResults.reduce((sum, e) => sum + e.churnLoss, 0);
  const totalEmployeeSales = employeeResults.reduce((sum, e) => sum + e.forecastSales, 0);
  const totalCohortSales = cohortResults.reduce((sum, c) => sum + c.forecastSales, 0);
  const totalExpected = totalEmployeeSales + totalCohortSales;
  
  const totalEmployeeHours = employeeResults.reduce((sum, e) => sum + e.plannedHours, 0);
  const totalCohortHours = cohortResults.reduce((sum, c) => sum + c.forecastHours, 0);
  
  const avgAttendance = employees.length > 0
    ? employees.reduce((sum, e) => sum + e.personalAttendanceFactor, 0) / employees.length
    : 0.92;
  
  // Absence loss = known absences + predicted future sickness
  const knownAbsenceLoss = employeeResults.reduce((sum, empResult, i) => {
    const emp = employees[i];
    const lostHours = (emp.grossPlannedHours || emp.plannedHours) - emp.plannedHours;
    return sum + lostHours * empResult.expectedSph;
  }, 0);
  
  const predictedAbsenceLoss = employeeResults.reduce((sum, empResult, i) => {
    const emp = employees[i];
    const predictedLostHours = emp.plannedHours * (1 - emp.personalAttendanceFactor);
    return sum + predictedLostHours * empResult.expectedSph;
  }, 0);
  
  const absenceLoss = knownAbsenceLoss + predictedAbsenceLoss;
  
  const cohortChurnLoss = cohortResults.reduce((sum, c) => 
    sum + (c.plannedHeadcount - c.effectiveHeads) * (c.forecastSales / Math.max(c.effectiveHeads, 0.1)), 0
  );
  
  // Build drivers
  const drivers: ForecastDriver[] = [];
  
  // Projection basis driver — explains methodology for non-current periods
  const establishedSalesTotal = employeeResults.reduce((s, e) => s + e.forecastSales, 0);
  const newHireCount = newResults.length;
  const newHireSales = newResults.reduce((s, e) => s + e.forecastSales, 0);
  
  drivers.push({
    key: 'projection_basis',
    label: 'Beregningsgrundlag',
    impact: 'neutral',
    value: `${employees.length} sælgere`,
    description: `Ren projektion baseret på historisk salgsrate (EWMA) for ${established.length} etablerede sælgere (${Math.round(establishedSalesTotal - newHireSales)} salg)${newHireCount > 0 ? ` og ramp-up model for ${newHireCount} nye sælgere (${Math.round(newHireSales)} salg)` : ''}. Churn og fravær fratrækkes det samlede forecast.`,
  });
  
  // Momentum driver — show when momentum correction is active
  if (isFuturePeriod) {
    const empWithMomentum = establishedResults.filter(e => e.momentumFactor && e.momentumFactor > 1.0);
    if (empWithMomentum.length > 0) {
      const avgMomentum = empWithMomentum.reduce((s, e) => s + (e.momentumFactor || 1), 0) / empWithMomentum.length;
      drivers.push({
        key: 'momentum',
        label: 'Positiv momentum',
        impact: 'positive',
        value: `+${Math.round((avgMomentum - 1) * 100)}%`,
        description: `${empWithMomentum.length} af ${established.length} etablerede sælgere har positiv trend de seneste 2 uger. Deres forecast er justeret op (maks +25%) for at afspejle nuværende momentum.`,
      });
    }
  }

  if (cohortResults.length > 0) {
    drivers.push({
      key: 'new_cohorts',
      label: `${cohortResults.length} nye opstartshold`,
      impact: 'positive',
      value: `+${totalCohortSales} salg`,
      description: `${cohortResults.reduce((s, c) => s + c.plannedHeadcount, 0)} nye sælgere bidrager med forventet ${totalCohortSales} salg efter ramp-up og churn.`,
    });
  }
  
  const knownPart = Math.round(knownAbsenceLoss) > 0 ? `Planlagt fravær (ferie/sygdom): ${Math.round(knownAbsenceLoss)} salg. ` : '';
  const predictedPart = `Forventet uforudset sygdom (~${Math.round((1 - avgAttendance) * 100)}%): ${Math.round(predictedAbsenceLoss)} salg.`;
  const absenceDesc = `${knownPart}${predictedPart} Total fraværseffekt: ${Math.round(absenceLoss)} salg.`;
  
  if (avgAttendance < 0.90) {
    drivers.push({
      key: 'low_attendance',
      label: 'Lav fremmøde',
      impact: 'negative',
      value: `-${Math.round(absenceLoss)} salg`,
      description: `Gennemsnitlig fremmøde er ${Math.round(avgAttendance * 100)}%. ${absenceDesc}`,
    });
  } else {
    drivers.push({
      key: 'attendance',
      label: 'Fraværseffekt',
      impact: absenceLoss > 20 ? 'negative' : 'neutral',
      value: `-${Math.round(absenceLoss)} salg`,
      description: `Gennemsnitlig fremmøde er ${Math.round(avgAttendance * 100)}%. ${absenceDesc}`,
    });
  }
  
  const topPerformers = employeeResults
    .sort((a, b) => b.forecastSales - a.forecastSales)
    .slice(0, 3);
  
  if (topPerformers.length > 0) {
    drivers.push({
      key: 'top_performers',
      label: 'Top-performere',
      impact: 'positive',
      value: `${topPerformers.reduce((s, p) => s + p.forecastSales, 0)} salg`,
      description: `Top 3: ${topPerformers.map(p => p.employeeName).join(', ')}`,
    });
  }
  
  if (cohortChurnLoss > 5) {
    drivers.push({
      key: 'cohort_churn',
      label: 'Cohort-churn',
      impact: 'negative',
      value: `-${Math.round(cohortChurnLoss)} salg`,
      description: `Forventet churn blandt nye opstartshold reducerer forecast med ~${Math.round(cohortChurnLoss)} salg.`,
    });
  }

  // Established employee churn driver
  if (totalEstablishedChurnLoss > 5) {
    const highRiskCount = employeeResults.filter(e => e.churnProbability >= 0.15).length;
    const medRiskCount = employeeResults.filter(e => e.churnProbability >= 0.05 && e.churnProbability < 0.15).length;
    const riskBreakdown: string[] = [];
    if (highRiskCount > 0) riskBreakdown.push(`${highRiskCount} med høj risiko (>15%)`);
    if (medRiskCount > 0) riskBreakdown.push(`${medRiskCount} med middel risiko (5-15%)`);
    
    drivers.push({
      key: 'established_churn',
      label: 'Etableret churn',
      impact: 'negative',
      value: `-${Math.round(totalEstablishedChurnLoss)} salg`,
      description: `Historisk churn-risiko blandt eksisterende sælgere baseret på anciennitet og team. ${riskBreakdown.join(', ')}.`,
    });
  }
  
  const totalChurnLoss = Math.round(cohortChurnLoss) + Math.round(totalEstablishedChurnLoss);

  return {
    periodStart,
    periodEnd,
    clientId,
    clientCampaignId,
    totalSalesGross: totalExpected,
    totalSalesExpected: totalExpected - totalChurnLoss,
    totalSalesLow: Math.round(totalExpected * LOW_FACTOR) - totalChurnLoss,
    totalSalesHigh: Math.round(totalExpected * HIGH_FACTOR) - totalChurnLoss,
    totalHours: totalEmployeeHours + totalCohortHours,
    totalHeads: employees.length + cohortResults.reduce((s, c) => s + c.effectiveHeads, 0),
    churnLoss: Math.round(cohortChurnLoss),
    absenceLoss: Math.round(absenceLoss),
    establishedChurnLoss: Math.round(totalEstablishedChurnLoss),
    establishedEmployees: employeeResults,
    cohorts: cohortResults,
    drivers,
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

export const MOCK_RAMP_PROFILE: ForecastRampProfile = {
  id: 'mock-ramp-1',
  name: 'Standard TM Ramp',
  client_campaign_id: null,
  day_1_7_factor: 0.15,
  day_8_14_factor: 0.35,
  day_15_30_factor: 0.60,
  day_31_60_factor: 0.85,
  steady_state_factor: 1.0,
  created_at: new Date().toISOString(),
};

export const MOCK_SURVIVAL_PROFILE: ForecastSurvivalProfile = {
  id: 'mock-surv-1',
  name: 'Standard Churn',
  client_campaign_id: null,
  survival_day_7: 0.92,
  survival_day_14: 0.84,
  survival_day_30: 0.74,
  survival_day_60: 0.66,
  created_at: new Date().toISOString(),
};

export function generateMockEmployees(): EmployeePerformance[] {
  const names = [
    'Andreas M.', 'Sofia K.', 'Mikkel J.', 'Emma L.', 'Oliver P.',
    'Ida R.', 'Victor S.', 'Freja N.', 'Noah H.', 'Laura B.',
    'Christian T.', 'Mathilde A.',
  ];
  
  return names.map((name, i) => {
    const plannedHours = 140 + Math.floor(Math.random() * 40);
    const grossPlannedHours = plannedHours + Math.floor(Math.random() * 20);
    return {
    employeeId: `emp-${i}`,
    employeeName: name,
    teamName: i < 6 ? 'Team Alpha' : 'Team Beta',
    avatarUrl: null,
    weeklySalesPerHour: Array.from({ length: 8 }, () => 0.3 + Math.random() * 0.6),
    grossPlannedHours,
    plannedHours,
    personalAttendanceFactor: 0.88 + Math.random() * 0.10,
    isEstablished: true,
    daysSinceStart: 90 + Math.floor(Math.random() * 300),
  };
  });
}

export function generateMockCohorts(): CohortForecastInput[] {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
  const periodStart = nextMonth.toISOString().split('T')[0];
  const periodEnd = endOfNextMonth.toISOString().split('T')[0];
  
  return [
    {
      cohort: {
        id: 'cohort-1',
        client_id: 'mock-client',
        client_campaign_id: null,
        start_date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 15).toISOString().split('T')[0],
        planned_headcount: 5,
        ramp_profile_id: null,
        survival_profile_id: null,
        note: '5 nye starter midt i måneden',
        created_by: null,
        created_at: new Date().toISOString(),
      },
      rampProfile: MOCK_RAMP_PROFILE,
      survivalProfile: MOCK_SURVIVAL_PROFILE,
      campaignBaselineSph: 0.45,
      weeklyHoursPerHead: DEFAULT_WEEKLY_HOURS,
      attendanceFactor: 0.90,
      periodStart,
      periodEnd,
    },
    {
      cohort: {
        id: 'cohort-2',
        client_id: 'mock-client',
        client_campaign_id: null,
        start_date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1).toISOString().split('T')[0],
        planned_headcount: 3,
        ramp_profile_id: null,
        survival_profile_id: null,
        note: '3 nye fra start af måneden',
        created_by: null,
        created_at: new Date().toISOString(),
      },
      rampProfile: MOCK_RAMP_PROFILE,
      survivalProfile: MOCK_SURVIVAL_PROFILE,
      campaignBaselineSph: 0.45,
      weeklyHoursPerHead: DEFAULT_WEEKLY_HOURS,
      attendanceFactor: 0.90,
      periodStart,
      periodEnd,
    },
  ];
}

export function generateMockForecastVsActual(): ForecastVsActual[] {
  return [
    { period: 'Dec 2025', forecastLow: 245, forecastExpected: 290, forecastHigh: 325, actual: 278, accuracy: 96 },
    { period: 'Jan 2026', forecastLow: 260, forecastExpected: 305, forecastHigh: 342, actual: 312, accuracy: 98 },
    { period: 'Feb 2026', forecastLow: 240, forecastExpected: 285, forecastHigh: 320, actual: 268, accuracy: 94 },
    { period: 'Mar 2026', forecastLow: 270, forecastExpected: 315, forecastHigh: 353, actual: 0, accuracy: 0 },
  ];
}

export function generateMockForecast(): ForecastResult {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  
  return calculateFullForecast(
    generateMockEmployees(),
    generateMockCohorts(),
    nextMonth.toISOString().split('T')[0],
    endOfNextMonth.toISOString().split('T')[0],
    'mock-client',
    null,
  );
}
