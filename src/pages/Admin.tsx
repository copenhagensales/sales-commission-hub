import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Crown, User, Search, Info } from "lucide-react";
import { useCanAccess, SystemRole } from "@/hooks/useSystemRoles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EmployeeRole {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  role_id: string | null;
  role: SystemRole | null;
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { isOwner, isLoading: accessLoading } = useCanAccess();

  // Fetch users with their roles using the secure RPC function
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-employee-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_employee_roles_for_admin");
      if (error) throw error;
      return data as EmployeeRole[];
    },
    enabled: isOwner,
  });

  // Assign role mutation using RPC
  const assignRole = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: SystemRole }) => {
      const { error } = await supabase.rpc("assign_role_by_email", {
        _email: email,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employee-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
      toast.success("Rolle opdateret");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke opdatere rolle: " + error.message);
    },
  });

  // Remove role mutation using RPC
  const removeRole = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("remove_role_by_email", {
        _email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employee-roles"] });
      queryClient.invalidateQueries({ queryKey: ["system-role"] });
      toast.success("Rolle fjernet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke fjerne rolle: " + error.message);
    },
  });

  const filteredUsers = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const email = user.email?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const getRoleBadge = (role: SystemRole | null) => {
    switch (role) {
      case "ejer":
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <Crown className="h-3 w-3 mr-1" />
            Ejer
          </Badge>
        );
      case "teamleder":
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Users className="h-3 w-3 mr-1" />
            Teamleder
          </Badge>
        );
      case "rekruttering":
        return (
          <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">
            <Users className="h-3 w-3 mr-1" />
            Rekruttering
          </Badge>
        );
      case "medarbejder":
        return (
          <Badge variant="secondary">
            <User className="h-3 w-3 mr-1" />
            Medarbejder
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Ingen rolle
          </Badge>
        );
    }
  };

  if (accessLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!isOwner) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertTitle>Ingen adgang</AlertTitle>
            <AlertDescription>
              Du har ikke adgang til denne side. Kun ejere kan administrere roller.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Administration
            </h1>
            <p className="text-muted-foreground mt-1">
              Administrer brugerroller og rettigheder
            </p>
          </div>
        </div>

        {/* Role explanation cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Medarbejder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Egne vagter og tidsregistrering</li>
                <li>• Eget stamdatakort</li>
                <li>• Egen fraværsanmodning</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Rekruttering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Se alle medarbejdere</li>
                <li>• Oprette nye medarbejdere</li>
                <li>• Sende kontrakter (ikke redigere)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Teamleder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Alt fra Medarbejder</li>
                <li>• Eget teams vagter og medarbejdere</li>
                <li>• Eget teams salgsdata</li>
                <li>• Eget teams lønkørsel</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Ejer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fuld adgang til alle moduler</li>
                <li>• Alle medarbejdere og teams</li>
                <li>• Administration af roller</li>
                <li>• Systemindstillinger</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Info alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Teamdefinition</AlertTitle>
          <AlertDescription>
            Et team defineres via <strong>manager_id</strong> feltet i medarbejderdata. 
            Teamledere kan se alle medarbejdere hvor de selv er sat som manager.
          </AlertDescription>
        </Alert>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle>Brugerroller</CardTitle>
            <CardDescription>
              Tildel roller til brugere for at styre deres adgang til systemet.
              Kun brugere med en aktiv login (auth konto) kan tildeles en rolle.
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn eller email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Fejl</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stilling</TableHead>
                    <TableHead>Login status</TableHead>
                    <TableHead>Nuværende rolle</TableHead>
                    <TableHead>Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.employee_id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email || "-"}
                      </TableCell>
                      <TableCell>{user.job_title || "-"}</TableCell>
                      <TableCell>
                        {user.auth_user_id ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Ingen login
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.auth_user_id && user.email ? (
                          <Select
                            value={user.role || "none"}
                            onValueChange={(value) => {
                              if (value === "none") {
                                removeRole.mutate(user.email!);
                              } else {
                                assignRole.mutate({
                                  email: user.email!,
                                  role: value as SystemRole,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Vælg rolle" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen rolle</SelectItem>
                              <SelectItem value="medarbejder">Medarbejder</SelectItem>
                              <SelectItem value="rekruttering">Rekruttering</SelectItem>
                              <SelectItem value="teamleder">Teamleder</SelectItem>
                              <SelectItem value="ejer">Ejer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Kræver login
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Ingen brugere fundet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
