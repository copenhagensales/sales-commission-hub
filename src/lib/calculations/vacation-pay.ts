/**
 * Vacation Pay Constants and Calculations
 * 
 * Single source of truth for all vacation pay (feriepenge) rates.
 * Rates are defined according to Danish labor law.
 */

/**
 * Vacation pay rates by employee type.
 * 
 * - SELLER (12.5%): Standard rate for hourly employees with "Ferie med udbetalt feriegodtgørelse"
 * - ASSISTANT (12.5%): Same as sellers, assisterende teamledere
 * - STAFF (12.5%): Same as sellers, stabspersonale
 * - LEADER (1%): For employees with "Ferie med løn" (paid vacation)
 */
export const VACATION_PAY_RATES = {
  /** 12.5% for sellers (Ferie med udbetalt feriegodtgørelse) */
  SELLER: 0.125,
  /** 12.5% for assistants */
  ASSISTANT: 0.125,
  /** 12.5% for staff employees */
  STAFF: 0.125,
  /** 1% for team leaders (Ferie med løn) */
  LEADER: 0.01,
} as const;

export type VacationType = 'vacation_pay' | 'vacation_bonus' | null;

/**
 * Gets the vacation pay rate for a given vacation type.
 * 
 * @param vacationType - The employee's vacation type setting
 * @returns The vacation pay rate (e.g., 0.125 for 12.5%)
 */
export function getVacationPayRate(vacationType: VacationType): number {
  switch (vacationType) {
    case 'vacation_pay':
      return VACATION_PAY_RATES.SELLER;
    case 'vacation_bonus':
      return VACATION_PAY_RATES.LEADER;
    default:
      return 0;
  }
}

/**
 * Calculates vacation pay for a given commission amount.
 * 
 * @param commission - The base commission amount
 * @param rate - Vacation pay rate (default: SELLER rate of 12.5%)
 * @returns Vacation pay amount
 */
export function calculateVacationPay(
  commission: number,
  rate: number = VACATION_PAY_RATES.SELLER
): number {
  return commission * rate;
}

/**
 * Calculates total pay including vacation pay.
 * 
 * @param basePay - The base pay amount (commission or hourly)
 * @param rate - Vacation pay rate (default: SELLER rate of 12.5%)
 * @returns Total pay including vacation pay (basePay * 1.125 for 12.5%)
 */
export function calculatePayWithVacation(
  basePay: number,
  rate: number = VACATION_PAY_RATES.SELLER
): number {
  return basePay * (1 + rate);
}

/**
 * Gets the vacation pay multiplier for easier calculation.
 * 
 * @param rate - Vacation pay rate (default: SELLER rate)
 * @returns Multiplier to apply (e.g., 1.125 for 12.5%)
 */
export function getVacationPayMultiplier(
  rate: number = VACATION_PAY_RATES.SELLER
): number {
  return 1 + rate;
}
