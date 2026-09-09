import { supabase } from "@/integrations/supabase/client";

export interface ExistingEmployeeMatch {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  private_email: string | null;
  is_active: boolean;
  employment_start_date: string | null;
  matchedOn: "work_email" | "private_email";
}

/**
 * Single source of truth for "findes denne medarbejder allerede?" ved oprettelse.
 *
 * Slår op case-insensitivt på både arbejdsmail og privat e-mail — også på
 * INAKTIVE medarbejdere, så en returnerende medarbejder genaktiveres i stedet
 * for at få oprettet en dublet. Databasen håndhæver samme regel
 * (trigger `trg_prevent_duplicate_employee`); denne funktion giver blot
 * brugeren en forståelig besked først.
 */
export async function findExistingEmployeeByEmail(
  workEmail?: string | null,
  privateEmail?: string | null
): Promise<ExistingEmployeeMatch | null> {
  const columns =
    "id, first_name, last_name, work_email, private_email, is_active, employment_start_date";

  const lookups: Array<{ column: "work_email" | "private_email"; value: string }> = [];
  const work = workEmail?.trim();
  const priv = privateEmail?.trim();
  if (work) lookups.push({ column: "work_email", value: work });
  if (priv) lookups.push({ column: "private_email", value: priv });

  for (const { column, value } of lookups) {
    const { data, error } = await supabase
      .from("employee_master_data")
      .select(columns)
      .ilike(column, value)
      .order("is_active", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Kunne ikke slå eksisterende medarbejder op:", error);
      continue;
    }

    const row = data?.[0];
    if (row) return { ...row, matchedOn: column };
  }

  return null;
}
