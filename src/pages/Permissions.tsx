import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Users, Lock, Key, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EmployeeWithRoles {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  roles: string[];
}

const roleDescriptions: Record<string, { label: string; description: string; color: string }> = {
  ejer: {
    label: "Ejer",
    description: "Fuld adgang til alle funktioner og data i systemet",
    color: "bg-primary text-primary-foreground",
  },
  teamleder: {
    label: "Teamleder",
    description: "Adgang til eget team, vagtplan, fravær og kontrakter",
    color: "bg-blue-500 text-white",
  },
  rekruttering: {
    label: "Rekruttering",
    description: "Adgang til kandidater, ansættelser og kontrakter",
    color: "bg-amber-500 text-white",
  },
  some: {
    label: "SOME",
    description: "Adgang til sociale medier og indholdsplanlægning",
    color: "bg-purple-500 text-white",
  },
  medarbejder: {
    label: "Medarbejder",
    description: "Begrænset adgang til egen profil og vagtplan",
    color: "bg-muted text-muted-foreground",
  },
};

export default function Permissions() {
  const { data: employeesWithRoles, isLoading } = useQuery({
    queryKey: ["employee-roles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_employee_roles_for_admin");
      if (error) throw error;
      return data as EmployeeWithRoles[];
    },
  });

  // Count stats
  const totalRoles = Object.keys(roleDescriptions).length;
  const totalUsers = employeesWithRoles?.length || 0;
  const usersWithRoles = employeesWithRoles?.filter(e => e.roles && e.roles.length > 0).length || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Rettigheder</h1>
          <p className="text-muted-foreground">Administrer brugerrettigheder og adgangskontrol</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalRoles}</p>
                  <p className="text-sm text-muted-foreground">Roller</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Aktive brugere</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Lock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usersWithRoles}</p>
                  <p className="text-sm text-muted-foreground">Med roller</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Key className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers - usersWithRoles}</p>
                  <p className="text-sm text-muted-foreground">Uden roller</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rollebeskrivelser</CardTitle>
            <CardDescription>Oversigt over systemets roller og deres tilladelser</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(roleDescriptions).map(([key, role]) => (
                <div key={key} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className={role.color}>{role.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brugere og roller</CardTitle>
            <CardDescription>Aktive medarbejdere og deres tildelte roller</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stilling</TableHead>
                    <TableHead>Roller</TableHead>
                    <TableHead>Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesWithRoles?.map((employee) => (
                    <TableRow key={employee.employee_id}>
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.email}
                      </TableCell>
                      <TableCell>{employee.job_title || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {employee.roles && employee.roles.length > 0 ? (
                            employee.roles.map((role) => {
                              const roleInfo = roleDescriptions[role];
                              return (
                                <Badge key={role} className={roleInfo?.color || "bg-muted"}>
                                  {roleInfo?.label || role}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground text-sm">Ingen rolle</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.auth_user_id ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Aktivt
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Ikke oprettet
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
