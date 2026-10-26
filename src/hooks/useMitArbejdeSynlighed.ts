import { usePermissions } from "@/hooks/usePositionPermissions";
import { useCanWorkFieldmarketing, useIsFieldmarketingEmployee } from "@/hooks/useFieldmarketingEmployee";
import { useIsSalgskonsulent } from "@/hooks/useCodeOfConduct";
import { useHasImmediatePaymentSales } from "@/hooks/useHasImmediatePaymentSales";
import { useIsUnitedMember } from "@/hooks/useIsUnitedMember";

/**
 * Fanesynlighed for samlesiderne i »Mit arbejde«. Hver fane følger præcis sin gamle rutes regel
 * (role → p.canView(nøgle), protected → alle indloggede) + TM/FM-reglen fra BottomNav/AppSidebar.
 * Ingen nye nøgler; læser kun eksisterende flag.
 */
export function useMitArbejdeSynlighed() {
  const p = usePermissions();
  const { data: canWorkFieldmarketing } = useCanWorkFieldmarketing();
  // Samme betingelser som de tidligere menupunkter i AppSidebar (hvem ser hvad må ikke blive bredere).
  const { data: isUnitedMember } = useIsUnitedMember();
  const { data: hasImmediatePaymentSales } = useHasImmediatePaymentSales();
  const { data: isSalgskonsulent } = useIsSalgskonsulent();
  const { data: isFieldmarketing } = useIsFieldmarketingEmployee();

  // Sektionsnøglerne fra det gamle menupunkt (c2): ingen ser mere end før.
  const fmVagt = !!p.canViewFmMySchedule && p.canView("menu_section_fieldmarketing");
  const fmSalg = !!p.canViewFmSalesRegistration || !!canWorkFieldmarketing;

  const vagter = {
    vagtplanFm: fmVagt,
    // TM-vagtplan (protected): alle, der ikke er FM – og FM-brugere, der også har TM-vagtplanen.
    vagtplanTm: (!fmVagt || !!p.canViewMySchedule) && p.canView("tab_vagter_min_vagtplan"),
    stempelur: p.canView("menu_time_stamp") && p.canView("menu_section_vagtplan"),
  };
  const salg = {
    salg: !!isUnitedMember && p.canView("tab_registrer_salg_salg"),
    straksbetaling: !!hasImmediatePaymentSales && p.canView("tab_registrer_salg_straksbetaling"),
    fm: fmSalg,
  };
  const spil = {
    superligaen: p.canView("menu_commission_league"),
    head2head: p.canView("menu_h2h"),
  };
  const profil = {
    fordele: p.canView("menu_employee_perks"),
    feedback: p.canView("menu_my_feedback"),
    kodeks: (!!isSalgskonsulent && p.canView("tab_min_profil_kodeks")) || (!!isFieldmarketing && p.canView("tab_min_profil_firmabil")),
    kodeksCoc: !!isSalgskonsulent && p.canView("tab_min_profil_kodeks"),
    kodeksCar: !!isFieldmarketing && p.canView("tab_min_profil_firmabil"),
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
