import {
  Home, Target, Calendar, BadgeCheck, Newspaper, Gamepad2, User, ClipboardList, Users, GraduationCap,
  CalendarDays, PencilLine, FileText, Percent, UserPlus, UserCog, FileSignature, FileBarChart, Receipt,
  ShieldCheck, Shield, Wrench, Monitor, Zap, Activity, Trophy, Swords, type LucideIcon,
} from "lucide-react";

/** Flag, som synlighedsreglerne læser. Bygges kun af `useStrukturSynlighed`. */
export interface StrukturSynlighed {
  home: boolean; mineTal: boolean; vagter: boolean; registrerSalg: boolean; storkbook: boolean; spil: boolean; spilSuperligaen: boolean; spilHead2head: boolean; minProfil: boolean;
  vagtplan: boolean; mitTeam: boolean; onboarding: boolean;
  fieldmarketing: boolean; retSalg: boolean; tdc: boolean; kunder: boolean;
  rekruttering: boolean; medarbejdere: boolean; kontrakter: boolean;
  rapporter: boolean; invoiceflow: boolean;
  compliance: boolean; amo: boolean; admin: boolean;
  tavler: boolean; powerdag: boolean; liveTal: boolean;
}

export interface StrukturSide {
  /** item_key i sidebar_menu_config */
  id: string;
  label: string;
  rute: string;
  ikon: LucideIcon;
  synlig: (s: StrukturSynlighed) => boolean;
  /** Faner, der vises som fliser i telefonens skuffe (fx Spil). */
  faner?: StrukturFane[];
}

export interface StrukturFane {
  id: string;
  label: string;
  rute: string;
  ikon: LucideIcon;
  hint?: string;
  synlig: (s: StrukturSynlighed) => boolean;
}

export interface StrukturOmraade {
  /** item_key i sidebar_menu_config */
  id: string;
  label: string;
  ikon: LucideIcon;
  sider: StrukturSide[];
}

/** Én konfiguration for sidebar, bundbjælke og skuffer. Rækkefølgen her er standardrækkefølgen. */
export const STRUKTUR: StrukturOmraade[] = [
  { id: "omraade_mit_arbejde", label: "Mit arbejde", ikon: Home, sider: [
    { id: "side_hjem", label: "Hjem", rute: "/home", ikon: Home, synlig: (s) => s.home },
    { id: "side_mine_tal", label: "Mine tal", rute: "/my-goals", ikon: Target, synlig: (s) => s.mineTal },
    { id: "side_vagter", label: "Vagter", rute: "/vagter", ikon: Calendar, synlig: (s) => s.vagter },
    { id: "side_registrer_salg", label: "Registrér salg", rute: "/registrer-salg", ikon: BadgeCheck, synlig: (s) => s.registrerSalg },
    { id: "side_storkbook", label: "Storkbook", rute: "/storkbook", ikon: Newspaper, synlig: (s) => s.storkbook },
    { id: "side_spil", label: "Spil", rute: "/spil", ikon: Gamepad2, synlig: (s) => s.spil, faner: [
      { id: "superligaen", label: "Superligaen", rute: "/spil?tab=superligaen", ikon: Trophy, hint: "Provisionsligaen", synlig: (s) => s.spilSuperligaen },
      { id: "head2head", label: "Head2Head", rute: "/spil?tab=head2head", ikon: Swords, hint: "1v1 og holdkampe", synlig: (s) => s.spilHead2head },
    ] },
    { id: "side_min_profil", label: "Min profil", rute: "/my-profile", ikon: User, synlig: (s) => s.minProfil },
  ] },
  { id: "omraade_mit_team", label: "Mit team", ikon: Users, sider: [
    { id: "side_vagtplan", label: "Vagtplan", rute: "/shift-planning", ikon: ClipboardList, synlig: (s) => s.vagtplan },
    { id: "side_mit_team", label: "Mit team", rute: "/mit-team", ikon: Users, synlig: (s) => s.mitTeam },
    { id: "side_onboarding", label: "Onboarding", rute: "/onboarding-program", ikon: GraduationCap, synlig: (s) => s.onboarding },
  ] },
  { id: "omraade_salg_og_kunder", label: "Salg og kunder", ikon: CalendarDays, sider: [
    { id: "side_fieldmarketing", label: "Fieldmarketing", rute: "/vagt-flow", ikon: CalendarDays, synlig: (s) => s.fieldmarketing },
    { id: "side_ret_salg", label: "Ret salg", rute: "/ret-salg", ikon: PencilLine, synlig: (s) => s.retSalg },
    { id: "side_tdc_vaerktoejer", label: "TDC-værktøjer", rute: "/tdc", ikon: FileText, synlig: (s) => s.tdc },
    { id: "side_kunder_og_priser", label: "Kunder og priser", rute: "/kunder-og-priser", ikon: Percent, synlig: (s) => s.kunder },
  ] },
  { id: "omraade_rekruttering_og_personale", label: "Rekruttering og personale", ikon: UserPlus, sider: [
    { id: "side_rekruttering", label: "Rekruttering", rute: "/recruitment", ikon: UserPlus, synlig: (s) => s.rekruttering },
    { id: "side_medarbejdere", label: "Medarbejdere", rute: "/employees", ikon: UserCog, synlig: (s) => s.medarbejdere },
    { id: "side_kontrakter_og_karriere", label: "Kontrakter og karriere", rute: "/contracts", ikon: FileSignature, synlig: (s) => s.kontrakter },
  ] },
  { id: "omraade_loen_og_rapporter", label: "Løn og rapporter", ikon: FileBarChart, sider: [
    { id: "side_rapporter", label: "Rapporter", rute: "/reports/admin", ikon: FileBarChart, synlig: (s) => s.rapporter },
    { id: "side_invoiceflow", label: "InvoiceFlow", rute: "/invoiceflow", ikon: Receipt, synlig: (s) => s.invoiceflow },
  ] },
  { id: "omraade_compliance_og_amo", label: "Compliance og AMO", ikon: ShieldCheck, sider: [
    { id: "side_compliance", label: "Compliance", rute: "/compliance", ikon: ShieldCheck, synlig: (s) => s.compliance },
    { id: "side_amo", label: "AMO", rute: "/amo", ikon: Shield, synlig: (s) => s.amo },
  ] },
  { id: "omraade_administration", label: "Administration", ikon: Wrench, sider: [
    { id: "side_administration", label: "Administration", rute: "/admin", ikon: Wrench, synlig: (s) => s.admin },
  ] },
  { id: "omraade_tavler", label: "Tavler", ikon: Monitor, sider: [
    { id: "side_tavler", label: "Tavler", rute: "/dashboards", ikon: Monitor, synlig: (s) => s.tavler },
    { id: "side_powerdag", label: "Powerdag", rute: "/dashboards/powerdag", ikon: Zap, synlig: (s) => s.powerdag },
    { id: "side_live_tal", label: "Live-tal", rute: "/live-stats", ikon: Activity, synlig: (s) => s.liveTal },
  ] },
];

export const MIT_ARBEJDE = "omraade_mit_arbejde";

/** Aktiv, når stien er sidens rute eller ligger under den. `/dashboards` er kun aktiv på sig selv (Powerdag ligger under). */
export function erAktiv(pathname: string, rute: string): boolean {
  if (rute === "/dashboards") return pathname === rute;
  return pathname === rute || pathname.startsWith(`${rute}/`);
}

export function findSide(id: string): StrukturSide | undefined {
  for (const o of STRUKTUR) for (const s of o.sider) if (s.id === id) return s;
  return undefined;
}
