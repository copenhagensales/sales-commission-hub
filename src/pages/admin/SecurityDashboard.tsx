import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  KeyRound,
  Globe,
  Plus,
  Trash2,
  Smartphone,
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

interface Position {
  id: string;
  name: string;
}

interface TrustedIpRange {
  id: string;
  name: string;
  ip_range: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface MfaEmployee {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  private_email: string | null;
  mfa_enabled: boolean;
}

export default function SecurityDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [mfaSearchTerm, setMfaSearchTerm] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("all");
  const [newIpName, setNewIpName] = useState("");
  const [newIpRange, setNewIpRange] = useState("");
  const [newIpDescription, setNewIpDescription] = useState("");
  const [resettingMfaFor, setResettingMfaFor] = useState<string | null>(null);

  // Fetch positions for dropdown
  const { data: positions = [] } = useQuery({
    queryKey: ["positions-for-password-reset"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as Position[];
    },
  });

  // Fetch password change stats
  const { data: passwordStats } = useQuery({
    queryKey: ["password-change-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, must_change_password")
        .eq("is_active", true);

      if (error) throw error;
      
      const total = data?.length || 0;
      const mustChange = data?.filter(e => e.must_change_password).length || 0;
      
      return { total, mustChange };
    },
  });

  // Force password reset mutation
  const forcePasswordResetMutation = useMutation({
    mutationFn: async (scope: "all" | "position") => {
      const { data, error } = await supabase.functions.invoke("force-password-reset", {
        body: { 
          scope, 
          position_id: scope === "position" ? selectedPositionId : undefined 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["password-change-stats"] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke tvinge password-ændring: " + error.message);
    },
  });

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

  // Fetch all active employees for MFA administration
  const { data: mfaEmployees = [], isLoading: loadingMfa } = useQuery({
    queryKey: ["mfa-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email, private_email, mfa_enabled")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data as MfaEmployee[];
    },
  });

  // Count employees with MFA enabled
  const mfaEnabledCount = mfaEmployees.filter(emp => emp.mfa_enabled).length;

  // Reset MFA mutation
  const resetMfaMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("reset-user-mfa", {
        body: { email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mfa-employees"] });
      setResettingMfaFor(null);
      toast.success(data.message || "MFA er nulstillet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke nulstille MFA: " + error.message);
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

  // Filter MFA employees by search
  const filteredMfaEmployees = mfaEmployees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(mfaSearchTerm.toLowerCase()) ||
    emp.work_email?.toLowerCase().includes(mfaSearchTerm.toLowerCase()) ||
    emp.private_email?.toLowerCase().includes(mfaSearchTerm.toLowerCase())
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

      {/* Password Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Password-sikkerhed
          </CardTitle>
          <CardDescription>
            Tving medarbejdere til at skifte til en stærkere adgangskode ved næste login
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Aktive medarbejdere</p>
              <p className="text-2xl font-bold">{passwordStats?.total || 0}</p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Afventer password-ændring</p>
              <p className="text-2xl font-bold text-amber-600">{passwordStats?.mustChange || 0}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  Tving alle til at skifte password
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tving alle til at skifte password?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Alle {passwordStats?.total || 0} aktive medarbejdere vil blive bedt om at vælge en ny, 
                    stærkere adgangskode ved næste login. Denne handling kan ikke fortrydes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => forcePasswordResetMutation.mutate("all")}
                    disabled={forcePasswordResetMutation.isPending}
                  >
                    {forcePasswordResetMutation.isPending ? "Opdaterer..." : "Bekræft"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-2">
              <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vælg stilling" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" disabled>Vælg stilling...</SelectItem>
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="secondary" 
                    disabled={selectedPositionId === "all"}
                    className="gap-2"
                  >
                    <KeyRound className="h-4 w-4" />
                    Tving stilling
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tving stillingen til at skifte password?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Alle aktive medarbejdere i den valgte stilling vil blive bedt om at vælge en ny, 
                      stærkere adgangskode ved næste login.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => forcePasswordResetMutation.mutate("position")}
                      disabled={forcePasswordResetMutation.isPending}
                    >
                      {forcePasswordResetMutation.isPending ? "Opdaterer..." : "Bekræft"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Trusted IP Ranges Card */}
      <TrustedIpRangesCard 
        newIpName={newIpName}
        setNewIpName={setNewIpName}
        newIpRange={newIpRange}
        setNewIpRange={setNewIpRange}
        newIpDescription={newIpDescription}
        setNewIpDescription={setNewIpDescription}
      />

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
          <TabsTrigger value="mfa" className="gap-2">
            <Smartphone className="h-4 w-4" />
            MFA
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

        <TabsContent value="mfa" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn eller email..."
                value={mfaSearchTerm}
                onChange={(e) => setMfaSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary" className="gap-1">
              <Smartphone className="h-3 w-3" />
              {mfaEnabledCount} med MFA
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>MFA Administration</CardTitle>
              <CardDescription>
                Nulstil MFA for medarbejdere der har problemer med deres authenticator-app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medarbejder</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMfa ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Indlæser...
                      </TableCell>
                    </TableRow>
                  ) : filteredMfaEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {mfaSearchTerm ? "Ingen medarbejdere matcher søgningen" : "Ingen aktive medarbejdere fundet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMfaEmployees.map((emp) => {
                      const email = emp.work_email || emp.private_email || "";
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">
                            {emp.first_name} {emp.last_name}
                          </TableCell>
                          <TableCell>{email}</TableCell>
                          <TableCell>
                            {emp.mfa_enabled ? (
                              <Badge variant="default" className="gap-1">
                                <Smartphone className="h-3 w-3" />
                                MFA aktiv
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                Ikke opsat
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <AlertDialog open={resettingMfaFor === emp.id} onOpenChange={(open) => !open && setResettingMfaFor(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResettingMfaFor(emp.id)}
                                >
                                  {emp.mfa_enabled ? "Nulstil MFA" : "Ryd MFA-data"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Nulstil MFA for {emp.first_name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Dette vil fjerne alle MFA-faktorer for {emp.first_name} {emp.last_name}. 
                                    De vil blive bedt om at opsætte MFA igen ved næste login.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => resetMfaMutation.mutate(email)}
                                    disabled={resetMfaMutation.isPending}
                                  >
                                    {resetMfaMutation.isPending ? "Nulstiller..." : "Nulstil MFA"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate component for Trusted IP Ranges
function TrustedIpRangesCard({
  newIpName,
  setNewIpName,
  newIpRange,
  setNewIpRange,
  newIpDescription,
  setNewIpDescription,
}: {
  newIpName: string;
  setNewIpName: (v: string) => void;
  newIpRange: string;
  setNewIpRange: (v: string) => void;
  newIpDescription: string;
  setNewIpDescription: (v: string) => void;
}) {
  const queryClient = useQueryClient();

  // Fetch global trusted IP ranges
  const { data: trustedIpRanges = [], isLoading } = useQuery({
    queryKey: ["global-trusted-ip-ranges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trusted_ip_ranges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrustedIpRange[];
    },
  });

  // Add IP range mutation
  const addMutation = useMutation({
    mutationFn: async (data: { name: string; ip_range: string; description: string }) => {
      const { error } = await supabase.from("trusted_ip_ranges").insert({
        name: data.name,
        ip_range: data.ip_range,
        description: data.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-trusted-ip-ranges"] });
      setNewIpName("");
      setNewIpRange("");
      setNewIpDescription("");
      toast.success("IP-range tilføjet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke tilføje IP-range: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("trusted_ip_ranges")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-trusted-ip-ranges"] });
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke opdatere: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trusted_ip_ranges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-trusted-ip-ranges"] });
      toast.success("IP-range slettet");
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke slette: " + error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Globale betroede IP-adresser
        </CardTitle>
        <CardDescription>
          IP-adresser der automatisk springer MFA over for alle stillinger.
          Understøtter enkelt IP, CIDR-notation (f.eks. 82.103.140.0/24), eller wildcard (f.eks. 82.103.*.*).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing IP ranges */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Indlæser...</p>
        ) : trustedIpRanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen globale IP-adresser konfigureret</p>
        ) : (
          <div className="space-y-2">
            {trustedIpRanges.map((range) => (
              <div
                key={range.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Switch
                    checked={range.is_active}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: range.id, is_active: checked })
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{range.name}</span>
                      {!range.is_active && (
                        <Badge variant="secondary" className="text-xs">Deaktiveret</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                        {range.ip_range}
                      </code>
                      {range.description && (
                        <span>• {range.description}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Er du sikker på at du vil slette denne IP-range?")) {
                      deleteMutation.mutate(range.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new IP range */}
        <div className="border-t pt-4 space-y-4">
          <h4 className="text-sm font-medium">Tilføj ny IP-adresse</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Navn *</Label>
              <Input
                placeholder="F.eks. Hovedkontor"
                value={newIpName}
                onChange={(e) => setNewIpName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">IP/CIDR *</Label>
              <Input
                placeholder="F.eks. 82.103.140.0/24"
                value={newIpRange}
                onChange={(e) => setNewIpRange(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Beskrivelse</Label>
              <Input
                placeholder="Valgfri beskrivelse"
                value={newIpDescription}
                onChange={(e) => setNewIpDescription(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={() => {
              if (newIpName.trim() && newIpRange.trim()) {
                addMutation.mutate({
                  name: newIpName.trim(),
                  ip_range: newIpRange.trim(),
                  description: newIpDescription.trim(),
                });
              }
            }}
            disabled={!newIpName.trim() || !newIpRange.trim() || addMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tilføj IP-adresse
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
