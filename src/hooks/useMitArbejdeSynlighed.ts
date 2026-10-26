import { usePermissions } from "@/hooks/usePositionPermissions";
import { useCanWorkFieldmarketing } from "@/hooks/useFieldmarketingEmployee";

/**
 * Fanesynlighed for samlesiderne i »Mit arbejde«. Hver fane følger præcis sin gamle rutes regel
 * (role → p.canView(nøgle), protected → alle indloggede) + TM/FM-reglen fra BottomNav/AppSidebar.
 * Ingen nye nøgler; læser kun eksisterende flag.
 */
export function useMitArbejdeSynlighed() {
  const p = usePermissions();
  const { data: canWorkFieldmarketing } = useCanWorkFieldmarketing();

  const fmVagt = !!p.canViewFmMySchedule;
  const fmSalg = !!p.canViewFmSalesRegistration || !!canWorkFieldmarketing;

  const vagter = {
    vagtplanFm: fmVagt,
    // TM-vagtplan (protected): alle, der ikke er FM – og FM-brugere, der også har TM-vagtplanen.
    vagtplanTm: !fmVagt || !!p.canViewMySchedule,
    stempelur: p.canView("menu_time_stamp"),
  };
  const salg = {
    salg: !fmSalg,
    straksbetaling: !fmSalg,
    fm: fmSalg,
  };
  const spil = {
    superligaen: p.canView("menu_commission_league"),
    head2head: p.canView("menu_h2h"),
  };
  const profil = {
    fordele: p.canView("menu_employee_perks"),
    feedback: p.canView("menu_my_feedback"),
    kodeks: true,
    anbefal: p.canView("menu_refer_a_friend"),
  };

  return {
    vagter,
    salg,
    spil,
    profil,
    harVagter: Object.values(vagter).some(Boolean),
    harSalg: Object.values(salg).some(Boolean),
    harSpil: Object.values(spil).some(Boolean),
  };
}
