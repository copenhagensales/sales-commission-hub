import { UserPlus, CalendarDays, HeartPulse, Palmtree } from "lucide-react";

interface QuickStatsBarProps {
  applicants24h: number;
  upcomingStarters: number;
  sickToday: number;
  vacationToday: number;
  totalEmployees: number;
}

export function QuickStatsBar({
  applicants24h,
  upcomingStarters,
  sickToday,
  vacationToday,
  totalEmployees,
}: QuickStatsBarProps) {
  const stats = [
    {
      icon: UserPlus,
      value: applicants24h,
      label: "nye ansøgere (24t)",
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      icon: CalendarDays,
      value: upcomingStarters,
      label: "kommende opstarter",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: HeartPulse,
      value: sickToday,
      label: "syge i dag",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      percentage: totalEmployees > 0 ? Math.round((sickToday / totalEmployees) * 100) : 0,
    },
    {
      icon: Palmtree,
      value: vacationToday,
      label: "på ferie",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      percentage: totalEmployees > 0 ? Math.round((vacationToday / totalEmployees) * 100) : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${stat.bgColor}`}
        >
          <stat.icon className={`h-5 w-5 ${stat.color} shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
              {stat.percentage !== undefined && stat.percentage > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({stat.percentage}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
