/**
 * Oversætter databasens afvisninger ved gemning af et medarbejderkort til
 * forståelige beskeder. Selve reglerne ligger i databasen
 * (trigger `prevent_duplicate_employee` + de partielle unikke indekser).
 */
interface DbErrorLike {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

export interface EmployeeSaveError {
  message: string;
  /** Id på det kort, mailen allerede sidder på (fra triggerens hint). */
  existingEmployeeId: string | null;
}

export function describeEmployeeSaveError(error: unknown): EmployeeSaveError {
  const e = (error ?? {}) as DbErrorLike;
  const raw = `${e.message ?? ""} ${e.details ?? ""}`;
  const hintMatch = /^duplicate_(?:work|private)_email:([0-9a-f-]{36})$/i.exec(e.hint ?? "");

  if (hintMatch) {
    return { message: e.message ?? "Arbejdsmailen findes allerede.", existingEmployeeId: hintMatch[1] };
  }
  if (e.code === "23505" && raw.includes("employee_master_data_active_work_email_uniq")) {
    return {
      message: "Arbejdsmailen bruges allerede af et andet aktivt medarbejderkort. Én arbejdsmail må kun sidde på ét aktivt kort.",
      existingEmployeeId: null,
    };
  }
  if (e.code === "23505" && raw.includes("employee_master_data_active_auth_user_uniq")) {
    return {
      message: "Login-kontoen er allerede knyttet til et andet aktivt medarbejderkort. Ét login må kun høre til ét aktivt kort.",
      existingEmployeeId: null,
    };
  }
  return { message: e.message ?? "Ukendt fejl", existingEmployeeId: null };
}
