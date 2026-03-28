import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, FileText, Lock, ArrowRight, Bell } from "lucide-react";
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
            Stork Copenhagen Sales — intern compliance- og privacy-sektion
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Vi behandler kun de oplysninger, der er nødvendige for konkrete og saglige formål. Adgang gives efter rolle og arbejdsbehov. Denne sektion samler vores interne dokumentation og processer.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
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
