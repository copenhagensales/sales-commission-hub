import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Crown, User, Search, Info } from "lucide-react";
import { useCanAccess, SystemRole } from "@/hooks/useSystemRoles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  role: SystemRole | null;
  role_id: string | null;
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { isOwner, isLoading: accessLoading } = useCanAccess();

  // Fetch users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      // Get employees with email
      const { data: employees, error: empError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, job_title")
        .eq("is_active", true)
        .order("first_name");

      if (empError) throw empError;

      // Get all roles
      const { data: roles, error: roleError } = await supabase
        .from("system_roles")
        .select("*");

      if (roleError) throw roleError;

      // For each employee, try to find their auth user and role
      const usersWithRoles: UserWithRole[] = [];

      for (const emp of employees || []) {
        if (!emp.private_email) continue;

        // Find role by matching email pattern
        const matchingRole = roles?.find((r) => {
          // We need to get the auth user's email - this is a workaround
          // In production, you'd want a view or function for this
          return false;
        });

        usersWithRoles.push({
          id: emp.id,
          email: emp.private_email,
          first_name: emp.first_name,
          last_name: emp.last_name,
          job_title: emp.job_title,
          role: null,
          role_id: null,
        });
      }

      // Also include roles that have user_ids
      for (const role of roles || []) {
        const existingUser = usersWithRoles.find((u) => u.id === role.user_id);
        if (existingUser) {
          existingUser.role = role.role as SystemRole;
          existingUser.role_id = role.id;
        } else {
          // User has role but not in employee_master_data - fetch from auth
          usersWithRoles.push({
            id: role.user_id,
            email: "Ukendt",
            first_name: null,
            last_name: null,
            job_title: null,
            role: role.role as SystemRole,
            role_id: role.id,
          });
        }
      }

      return usersWithRoles;
    },
    enabled: isOwner,
  });

  // Assign role mutation
  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: SystemRole }) => {
      const { error } = await supabase
        .from("system_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
      toast.success("Rolle opdateret");
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere rolle: " + error.message);
    },
  });

  // Remove role mutation
  const removeRole = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("system_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
      toast.success("Rolle fjernet");
    },
    onError: (error) => {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Tildel roller til brugere for at styre deres adgang til systemet
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stilling</TableHead>
                    <TableHead>Nuværende rolle</TableHead>
                    <TableHead>Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>{user.job_title || "-"}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={user.role || "none"}
                            onValueChange={(value) => {
                              if (value === "none") {
                                removeRole.mutate(user.id);
                              } else {
                                assignRole.mutate({
                                  userId: user.id,
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
                              <SelectItem value="teamleder">Teamleder</SelectItem>
                              <SelectItem value="ejer">Ejer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
