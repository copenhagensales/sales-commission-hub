import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  RefreshCw,
  Users,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface FailedLoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  attempted_at: string;
  failure_reason: string | null;
}

interface LockedAccount {
  id: string;
  first_name: string;
  last_name: string;
  private_email: string;
  failed_login_count: number;
  locked_at: string | null;
  account_locked: boolean;
}

export default function SecurityDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch failed login attempts
  const { data: failedAttempts = [], isLoading: loadingAttempts } = useQuery({
    queryKey: ["failed-login-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("failed_login_attempts")
        .select("*")
        .order("attempted_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as FailedLoginAttempt[];
    },
  });

  // Fetch locked accounts
  const { data: lockedAccounts = [], isLoading: loadingLocked } = useQuery({
    queryKey: ["locked-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, failed_login_count, locked_at, account_locked")
        .or("account_locked.eq.true,failed_login_count.gte.3")
        .order("failed_login_count", { ascending: false });

      if (error) throw error;
      return data as LockedAccount[];
    },
  });

  // Unlock account mutation
  const unlockMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({
          account_locked: false,
          locked_at: null,
          failed_login_count: 0,
        })
        .eq("id", employeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locked-accounts"] });
      toast.success("Konto låst op");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke låse konto op: " + error.message);
    },
  });

  // Filter failed attempts by search
  const filteredAttempts = failedAttempts.filter((attempt) =>
    attempt.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attempt.ip_address?.includes(searchTerm)
  );

  // Group attempts by email for statistics
  const attemptsByEmail = failedAttempts.reduce((acc, attempt) => {
    acc[attempt.email] = (acc[attempt.email] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topOffenders = Object.entries(attemptsByEmail)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Sikkerhedsoversigt
          </h1>
          <p className="text-muted-foreground">
            Overvåg login-forsøg og administrer kontosikkerhed
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["failed-login-attempts"] });
            queryClient.invalidateQueries({ queryKey: ["locked-accounts"] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Opdater
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fejlede logins (24t)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{failedAttempts.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Låste konti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">
                {lockedAccounts.filter((a) => a.account_locked).length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspekte konti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">
                {lockedAccounts.filter((a) => a.failed_login_count >= 3 && !a.account_locked).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attempts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attempts" className="gap-2">
            <Activity className="h-4 w-4" />
            Fejlede logins
          </TabsTrigger>
          <TabsTrigger value="locked" className="gap-2">
            <Lock className="h-4 w-4" />
            Låste konti
          </TabsTrigger>
          <TabsTrigger value="top" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Top mistænkelige
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attempts" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter email eller IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>IP-adresse</TableHead>
                  <TableHead>Tidspunkt</TableHead>
                  <TableHead>Årsag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAttempts ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : filteredAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Ingen fejlede login-forsøg fundet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.email}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {attempt.ip_address || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(attempt.attempted_at), "dd. MMM HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {attempt.failure_reason || "Ukendt"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="locked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Konti med login-problemer</CardTitle>
              <CardDescription>
                Konti med mange fejlede forsøg eller som er låst
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fejlede forsøg</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLocked ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Indlæser...
                      </TableCell>
                    </TableRow>
                  ) : lockedAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Ingen konti med problemer
                      </TableCell>
                    </TableRow>
                  ) : (
                    lockedAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          {account.first_name} {account.last_name}
                        </TableCell>
                        <TableCell>{account.private_email}</TableCell>
                        <TableCell>
                          <Badge variant={account.failed_login_count >= 5 ? "destructive" : "secondary"}>
                            {account.failed_login_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {account.account_locked ? (
                            <Badge variant="destructive" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Låst
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Suspekt
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlockMutation.mutate(account.id)}
                            disabled={unlockMutation.isPending}
                          >
                            <Unlock className="h-4 w-4 mr-1" />
                            Lås op
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top mistænkelige emails</CardTitle>
              <CardDescription>
                Emails med flest fejlede login-forsøg de seneste 24 timer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topOffenders.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Ingen mistænkelige aktiviteter fundet
                </p>
              ) : (
                <div className="space-y-3">
                  {topOffenders.map(([email, count], index) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="font-medium">{email}</span>
                      </div>
                      <Badge variant={count >= 5 ? "destructive" : "secondary"}>
                        {count} forsøg
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
