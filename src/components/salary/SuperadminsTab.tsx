import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, ShieldOff, UserPlus } from "lucide-react";

interface SuperadminRow {
  id: string;
  email: string;
  is_active: boolean;
  granted_at: string | null;
  notes: string | null;
}

/**
 * Superadmins administreres som DATA — ikke i kildekoden.
 *
 * Databasen (RLS på `superadmins`) tillader kun en superadmin at tildele eller
 * fjerne rollen. En `ejer` kan altså ikke give sig selv adgang, heller ikke ved
 * at kalde API'et direkte.
 */
export function SuperadminsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { data: superadmins = [], isLoading } = useQuery({
    queryKey: ["superadmins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("superadmins")
        .select("id, email, is_active, granted_at, notes")
        .order("email");
      if (error) throw error;
      return (data ?? []) as SuperadminRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned.includes("@")) throw new Error("Angiv en gyldig e-mail");
      const { error } = await supabase.from("superadmins").insert({
        email: cleaned,
        notes: notes.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      queryClient.invalidateQueries({ queryKey: ["is-superadmin"] });
      setEmail("");
      setNotes("");
      toast({ title: "Superadmin tilføjet" });
    },
    onError: (error: Error) => {
      toast({ title: "Kunne ikke tilføje", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("superadmins")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmins"] });
      queryClient.invalidateQueries({ queryKey: ["is-superadmin"] });
      toast({ title: "Adgang opdateret" });
    },
    onError: (error: Error) => {
      toast({ title: "Kunne ikke opdatere", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Superadmins
          </CardTitle>
          <CardDescription>
            Superadmins er de eneste, der kan se løntal for stab, teamledere og assistenter samt
            hele DB-/overskudsberegningen. Adgangen håndhæves i databasen — ikke kun i menuen.
            Kun en superadmin kan tildele eller fjerne rollen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="superadmin-email">E-mail</Label>
              <Input
                id="superadmin-email"
                type="email"
                placeholder="navn@copenhagensales.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="superadmin-notes">Note (valgfri)</Label>
              <Input
                id="superadmin-notes"
                placeholder="Fx årsag til adgang"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !email.trim()}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span className="ml-2">Tilføj</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {superadmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ingen superadmins
                    </TableCell>
                  </TableRow>
                ) : (
                  superadmins.map((sa) => (
                    <TableRow key={sa.id}>
                      <TableCell className="font-medium">{sa.email}</TableCell>
                      <TableCell>
                        <Badge variant={sa.is_active ? "default" : "secondary"}>
                          {sa.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sa.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleMutation.mutate({ id: sa.id, isActive: !sa.is_active })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          {sa.is_active ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Fjern adgang
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" />
                              Giv adgang
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
