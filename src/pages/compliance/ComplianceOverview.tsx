import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, FileText, Lock, ArrowRight, Bell, ClipboardList, AlertTriangle, Globe, Clock, Search, GraduationCap, Brain, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePositionPermissions";

export default function ComplianceOverview() {
  const navigate = useNavigate();
  const p = usePermissions();

  const cards = [
    {
      title: "Privatliv for medarbejdere",
      description: "Hvordan vi behandler personoplysninger om medarbejdere i forbindelse med ansættelse, løn, provision og drift.",
      icon: Users,
      badge: "For medarbejdere",
      badgeColor: "bg-blue-500/10 text-blue-700 border-blue-500/30",
      href: "/compliance/employee-privacy",
      permKey: "menu_compliance_employee",
    },
    {
      title: "Interne processer og compliance",
      description: "De vigtigste interne processer for adgang, kundedata, løn/provision, rekruttering, sikkerhed og review.",
      icon: Lock,
      badge: "Intern",
      badgeColor: "bg-orange-500/10 text-orange-700 border-orange-500/30",
      href: "/compliance/processes",
      permKey: "menu_compliance_processes",
    },
    {
      title: "Admin og dokumentation",
      description: "Intern dokumentation om datatyper, leverandører, logging, backup, sletning, AI og ansvar.",
      icon: FileText,
      badge: "Admin",
      badgeColor: "bg-red-500/10 text-red-700 border-red-500/30",
      href: "/compliance/admin",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Notifikationsmodtagere",
      description: "Administrer hvem der modtager compliance-relaterede notifikationer og GDPR-påmindelser.",
      icon: Bell,
      badge: "Admin",
      badgeColor: "bg-red-500/10 text-red-700 border-red-500/30",
      href: "/compliance/notifications",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Behandlingsaktiviteter",
      description: "Artikel 30-fortegnelse: Oversigt over alle behandlingsaktiviteter med formål, retsgrundlag og slettefrister.",
      icon: ClipboardList,
      badge: "Art. 30",
      badgeColor: "bg-purple-500/10 text-purple-700 border-purple-500/30",
      href: "/compliance/processing-activities",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Sikkerhedsbrud-log",
      description: "Registrer og spor sikkerhedshændelser iht. GDPR Artikel 33 (72-timers indberetningspligt).",
      icon: AlertTriangle,
      badge: "Art. 33",
      badgeColor: "bg-red-500/10 text-red-700 border-red-500/30",
      href: "/compliance/security-incidents",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Dataoverførsler til tredjeparter",
      description: "Oversigt over tredjeparter der modtager persondata, inkl. lokation, retsgrundlag og DPA-status.",
      icon: Globe,
      badge: "Art. 28",
      badgeColor: "bg-green-500/10 text-green-700 border-green-500/30",
      href: "/compliance/data-transfers",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Sletningspolitikker",
      description: "Konfigurer retention-perioder og rensningstype per kampagne. Vælg mellem anonymisering af kundedata eller fuld sletning.",
      icon: Clock,
      badge: "GDPR",
      badgeColor: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
      href: "/compliance/retention-policies",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Konsekvensanalyse (DPIA)",
      description: "Artikel 35-vurdering af konsekvenser for databeskyttelse ved højrisiko-behandlinger som CPR, løn og bankdata.",
      icon: Search,
      badge: "Art. 35",
      badgeColor: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
      href: "/compliance/dpia",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Medarbejder-awareness",
      description: "Dokumentation af GDPR-oplysning og træning: samtykke, Code of Conduct, onboarding og løbende information.",
      icon: GraduationCap,
      badge: "Awareness",
      badgeColor: "bg-teal-500/10 text-teal-700 border-teal-500/30",
      href: "/compliance/awareness",
      permKey: "menu_compliance_admin",
    },
    {
      title: "AI Governance",
      description: "Intern styring af kunstig intelligens: Politik, use case-register, ansvarsfordeling og instruktionslog iht. EU AI Act.",
      icon: Brain,
      badge: "EU AI Act",
      badgeColor: "bg-violet-500/10 text-violet-700 border-violet-500/30",
      href: "/compliance/ai-governance",
      permKey: "menu_compliance_admin",
    },
    {
      title: "Audit-log: Følsomme data",
      description: "Log over hvem der har redigeret CPR-numre, bankoplysninger og andre følsomme medarbejderdata.",
      icon: Eye,
      badge: "Audit",
      badgeColor: "bg-amber-500/10 text-amber-700 border-amber-500/30",
      href: "/compliance/access-log",
      permKey: "menu_compliance_admin",
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Compliance & Privatliv</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Stork Copenhagen Sales – intern compliance- og privacy-sektion
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p>
                Vi behandler kun de oplysninger, der er nødvendige for konkrete og saglige formål. Adgang gives efter rolle og arbejdsbehov. Denne sektion samler vores interne dokumentation og processer.
              </p>
              <p className="text-muted-foreground text-xs">
                GDPR-ansvarlig: Kasper Mikkelsen · Udpeget pr. juni 2025
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {cards.filter((card) => p.canView(card.permKey)).map((card) => (
            <Card
              key={card.href}
              className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] group"
              onClick={() => navigate(card.href)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <card.icon className="h-6 w-6 text-primary" />
                  <Badge variant="outline" className={card.badgeColor}>
                    {card.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {card.description}
                </CardDescription>
                <div className="flex items-center gap-1 mt-4 text-sm text-primary font-medium group-hover:gap-2 transition-all">
                  Læs mere <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
