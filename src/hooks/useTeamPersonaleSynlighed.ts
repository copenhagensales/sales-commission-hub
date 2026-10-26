import { usePermissions } from "@/hooks/usePositionPermissions";
import { useCanViewRampTeam } from "@/hooks/useRampTeam";
import { useQualityAccess } from "@/hooks/useQualityControl";

/**
 * Fanesynlighed for samlesiderne i »Mit team« og »Rekruttering og personale« (bundt b2).
 * role-ruter → p.canView(rutens nøgle). De »protected« sider, der selv håndhæver adgang
 * (kvalitetskontrol, opstartshold), følger samme betingelse som deres tidligere menupunkt,
 * så ingen ser mere end før. Ingen nye nøgler.
 */
export function useTeamPersonaleSynlighed() {
  const p = usePermissions();
  const { data: canViewRampTeam } = useCanViewRampTeam();
  const { hasAccess: hasQualityAccess } = useQualityAccess();
  const v = (k: string) => p.canView(k);

  const vagtplan = { "shift-planning": v("menu_shift_overview"), absence: v("menu_absence") };
  const mitTeam = {
    "team-goals": v("menu_team_goals"),
    kvalitetskontrol: !!hasQualityAccess,
    administration: !!hasQualityAccess,
    "pulse-survey-results": v("menu_pulse_survey"),
    "code-of-conduct-admin": v("menu_coc_admin"),
    "car-quiz-admin": v("menu_car_quiz_admin"),
  };
  const onboarding = {
    "onboarding-program": v("menu_onboarding_admin"),
    opstartshold: canViewRampTeam === true,
    "coaching-templates": v("menu_onboarding_admin"),
  };
  const rekruttering = {
    recruitment: v("menu_recruitment_dashboard"),
    candidates: v("menu_candidates"),
    "upcoming-interviews": v("menu_upcoming_interviews"),
    "upcoming-hires": v("menu_upcoming_hires"),
    "booking-flow": v("menu_booking_flow"),
    engagement: v("menu_booking_flow"),
    messages: v("menu_messages"),
    referrals: v("menu_referrals"),
    winback: v("menu_winback"),
    "email-templates": v("menu_email_templates"),
    "sms-templates": v("menu_sms_templates"),
  };
  const medarbejdere = {
    employees: v("menu_employees"),
    "upcoming-starts": v("menu_upcoming_starts"),
    "company-overview": v("menu_contracts"),
    "onboarding-analyse": v("menu_contracts"),
  };
  const kontrakter = {
    contracts: v("menu_contracts"),
    "career-wishes-overview": v("menu_career_wishes_overview"),
    "email-templates": v("menu_contracts"),
  };
  const nogen = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  return {
    vagtplan, mitTeam, onboarding, rekruttering, medarbejdere, kontrakter,
    har: {
      vagtplan: nogen(vagtplan), mitTeam: nogen(mitTeam), onboarding: nogen(onboarding),
      rekruttering: nogen(rekruttering), medarbejdere: nogen(medarbejdere), kontrakter: nogen(kontrakter),
    },
  };
}
