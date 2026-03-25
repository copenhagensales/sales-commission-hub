/**
 * Forecast Module — Type Definitions
 * 
 * Types for the client sales forecast system.
 * Covers ramp profiles, survival/churn, cohorts, and forecast results.
 */

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

export interface ForecastRampProfile {
  id: string;
  name: string;
  client_campaign_id: string | null;
  day_1_7_factor: number;
  day_8_14_factor: number;
  day_15_30_factor: number;
  day_31_60_factor: number;
  steady_state_factor: number;
  created_at: string;
}

export interface ForecastSurvivalProfile {
  id: string;
  name: string;
  client_campaign_id: string | null;
  survival_day_7: number;
  survival_day_14: number;
  survival_day_30: number;
  survival_day_60: number;
  created_at: string;
}

export interface ClientForecastCohort {
  id: string;
  client_id: string;
  client_campaign_id: string | null;
  start_date: string;
  planned_headcount: number;
  ramp_profile_id: string | null;
  survival_profile_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ClientForecast {
  id: string;
  client_id: string;
  client_campaign_id: string | null;
  period_start: string;
  period_end: string;
  forecast_sales_low: number | null;
  forecast_sales_expected: number | null;
  forecast_sales_high: number | null;
  forecast_hours: number | null;
  forecast_heads: number | null;
  churn_loss: number | null;
  absence_loss: number | null;
  drivers_json: ForecastDrivers;
  calculated_at: string;
}

// ============================================================================
// CALCULATION TYPES
// ============================================================================

export interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  teamName: string | null;
  avatarUrl: string | null;
  weeklySalesPerHour: number[]; // Most recent first
  grossPlannedHours: number;
  plannedHours: number;
  personalAttendanceFactor: number;
  isEstablished: boolean;
  daysSinceStart: number;
  missingAgentMapping?: boolean;
  plannedEndDate?: string;
  isOnCall?: boolean;
  totalHoursWorked?: number;
  totalSalesCount?: number;
  validWeekCount?: number;
}

export interface CohortForecastInput {
  cohort: ClientForecastCohort;
  rampProfile: ForecastRampProfile;
  survivalProfile: ForecastSurvivalProfile;
  campaignBaselineSph: number;
  weeklyHoursPerHead: number;
  attendanceFactor: number;
  periodStart: string;
  periodEnd: string;
  holidays?: Set<string>;
}

export interface EmployeeForecastResult {
  employeeId: string;
  employeeName: string;
  teamName: string | null;
  avatarUrl: string | null;
  isEstablished: boolean;
  isNew?: boolean;
  rampFactor?: number;
  plannedHours: number;
  expectedSph: number;
  attendanceFactor: number;
  forecastSales: number;
  forecastSalesLow: number;
  forecastSalesHigh: number;
  actualSales?: number;
  churnProbability: number;
  churnLoss: number;
  momentumFactor?: number;
  missingAgentMapping?: boolean;
  plannedEndDate?: string;
  isOnCall?: boolean;
  reliabilityWeight?: number;
  empiricalSph?: number;
  hybridBlend?: boolean;
  // Product split (Eesy FM: 5G Internet vs Subscriptions)
  forecastSalesSubs?: number;
  forecastSales5G?: number;
  actualSalesSubs?: number;
  actualSales5G?: number;
}

// ============================================================================
// TEAM CHURN RATES
// ============================================================================

export interface TenureBucketRates {
  bucket0_60: number;   // monthly churn rate for 0-60 days tenure
  bucket61_180: number; // monthly churn rate for 61-180 days tenure
  bucket180plus: number; // monthly churn rate for 180+ days tenure
}

export type TeamChurnRates = Map<string, TenureBucketRates>;

export interface CohortForecastResult {
  cohortId: string;
  startDate: string;
  plannedHeadcount: number;
  effectiveHeads: number;
  rampFactor: number;
  survivalFactor: number;
  forecastHours: number;
  forecastSales: number;
  forecastSalesLow: number;
  forecastSalesHigh: number;
  note: string | null;
  // Debug breakdown from week-by-week simulation
  activeDays?: number;
  weightedRampFactor?: number;
  weightedSurvivalFactor?: number;
  baselineSph?: number;
}

export interface ForecastResult {
  periodStart: string;
  periodEnd: string;
  clientId: string;
  clientCampaignId: string | null;

  // Totals
  totalSalesGross?: number;
  totalSalesExpected: number;
  totalSalesLow: number;
  totalSalesHigh: number;
  totalHours: number;
  totalHeads: number;
  churnLoss: number;
  absenceLoss: number;
  establishedChurnLoss: number;

  // Actual + remaining (for current period)
  actualSalesToDate?: number;
  remainingForecast?: number;
  daysElapsed?: number;
  daysRemaining?: number;

  // Product split (Eesy FM: 5G Internet vs Subscriptions)
  totalSalesSubs?: number;
  totalSales5G?: number;
  actualSalesSubs?: number;
  actualSales5G?: number;

  // Breakdowns
  establishedEmployees: EmployeeForecastResult[];
  cohorts: CohortForecastResult[];
  
  // Drivers
  drivers: ForecastDriver[];
}

export interface ForecastDriver {
  key: string;
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  value: string;
  description: string;
}

export interface ForecastDrivers {
  totalEstablished: number;
  totalCohortSales: number;
  avgAttendance: number;
  avgChurn: number;
  newCohortCount: number;
  topPerformers: string[];
  [key: string]: unknown;
}

// ============================================================================
// KPI CARD TYPES
// ============================================================================

export interface ForecastKpi {
  label: string;
  value: number;
  valueLow?: number;
  valueHigh?: number;
  unit: string;
  trend?: number; // % change vs last period
  icon: string;
}

// ============================================================================
// FORECAST VS ACTUAL
// ============================================================================

export interface ForecastVsActual {
  period: string;
  forecastLow: number;
  forecastExpected: number;
  forecastHigh: number;
  actual: number;
  accuracy: number; // 0-100%
}

// ============================================================================
// UI STATE
// ============================================================================

export interface ForecastFilters {
  clientId: string | null;
  clientCampaignId: string | null;
  periodStart: string;
  periodEnd: string;
}

export type ForecastInterval = 'low' | 'expected' | 'high';
