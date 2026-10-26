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
  // Sektionsnøgler fra de gamle menupunkter (c2): ingen ser mere end før.
  const sek = (x: string) => p.canView(`menu_section_${x}`);
  const vp = sek("vagtplan"), led = sek("ledelse"), rek = sek("rekruttering"), pers = sek("personale");
  const onbAdmin = sek("onboarding") && !!p.canViewOnboardingAdmin;

  const vagtplan = { "shift-planning": vp && v("menu_shift_overview"), absence: vp && v("menu_absence") };
  const mitTeam = {
    "team-goals": v("menu_team_goals"),
    kvalitetskontrol: !!hasQualityAccess && v("tab_mit_team_kvalitetskontrol"),
    administration: !!hasQualityAccess && v("tab_mit_team_kvalitet_administration"),
    "pulse-survey-results": led && v("menu_pulse_survey"),
    "code-of-conduct-admin": led && v("menu_coc_admin"),
    "car-quiz-admin": led && v("menu_car_quiz_admin"),
  };
  const onboarding = {
    "onboarding-program": onbAdmin && v("tab_onboarding_program"),
    opstartshold: canViewRampTeam === true && v("tab_onboarding_opstartshold"),
    "coaching-templates": onbAdmin && v("tab_onboarding_coaching_skabeloner"),
  };
  const rekruttering = {
    recruitment: rek && v("menu_recruitment_dashboard"),
    candidates: rek && v("tab_rekruttering_kandidater"),
    "upcoming-interviews": rek && v("menu_upcoming_interviews"),
    "upcoming-hires": rek && v("menu_upcoming_hires"),
    "booking-flow": rek && v("tab_rekruttering_booking") && v("menu_booking_flow"),
    engagement: rek && v("tab_rekruttering_booking_engagement") && v("menu_booking_flow"),
    messages: rek && v("menu_messages"),
    referrals: rek && v("tab_rekruttering_anbefalinger") && v("menu_referrals"),
    winback: rek && v("menu_winback"),
    "email-templates": rek && v("menu_email_templates"),
    "sms-templates": rek && v("menu_sms_templates"),
  };
  const medarbejdere = {
    employees: pers && v("tab_medarbejdere_aktive"),
    "upcoming-starts": pers && v("menu_upcoming_starts"),
    "company-overview": led && v("tab_medarbejdere_virksomhedsoverblik"),
    "onboarding-analyse": led && v("tab_medarbejdere_onboarding_analyse"),
  };
  const kontrakter = {
    contracts: led && v("tab_kontrakter_og_karriere_kontrakter"),
    "career-wishes-overview": led && v("menu_career_wishes_overview"),
    "email-templates": led && v("tab_kontrakter_og_karriere_mailskabeloner"),
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
