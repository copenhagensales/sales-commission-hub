import { useLocation } from "react-router-dom";
import { Shield, Construction } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/amo/organisation": "AMO Organisation",
  "/amo/annual-discussion": "Årlig arbejdsmiljødrøftelse",
  "/amo/meetings": "Møder og referater",
  "/amo/apv": "Arbejdspladsvurdering (APV)",
  "/amo/kemi-apv": "Kemisk risikovurdering (Kemi-APV)",
  "/amo/training": "Uddannelse og certifikater",
  "/amo/documents": "Dokumentcenter",
  "/amo/tasks": "Opgaver og deadlines",
  "/amo/settings": "Compliance regler",
  "/amo/audit-log": "Audit log",
};

export default function AmoPlaceholder() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "AMO";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <Shield className="h-6 w-6 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Construction className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold text-muted-foreground">Under opbygning</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Denne side er en del af AMO Compliance Hub og bliver bygget i næste fase.
        </p>
      </div>
    </div>
  );
}
