import { useQuery } from "@tanstack/react-query";
import { Cake, Award, PartyPopper } from "lucide-react";
import {
  addDays,
  differenceInYears,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
} from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { HomeCard, HomeCardEmpty } from "@/components/home/HomeCard";
import { cn } from "@/lib/utils";

interface Celebration {
  type: "birthday" | "anniversary";
  name: string;
  years?: number;
  date: Date;
  isToday: boolean;
}

function parseCprBirthday(cpr: string, today: Date): Date | null {
  if (!cpr || cpr.length < 6) return null;
  const day = parseInt(cpr.substring(0, 2), 10);
  const month = parseInt(cpr.substring(2, 4), 10) - 1;
  let year = parseInt(cpr.substring(4, 6), 10);
  const currentYearShort = today.getFullYear() % 100;
  year = year > currentYearShort ? 1900 + year : 2000 + year;
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

function useCelebrations() {
  return useQuery({
    queryKey: ["home-celebrations"],
    queryFn: async () => {
      const today = new Date();
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, employment_start_date, cpr_number")
        .eq("is_active", true);

      const results: Celebration[] = [];
      const withinWindow = (date: Date) =>
        (isSameDay(date, today) || isAfter(date, today)) && isBefore(date, addDays(today, 14));

      employees?.forEach((emp) => {
        if (emp.cpr_number) {
          const birthDate = parseCprBirthday(emp.cpr_number, today);
          if (birthDate) {
            const birthdayThisYear = new Date(
              today.getFullYear(),
              birthDate.getMonth(),
              birthDate.getDate()
            );
            const age = differenceInYears(today, birthDate);
            if (withinWindow(birthdayThisYear)) {
              results.push({
                type: "birthday",
                name: `${emp.first_name} ${emp.last_name}`,
                years: age + (isAfter(birthdayThisYear, today) ? 1 : 0),
                date: birthdayThisYear,
                isToday: isSameDay(birthdayThisYear, today),
              });
            }
          }
        }

        if (emp.employment_start_date) {
          const startDate = parseISO(emp.employment_start_date);
          const years = differenceInYears(today, startDate);
          if (years >= 1) {
            const anniversaryThisYear = new Date(
              today.getFullYear(),
              startDate.getMonth(),
              startDate.getDate()
            );
            if (withinWindow(anniversaryThisYear)) {
              results.push({
                type: "anniversary",
                name: `${emp.first_name} ${emp.last_name}`,
                years: years + (isAfter(anniversaryThisYear, today) ? 1 : 0),
                date: anniversaryThisYear,
                isToday: isSameDay(anniversaryThisYear, today),
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

function CelebrationRow({ celebration }: { celebration: Celebration }) {
  const Icon = celebration.type === "birthday" ? Cake : Award;
  const isBirthday = celebration.type === "birthday";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
        celebration.isToday
          ? "border-primary/30 bg-primary/10"
          : "border-border/50 bg-background/30"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            celebration.isToday ? "text-primary" : isBirthday ? "text-primary/70" : "text-warning"
          )}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{celebration.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isBirthday
              ? celebration.isToday
                ? `Fylder ${celebration.years} år i dag`
                : `Fylder ${celebration.years} år`
              : `${celebration.years} års jubilæum`}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          celebration.isToday ? "font-semibold text-primary" : "text-muted-foreground"
        )}
      >
        {celebration.isToday ? "I dag" : format(celebration.date, "d. MMM", { locale: da })}
      </span>
    </div>
  );
}

export function CelebrationsCard() {
  const { data: celebrations = [] } = useCelebrations();

  const today = celebrations.filter((c) => c.isToday);
  const upcoming = celebrations.filter((c) => !c.isToday);

  return (
    <HomeCard
      icon={PartyPopper}
      title="Fødselsdage & jubilæer"
      titleShort="Mærkedage"
      action={
        celebrations.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {celebrations.length} i de næste 14 dage
          </span>
        ) : undefined
      }
      contentClassName="p-3 md:p-4"
    >
      {celebrations.length === 0 ? (
        <HomeCardEmpty
          icon={PartyPopper}
          title="Ingen mærkedage de næste 14 dage"
          hint="Fødselsdage og jubilæer vises automatisk her"
        />
      ) : (
        <div className="space-y-1.5">
          {today.map((celebration, index) => (
            <CelebrationRow key={`today-${index}`} celebration={celebration} />
          ))}
          {upcoming.slice(0, 6).map((celebration, index) => (
            <CelebrationRow key={`upcoming-${index}`} celebration={celebration} />
          ))}
          {upcoming.length > 6 && (
            <p className="pt-1 text-xs text-muted-foreground">
              +{upcoming.length - 6} flere i de næste 14 dage
            </p>
          )}
        </div>
      )}
    </HomeCard>
  );
}
