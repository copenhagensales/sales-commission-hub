import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Settings, Calendar, FileText, BarChart3, Loader2 } from "lucide-react";

const roleDescriptions: Record<string, { label: string; description: string; color: string; icon: React.ReactNode }> = {
  ejer: {
    label: "Ejer",
    description: "Fuld adgang til alle funktioner og data i systemet",
    color: "bg-primary text-primary-foreground",
    icon: <Shield className="h-4 w-4" />,
  },
  teamleder: {
    label: "Teamleder",
    description: "Adgang til eget team, vagtplan, fravær og kontrakter",
    color: "bg-blue-500 text-white",
    icon: <Users className="h-4 w-4" />,
  },
  rekruttering: {
    label: "Rekruttering",
    description: "Adgang til kandidater, ansættelser og kontrakter",
    color: "bg-amber-500 text-white",
    icon: <FileText className="h-4 w-4" />,
  },
  some: {
    label: "SOME",
    description: "Adgang til sociale medier og indholdsplanlægning",
    color: "bg-purple-500 text-white",
    icon: <Calendar className="h-4 w-4" />,
  },
  medarbejder: {
    label: "Medarbejder",
    description: "Begrænset adgang til egen profil og vagtplan",
    color: "bg-muted text-muted-foreground",
    icon: <Settings className="h-4 w-4" />,
  },
};

const accessMatrix: Record<string, { feature: string; ejer: boolean; teamleder: boolean; rekruttering: boolean; some: boolean; medarbejder: boolean }[]> = {
  pages: [
    { feature: "Dashboard", ejer: true, teamleder: true, rekruttering: true, some: true, medarbejder: true },
    { feature: "Løn & Økonomi", ejer: true, teamleder: false, rekruttering: false, some: false, medarbejder: false },
    { feature: "Medarbejdere", ejer: true, teamleder: true, rekruttering: true, some: false, medarbejder: false },
    { feature: "Vagtplan", ejer: true, teamleder: true, rekruttering: false, some: false, medarbejder: true },
    { feature: "Fravær", ejer: true, teamleder: true, rekruttering: false, some: false, medarbejder: true },
    { feature: "Kontrakter", ejer: true, teamleder: true, rekruttering: true, some: false, medarbejder: true },
    { feature: "Rekruttering", ejer: true, teamleder: false, rekruttering: true, some: false, medarbejder: false },
    { feature: "Onboarding", ejer: true, teamleder: true, rekruttering: true, some: false, medarbejder: false },
    { feature: "Indhold/SOME", ejer: true, teamleder: false, rekruttering: false, some: true, medarbejder: false },
    { feature: "Rapporter", ejer: true, teamleder: true, rekruttering: false, some: false, medarbejder: false },
    { feature: "Integrationer", ejer: true, teamleder: false, rekruttering: false, some: false, medarbejder: false },
  ],
};

export function PermissionsTab() {
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, system_role")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Systemroller
          </CardTitle>
          <CardDescription>
            Hver rolle giver adgang til specifikke funktioner i systemet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(roleDescriptions).map(([key, role]) => (
              <div key={key} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={role.color}>
                    {role.icon}
                    <span className="ml-1">{role.label}</span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Position to role mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Stilling → Systemrolle
          </CardTitle>
          <CardDescription>
            Hver stilling er automatisk knyttet til en systemrolle der bestemmer adgangsniveau
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stilling</TableHead>
                <TableHead>Systemrolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => {
                const roleInfo = roleDescriptions[position.system_role || "medarbejder"];
                return (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>
                      {roleInfo ? (
                        <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Access matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Adgangsmatrix
          </CardTitle>
          <CardDescription>
            Oversigt over hvilke sider hver rolle har adgang til
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Side/Funktion</TableHead>
                  {Object.entries(roleDescriptions).map(([key, role]) => (
                    <TableHead key={key} className="text-center">
                      <Badge className={role.color} variant="outline">
                        {role.label}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessMatrix.pages.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium">{row.feature}</TableCell>
                    <TableCell className="text-center">
                      {row.ejer ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.teamleder ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.rekruttering ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.some ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.medarbejder ? "✓" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
