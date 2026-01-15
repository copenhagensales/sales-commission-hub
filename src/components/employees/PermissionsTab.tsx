import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Settings, Calendar, FileText, BarChart3, Loader2, Crown, User } from "lucide-react";

// Icon mapping from database string to component
const iconMap: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  "file-text": <FileText className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

// Color mapping from database string to Tailwind classes
const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};

const accessMatrix = {
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

interface RoleDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  detailed_description: string | null;
  color: string | null;
  icon: string | null;
  priority: number | null;
}

export function PermissionsTab() {
  const { data: roleDefinitions = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["system-role-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_role_definitions")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as RoleDefinition[];
    },
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
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

  const isLoading = rolesLoading || positionsLoading;

  // Create a lookup map for roles
  const roleMap = roleDefinitions.reduce((acc, role) => {
    acc[role.key] = role;
    return acc;
  }, {} as Record<string, RoleDefinition>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role descriptions from database */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleDefinitions.map((role) => (
              <div key={role.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={colorMap[role.color || "gray"]}>
                    {iconMap[role.icon || "shield"]}
                    <span className="ml-1">{role.label}</span>
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{role.description}</p>
                {role.detailed_description && (
                  <div className="text-sm text-muted-foreground whitespace-pre-line border-t pt-3 mt-2">
                    {role.detailed_description}
                  </div>
                )}
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
                const role = roleMap[position.system_role || "medarbejder"];
                return (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>
                      {role ? (
                        <Badge className={colorMap[role.color || "gray"]}>
                          {iconMap[role.icon || "shield"]}
                          <span className="ml-1">{role.label}</span>
                        </Badge>
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
                  {roleDefinitions.map((role) => (
                    <TableHead key={role.key} className="text-center">
                      <Badge className={colorMap[role.color || "gray"]} variant="outline">
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
                    {roleDefinitions.map((role) => (
                      <TableCell key={role.key} className="text-center">
                        {row[role.key as keyof typeof row] ? (
                          <span className="text-green-600 font-medium">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
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
