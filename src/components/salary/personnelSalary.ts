import {
  COMPENSATION_MODEL_LABELS,
  resolveCompensation,
  type CompensationModel,
} from "@/lib/calculations/dbModel";
import { formatCurrency } from "@/lib/calculations/formatting";

/**
 * Fælles type og select for `personnel_salaries`, så alle lønfaner læser de
 * SAMME felter — inkl. den eksplicitte lønmodel (`compensation_model`).
 * Tidligere gættede beregningerne på beløbets størrelse; det gør de ikke mere.
 */
export interface PersonnelSalaryRow {
  id: string;
  employee_id: string;
  salary_type: string;
  compensation_model: string | null;
  monthly_salary: number;
  hourly_rate: number | null;
  percentage_rate: number | null;
  minimum_salary: number | null;
  start_date: string | null;
  is_active: boolean;
  notes: string | null;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string | null;
    salary_type: "provision" | "fixed" | "hourly" | null;
  } | null;
}

export const PERSONNEL_SALARY_SELECT = `
  id,
  employee_id,
  salary_type,
  compensation_model,
  monthly_salary,
  hourly_rate,
  percentage_rate,
  minimum_salary,
  start_date,
  is_active,
  notes,
  employee:employee_master_data(first_name, last_name, job_title, salary_type)
`;

/** Standardmodel for en lønrække ud fra dens type */
export function defaultCompensationModel(
  salaryType: "team_leader" | "assistant" | "staff" | string
): CompensationModel {
  return salaryType === "team_leader" ? "percentage" : "monthly_fixed";
}

export function compensationModelLabel(model: string | null | undefined): string {
  if (model === "monthly_fixed" || model === "hourly" || model === "percentage") {
    return COMPENSATION_MODEL_LABELS[model];
  }
  return "Ikke angivet";
}

/** Det beløb der faktisk bruges i beregningen for rækkens lønmodel */
export function formatPersonnelAmount(row: PersonnelSalaryRow): string {
  const resolved = resolveCompensation(row);
  if (!resolved.hasBasis) return "mangler grundlag";
  switch (resolved.model) {
    case "hourly":
      return `${formatCurrency(resolved.hourlyRate)}/time`;
    case "percentage":
      return resolved.minimumSalary > 0
        ? `${resolved.percentageRate} % (min. ${formatCurrency(resolved.minimumSalary)})`
        : `${resolved.percentageRate} %`;
    case "monthly_fixed":
    default:
      return `${formatCurrency(resolved.monthlySalary)}/md.`;
  }
}

/** Label til beløbsfeltet i lønformularerne */
export function amountFieldLabel(model: CompensationModel): string {
  return model === "hourly" ? "Timesats (kr./time)" : "Månedsløn (kr.)";
}

export function compensationModelHelp(model: CompensationModel): string {
  switch (model) {
    case "hourly":
      return "Lønnen beregnes som timesats × registrerede timer i perioden.";
    case "percentage":
      return "Lønnen beregnes som procent af teamets DB før lederløn, med minimumslønnen som gulv (prorateret efter arbejdsdage).";
    case "monthly_fixed":
    default:
      return "Fast månedsløn, prorateret efter arbejdsdage når perioden ikke er en hel måned.";
  }
}
