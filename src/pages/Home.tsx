import { useMemo } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { usePrecomputedKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useActiveSeason, useMyEnrollment } from "@/hooks/useLeagueData";
import { usePersonalWeeklyStats } from "@/hooks/usePersonalWeeklyStats";
import { getPayrollPeriod, getVacationPayRate } from "@/lib/calculations";

import { HeroPerformanceCard } from "@/components/home/HeroPerformanceCard";
import { CompactLeagueView } from "@/components/home/CompactLeagueView";
import { DailyCommissionChart } from "@/components/home/DailyCommissionChart";
import { StickyPerformanceBar } from "@/components/home/StickyPerformanceBar";
import { UpcomingEventsCard } from "@/components/home/UpcomingEventsCard";
import { CelebrationsCard } from "@/components/home/CelebrationsCard";
import { EventInvitationPopup } from "@/components/home/EventInvitationPopup";

const Home = () => {
  const { user } = useAuth();
  const { isPreviewMode, previewEmployee } = useRolePreview();
  const { isOwner } = usePermissions();

  // Current employee
  const { data: employee } = useQuery({
    queryKey: ["home-employee", isPreviewMode, previewEmployee?.id, user?.email],
    queryFn: async () => {
      if (isPreviewMode && previewEmployee?.id) {
        const { data } = await supabase
          .from("employee_master_data")
          .select(
            "id, first_name, last_name, job_title, team_id, employment_start_date, vacation_type"
          )
          .eq("id", previewEmployee.id)
          .maybeSingle();
        return data;
      }

      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select(
          "id, first_name, last_name, job_title, team_id, employment_start_date, vacation_type"
        )
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!(user?.email || (isPreviewMode && previewEmployee?.id)),
    staleTime: 60000,
  });

  // League enrollment (for hero CTA)
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolledInLeague = !!enrollment;

  // Payroll period (15th–14th)
  const payrollPeriod = useMemo(() => getPayrollPeriod(), []);
  const periodLabel = useMemo(
    () =>
      `${format(payrollPeriod.start, "d. MMM", { locale: da })} – ${format(
        payrollPeriod.end,
        "d. MMM",
        { locale: da }
      )}`,
    [payrollPeriod]
  );

  // Cached personal KPIs for the payroll period
  const { data: cachedPersonalPayroll } = usePrecomputedKpis(
    ["sales_count", "total_commission"],
    "payroll_period",
    "employee",
    employee?.id
  );

  const periodCommission = employee?.id
    ? getKpiValue(cachedPersonalPayroll?.total_commission)
    : 0;

  // Personal goal for the period
  const { data: personalGoal } = useQuery({
    queryKey: ["home-personal-goal", employee?.id, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data } = await supabase
        .from("employee_sales_goals")
        .select("target_amount")
        .eq("employee_id", employee.id)
        .eq("period_start", format(payrollPeriod.start, "yyyy-MM-dd"))
        .eq("period_end", format(payrollPeriod.end, "yyyy-MM-dd"))
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id,
    staleTime: 60000,
  });

  const hasGoal = !!personalGoal?.target_amount;
  const targetAmount = personalGoal?.target_amount || 0;
  const progressPercent =
    targetAmount > 0 ? Math.round((periodCommission / targetAmount) * 100) : 0;

  // Vacation pay via central calculations library
  const vacationPayRate = useMemo(
    () => getVacationPayRate(employee?.vacation_type || null),
    [employee?.vacation_type]
  );
  const vacationPay = periodCommission * vacationPayRate;

  // Remaining days + daily pace needed
  const { remainingDays, dailyNeeded } = useMemo(() => {
    const today = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.max(
      0,
      Math.ceil((payrollPeriod.end.getTime() - today.getTime()) / msPerDay)
    );
    const remainingAmount = Math.max(0, targetAmount - periodCommission);
    return {
      remainingDays: days,
      dailyNeeded: days > 0 ? remainingAmount / days : remainingAmount,
    };
  }, [payrollPeriod.end, targetAmount, periodCommission]);

  const { data: personalWeeklyStats } = usePersonalWeeklyStats(employee?.id);

  const firstName = employee?.first_name || "kollega";

  return (
    <MainLayout>
      <EventInvitationPopup employeeId={employee?.id} teamId={employee?.team_id} />

      <StickyPerformanceBar
        progressPercent={progressPercent}
        hasGoal={hasGoal}
        periodCommission={periodCommission}
      />

      <div className="min-h-screen bg-background p-3 md:p-8">
        <div className="mx-auto max-w-6xl space-y-3 md:space-y-4">
          {/* Zone 1: performance hero */}
          <HeroPerformanceCard
            firstName={firstName}
            periodCommission={periodCommission}
            targetAmount={targetAmount}
            progressPercent={progressPercent}
            hasGoal={hasGoal}
            vacationPay={vacationPay}
            isEnrolledInLeague={isEnrolledInLeague}
            periodLabel={periodLabel}
            dailyNeeded={dailyNeeded}
            remainingDays={remainingDays}
          />

          {/* Zone 2: competition + own trend */}
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            <CompactLeagueView />
            <DailyCommissionChart dailyData={personalWeeklyStats?.dailyBreakdown || []} />
          </div>

          {/* Zone 3: social */}
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            <UpcomingEventsCard
              employeeId={employee?.id}
              isOwner={isOwner}
              userId={user?.id}
            />
            <CelebrationsCard />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
