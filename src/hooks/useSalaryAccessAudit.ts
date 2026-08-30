import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Undgår at logge samme opslag igen ved re-render/navigation i samme session. */
const alreadyLogged = new Set<string>();

/**
 * Logger opslag i løndata i `sensitive_data_access_log`.
 *
 * Bruges hvor løntal for flere medarbejdere vises samtidigt (lønoversigterne).
 * Individuelle opslag (medarbejderens stamkort) logges direkte med
 * `log_salary_access`.
 */
export function useSalaryAccessAudit(
  employeeIds: (string | null | undefined)[],
  field: string,
  accessType: "view" | "edit" = "view"
) {
  const ids = Array.from(new Set(employeeIds.filter((id): id is string => Boolean(id))));
  const key = `${field}:${accessType}:${ids.slice().sort().join(",")}`;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    if (lastKey.current === key || alreadyLogged.has(key)) return;
    lastKey.current = key;
    alreadyLogged.add(key);

    void supabase
      .rpc("log_salary_access_bulk", {
        p_employee_ids: ids,
        p_field: field,
        p_access_type: accessType,
      })
      .then(({ error }) => {
        if (error) {
          // Logning må aldrig blokere visningen
          console.warn("Kunne ikke logge lønopslag:", error.message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
