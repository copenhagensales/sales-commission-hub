import { usePermissions } from "@/hooks/usePositionPermissions";
import { useMitArbejdeSynlighed } from "@/hooks/useMitArbejdeSynlighed";
import { useTeamPersonaleSynlighed } from "@/hooks/useTeamPersonaleSynlighed";
import { useSalgRapporterSynlighed } from "@/hooks/useSalgRapporterSynlighed";
import { useAdminSynlighed } from "@/hooks/useAdminSynlighed";
import { useInvoiceflowAccess } from "@/hooks/useInvoiceflow";
import type { StrukturSynlighed } from "@/config/struktur";

/** Samler flagene til `STRUKTUR` fra de eksisterende synligheds-hooks. Ingen nye nøgler. */
export function useStrukturSynlighed(): StrukturSynlighed {
  const p = usePermissions();
  const m = useMitArbejdeSynlighed();
  const tp = useTeamPersonaleSynlighed().har;
  const sr = useSalgRapporterSynlighed().har;
  const ad = useAdminSynlighed().har;
  const { hasAccess: invoiceflowAccess } = useInvoiceflowAccess();
  return {
    home: !!p.canViewHome, mineTal: !!p.canViewMyGoals, vagter: m.harVagter, registrerSalg: m.harSalg,
    storkbook: !!p.canViewPulsen, spil: m.harSpil, spilSuperligaen: m.spil.superligaen, spilHead2head: m.spil.head2head, minProfil: !!p.canViewMyProfile || m.profil.fordele || m.profil.feedback || m.profil.anbefal,
    vagtplan: tp.vagtplan, mitTeam: tp.mitTeam, onboarding: tp.onboarding,
    salg: p.canView("menu_sales") && p.canView("menu_section_sales_system"), fieldmarketing: sr.fieldmarketing, retSalg: sr.retSalg, tdc: sr.tdc, kunder: sr.kunder,
    rekruttering: tp.rekruttering, medarbejdere: tp.medarbejdere, kontrakter: tp.kontrakter,
    rapporter: sr.rapporter, invoiceflow: !!invoiceflowAccess,
    compliance: ad.compliance, amo: ad.amo, admin: ad.admin, udsendelser: ad.udsendelser,
    tavler: true, powerdag: sr.powerdag, liveTal: !!p.canViewLiveStats,
  };
}
