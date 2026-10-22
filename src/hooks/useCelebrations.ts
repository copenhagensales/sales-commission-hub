/**
 * Fødselsdage og jubilæer de næste 14 dage. Flyttet uændret fra forsiden (samme query-key og regler),
 * så forsiden og Pulsen viser samme fejringer og deler reaktioner via samme target_key.
 */
import { useQuery } from "@tanstack/react-query";
import { addDays, differenceInYears, isAfter, isBefore, isSameDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Celebration } from "@/components/home/CelebrationStrip";

export function useCelebrations() {
  return useQuery({
    queryKey: ["home-celebrations"],
    queryFn: async (): Promise<Celebration[]> => {
      const today = new Date();
      // Aktive kolleger med fødselsdato fra databasen (ingen CPR i browseren).
      const { data: employees } = await supabase.rpc("stork_foedselsdage");

      const results: Celebration[] = [];

      const parseBirthday = (iso: string): Date | null => {
        const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
        if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
        return new Date(y, m - 1, d);
      };

      employees?.forEach(emp => {
        if (emp.foedselsdato) {
          const birthDate = parseBirthday(emp.foedselsdato);
          if (birthDate) {
            const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            const age = differenceInYears(today, birthDate);

            if ((isSameDay(birthdayThisYear, today) || isAfter(birthdayThisYear, today)) &&
                isBefore(birthdayThisYear, addDays(today, 14))) {
              results.push({
                employeeId: emp.id,
                type: 'birthday',
                name: `${emp.first_name} ${emp.last_name}`,
                years: age + (isAfter(birthdayThisYear, today) ? 1 : 0),
                date: birthdayThisYear,
                isToday: isSameDay(birthdayThisYear, today)
              });
            }
          }
        }

        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
          const years = differenceInYears(today, startDate);
          // Only show full-year anniversaries (skip ½-year)
          if (years >= 1) {
            const anniversaryThisYear = new Date(today.getFullYear(), startDate.getMonth(), startDate.getDate());
            const anniversaryYears = years + (isAfter(anniversaryThisYear, today) ? 1 : 0);

            if ((isSameDay(anniversaryThisYear, today) || isAfter(anniversaryThisYear, today)) &&
                isBefore(anniversaryThisYear, addDays(today, 14))) {
              results.push({
                employeeId: emp.id,
                type: 'anniversary',
                name: `${emp.first_name} ${emp.last_name}`,
                years: anniversaryYears,
                date: anniversaryThisYear,
                isToday: isSameDay(anniversaryThisYear, today)
              });
            }
          }
        }
      });

      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    staleTime: 300000,
  });
}
