import { useState, useMemo } from 'react';
import { addDays, addMonths, format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { da } from 'date-fns/locale';

export interface LiquidityCustomer {
  id: string;
  name: string;
  monthly_invoice_amount: number;
  invoice_day: number; // 0 = last day of month
  payment_terms_days: number;
  pays_on_time: boolean;
  average_delay_days: number;
  is_active: boolean;
}

export interface LiquidityExpense {
  id: string;
  name: string;
  expense_type: 'salary' | 'software' | 'rent' | 'marketing' | 'other';
  amount: number;
  payment_day: number;
  recurrence: 'monthly' | 'weekly' | 'one_time';
  one_time_date?: string;
  is_vat_deductible: boolean;
  is_active: boolean;
}

export interface LiquiditySettings {
  startingBalance: number;
  startingDate: Date;
  forecastMonths: number;
  vatRate: number;
  vatPaymentDay: number;
  totalMonthlySalary: number;
  vacationPayPercent: number;
  salaryPaymentDay: number;
}

export interface DailyCashflow {
  date: Date;
  dateStr: string;
  inflows: number;
  outflows: number;
  netFlow: number;
  balance: number;
  inflowDetails: { source: string; amount: number }[];
  outflowDetails: { source: string; amount: number }[];
}

export interface ScenarioModifiers {
  globalDelayDays: number;
  revenueChangePercent: number;
  salaryChangePercent: number;
  invoiceOnDay15: boolean;
}

export interface LiquidityKPIs {
  minBalance: number;
  minBalanceDate: Date | null;
  requiredBuffer: number;
  negativeDays: number;
  longestNegativePeriod: number;
  avgBalance: number;
  peakLiquidityNeedByMonth: { month: string; need: number }[];
}

/**
 * Beregner forventet indbetalingsdato for en faktura
 * @param invoiceDate Fakturadato
 * @param paymentTerms Betalingsfrist i dage
 * @param delay Evt. forsinkelse i dage
 */
function calculatePaymentDate(
  invoiceDate: Date,
  paymentTerms: number,
  delay: number = 0
): Date {
  return addDays(invoiceDate, paymentTerms + delay);
}

/**
 * Finder fakturadato baseret på invoice_day
 * @param year År
 * @param month Måned (0-indexed)
 * @param invoiceDay 0 = sidste dag i måneden, 1-28 = specifik dag
 */
function getInvoiceDate(year: number, month: number, invoiceDay: number): Date {
  if (invoiceDay === 0) {
    // Sidste dag i måneden
    return new Date(year, month + 1, 0);
  }
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const day = Math.min(invoiceDay, daysInMonth);
  return new Date(year, month, day);
}

export function useLiquidityCalculator(
  customers: LiquidityCustomer[],
  expenses: LiquidityExpense[],
  settings: LiquiditySettings,
  scenarioModifiers: ScenarioModifiers = {
    globalDelayDays: 0,
    revenueChangePercent: 0,
    salaryChangePercent: 0,
    invoiceOnDay15: false,
  }
) {
  // Beregn daglig cashflow for hele prognoseperioden
  const dailyCashflow = useMemo<DailyCashflow[]>(() => {
    const startDate = settings.startingDate;
    const endDate = addMonths(startDate, settings.forecastMonths);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    let runningBalance = settings.startingBalance;
    const result: DailyCashflow[] = [];

    // Pre-beregn alle indbetalinger fra kunder
    const customerPayments = new Map<string, { source: string; amount: number }[]>();
    
    const activeCustomers = customers.filter(c => c.is_active);
    activeCustomers.forEach(customer => {
      // For hver måned i prognoseperioden
      for (let m = 0; m < settings.forecastMonths; m++) {
        const monthDate = addMonths(startDate, m);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        
        // Fakturadato - brug dag 15 hvis scenariet er aktivt
        const invoiceDay = scenarioModifiers.invoiceOnDay15 ? 15 : customer.invoice_day;
        const invoiceDate = getInvoiceDate(year, month, invoiceDay);
        
        // Beregn forsinkelse
        const delay = customer.pays_on_time 
          ? 0 
          : customer.average_delay_days + scenarioModifiers.globalDelayDays;
        
        // Forventet betalingsdato
        const paymentDate = calculatePaymentDate(
          invoiceDate,
          customer.payment_terms_days,
          delay + (customer.pays_on_time ? scenarioModifiers.globalDelayDays : 0)
        );
        
        // Beløb med evt. omsætningsændring
        const amount = customer.monthly_invoice_amount * (1 + scenarioModifiers.revenueChangePercent / 100);
        
        const dateKey = format(paymentDate, 'yyyy-MM-dd');
        if (!customerPayments.has(dateKey)) {
          customerPayments.set(dateKey, []);
        }
        customerPayments.get(dateKey)!.push({
          source: customer.name,
          amount: amount,
        });
      }
    });

    // Pre-beregn alle udgifter
    const expensePayments = new Map<string, { source: string; amount: number }[]>();
    const activeExpenses = expenses.filter(e => e.is_active);
    
    activeExpenses.forEach(expense => {
      if (expense.recurrence === 'one_time' && expense.one_time_date) {
        const dateKey = expense.one_time_date;
        if (!expensePayments.has(dateKey)) {
          expensePayments.set(dateKey, []);
        }
        expensePayments.get(dateKey)!.push({
          source: expense.name,
          amount: expense.amount,
        });
      } else if (expense.recurrence === 'monthly') {
        for (let m = 0; m < settings.forecastMonths; m++) {
          const monthDate = addMonths(startDate, m);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth();
          const daysInMonth = getDaysInMonth(monthDate);
          const day = Math.min(expense.payment_day, daysInMonth);
          const paymentDate = new Date(year, month, day);
          
          if (paymentDate >= startDate && paymentDate <= endDate) {
            const dateKey = format(paymentDate, 'yyyy-MM-dd');
            if (!expensePayments.has(dateKey)) {
              expensePayments.set(dateKey, []);
            }
            expensePayments.get(dateKey)!.push({
              source: expense.name,
              amount: expense.amount,
            });
          }
        }
      } else if (expense.recurrence === 'weekly') {
        // Ugentlig udgift
        let currentDate = startDate;
        while (currentDate <= endDate) {
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          if (!expensePayments.has(dateKey)) {
            expensePayments.set(dateKey, []);
          }
          expensePayments.get(dateKey)!.push({
            source: expense.name,
            amount: expense.amount,
          });
          currentDate = addDays(currentDate, 7);
        }
      }
    });

    // Tilføj løn + feriepenge (d. 15 hver måned, for periode 15-14)
    const monthlySalary = settings.totalMonthlySalary * (1 + scenarioModifiers.salaryChangePercent / 100);
    const vacationPay = monthlySalary * (settings.vacationPayPercent / 100);
    const totalSalaryPayout = monthlySalary + vacationPay;

    for (let m = 0; m < settings.forecastMonths; m++) {
      const monthDate = addMonths(startDate, m);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const salaryDate = new Date(year, month, settings.salaryPaymentDay);
      
      if (salaryDate >= startDate && salaryDate <= endDate) {
        const dateKey = format(salaryDate, 'yyyy-MM-dd');
        if (!expensePayments.has(dateKey)) {
          expensePayments.set(dateKey, []);
        }
        expensePayments.get(dateKey)!.push({
          source: `Løn (${format(salaryDate, 'MMM', { locale: da })})`,
          amount: monthlySalary,
        });
        expensePayments.get(dateKey)!.push({
          source: `Feriepenge (${settings.vacationPayPercent}%)`,
          amount: vacationPay,
        });
      }
    }

    // Tilføj moms (beregnes som udgående - indgående)
    for (let m = 1; m <= settings.forecastMonths; m++) {
      const monthDate = addMonths(startDate, m);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const vatDate = new Date(year, month, settings.vatPaymentDay);
      
      if (vatDate >= startDate && vatDate <= endDate) {
        // Beregn moms for forrige måned
        const prevMonthStart = startOfMonth(addMonths(vatDate, -1));
        const prevMonthEnd = endOfMonth(addMonths(vatDate, -1));
        
        // Udgående moms fra fakturaer
        let outgoingVat = 0;
        activeCustomers.forEach(customer => {
          const amount = customer.monthly_invoice_amount * (1 + scenarioModifiers.revenueChangePercent / 100);
          outgoingVat += amount * (settings.vatRate / (100 + settings.vatRate));
        });
        
        // Indgående moms fra momsbelagte udgifter
        let incomingVat = 0;
        activeExpenses.forEach(expense => {
          if (expense.is_vat_deductible && expense.recurrence === 'monthly') {
            incomingVat += expense.amount * (settings.vatRate / (100 + settings.vatRate));
          }
        });
        
        const netVat = outgoingVat - incomingVat;
        
        if (netVat > 0) {
          const dateKey = format(vatDate, 'yyyy-MM-dd');
          if (!expensePayments.has(dateKey)) {
            expensePayments.set(dateKey, []);
          }
          expensePayments.get(dateKey)!.push({
            source: `Moms (${format(addMonths(vatDate, -1), 'MMM', { locale: da })})`,
            amount: netVat,
          });
        }
      }
    }

    // Byg daglig cashflow
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const inflowDetails = customerPayments.get(dateKey) || [];
      const outflowDetails = expensePayments.get(dateKey) || [];
      
      const inflows = inflowDetails.reduce((sum, i) => sum + i.amount, 0);
      const outflows = outflowDetails.reduce((sum, o) => sum + o.amount, 0);
      const netFlow = inflows - outflows;
      runningBalance += netFlow;

      result.push({
        date: day,
        dateStr: format(day, 'yyyy-MM-dd'),
        inflows,
        outflows,
        netFlow,
        balance: runningBalance,
        inflowDetails,
        outflowDetails,
      });
    });

    return result;
  }, [customers, expenses, settings, scenarioModifiers]);

  // Beregn KPI'er
  const kpis = useMemo<LiquidityKPIs>(() => {
    if (dailyCashflow.length === 0) {
      return {
        minBalance: 0,
        minBalanceDate: null,
        requiredBuffer: 0,
        negativeDays: 0,
        longestNegativePeriod: 0,
        avgBalance: 0,
        peakLiquidityNeedByMonth: [],
      };
    }

    let minBalance = Infinity;
    let minBalanceDate: Date | null = null;
    let negativeDays = 0;
    let currentNegativeStreak = 0;
    let longestNegativePeriod = 0;
    let totalBalance = 0;

    // Peak likviditetsbehov pr. måned
    const monthlyMinBalances = new Map<string, number>();

    dailyCashflow.forEach(day => {
      totalBalance += day.balance;
      
      if (day.balance < minBalance) {
        minBalance = day.balance;
        minBalanceDate = day.date;
      }

      if (day.balance < 0) {
        negativeDays++;
        currentNegativeStreak++;
        longestNegativePeriod = Math.max(longestNegativePeriod, currentNegativeStreak);
      } else {
        currentNegativeStreak = 0;
      }

      // Track månedlig min
      const monthKey = format(day.date, 'yyyy-MM');
      const currentMonthMin = monthlyMinBalances.get(monthKey) ?? Infinity;
      if (day.balance < currentMonthMin) {
        monthlyMinBalances.set(monthKey, day.balance);
      }
    });

    const avgBalance = totalBalance / dailyCashflow.length;
    const requiredBuffer = minBalance < 0 ? Math.abs(minBalance) + 50000 : 0; // +50k buffer

    const peakLiquidityNeedByMonth: { month: string; need: number }[] = [];
    monthlyMinBalances.forEach((min, monthKey) => {
      const date = new Date(monthKey + '-01');
      peakLiquidityNeedByMonth.push({
        month: format(date, 'MMM yyyy', { locale: da }),
        need: min < 0 ? Math.abs(min) : 0,
      });
    });

    return {
      minBalance: minBalance === Infinity ? 0 : minBalance,
      minBalanceDate,
      requiredBuffer,
      negativeDays,
      longestNegativePeriod,
      avgBalance,
      peakLiquidityNeedByMonth,
    };
  }, [dailyCashflow]);

  // Aggreger til ugentlig/månedlig view
  const weeklyCashflow = useMemo(() => {
    const weeks: { weekStart: Date; weekLabel: string; inflows: number; outflows: number; endBalance: number }[] = [];
    let currentWeekStart: Date | null = null;
    let weekInflows = 0;
    let weekOutflows = 0;
    let lastBalance = settings.startingBalance;

    dailyCashflow.forEach((day, index) => {
      const dayOfWeek = day.date.getDay();
      
      if (dayOfWeek === 1 || index === 0) {
        if (currentWeekStart !== null) {
          weeks.push({
            weekStart: currentWeekStart,
            weekLabel: `Uge ${format(currentWeekStart, 'w', { locale: da })}`,
            inflows: weekInflows,
            outflows: weekOutflows,
            endBalance: lastBalance,
          });
        }
        currentWeekStart = day.date;
        weekInflows = 0;
        weekOutflows = 0;
      }

      weekInflows += day.inflows;
      weekOutflows += day.outflows;
      lastBalance = day.balance;
    });

    // Tilføj sidste uge
    if (currentWeekStart !== null) {
      weeks.push({
        weekStart: currentWeekStart,
        weekLabel: `Uge ${format(currentWeekStart, 'w', { locale: da })}`,
        inflows: weekInflows,
        outflows: weekOutflows,
        endBalance: lastBalance,
      });
    }

    return weeks;
  }, [dailyCashflow, settings.startingBalance]);

  const monthlyCashflow = useMemo(() => {
    const months: { month: string; inflows: number; outflows: number; endBalance: number }[] = [];
    const monthMap = new Map<string, { inflows: number; outflows: number; endBalance: number }>();

    dailyCashflow.forEach(day => {
      const monthKey = format(day.date, 'yyyy-MM');
      const existing = monthMap.get(monthKey) || { inflows: 0, outflows: 0, endBalance: 0 };
      existing.inflows += day.inflows;
      existing.outflows += day.outflows;
      existing.endBalance = day.balance;
      monthMap.set(monthKey, existing);
    });

    monthMap.forEach((data, monthKey) => {
      const date = new Date(monthKey + '-01');
      months.push({
        month: format(date, 'MMM yyyy', { locale: da }),
        ...data,
      });
    });

    return months;
  }, [dailyCashflow]);

  return {
    dailyCashflow,
    weeklyCashflow,
    monthlyCashflow,
    kpis,
  };
}
