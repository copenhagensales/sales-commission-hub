import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { PERMISSION_KEYS } from "@/config/permissionKeys";
import {
  useAllUserPagePermissions,
  useDeleteUserPagePermission,
  useEmployeeAuthOptions,
  useUpsertUserPagePermission,
  type UserPermissionMode,
} from "@/hooks/useUserPagePermissions";

const permissionOptions = Object.entries(PERMISSION_KEYS)
  .map(([key, def]) => ({ key, label: (def as { label: string }).label }))
  .sort((a, b) => a.label.localeCompare(b.label, "da"));

const permissionLabel = (key: string) =>
  (PERMISSION_KEYS as Record<string, { label: string } | undefined>)[key]?.label || key;

/**
 * Per-bruger undtagelser: giv eller fjern en enkelt rettighed for én person.
 * Rækkefølge: personlig blokering > personlig tildeling > rollens rettighed.
 */
export function UserPermissionOverrides() {
  const { data: overrides, isLoading } = useAllUserPagePermissions();
  const { data: employees } = useEmployeeAuthOptions();
  const upsert = useUpsertUserPagePermission();
  const remove = useDeleteUserPagePermission();

  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [permissionKey, setPermissionKey] = useState("");
  const [mode, setMode] = useState<UserPermissionMode>("grant");
  const [canEdit, setCanEdit] = useState(true);

  const filteredEmployees = useMemo(() => {
    const list = employees || [];
    const q = search.trim().toLowerCase();
    if (q.length < 2) return list.slice(0, 50);
    return list
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [employees, search]);

  const handleSave = async () => {
    if (!userId || !permissionKey) {
      toast.error("Vælg både medarbejder og rettighed");
      return;
    }
    try {
      await upsert.mutateAsync({ userId, permissionKey, mode, canEdit });
      toast.success("Undtagelsen er gemt");
      setPermissionKey("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme undtagelsen");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Undtagelsen er fjernet");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke fjerne undtagelsen");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Undtagelser pr. medarbejder
          </CardTitle>
          <CardDescription>
            Giv eller fjern en enkelt rettighed for én person — uden at ændre hele rollen. En
            personlig blokering vinder over rollens rettighed, og en personlig tildeling giver
            adgang selv når rollen ikke har den.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Søg medarbejder</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Skriv navn eller mail (min. 2 tegn)"
              />
            </div>
            <div className="space-y-2">
              <Label>Medarbejder</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg medarbejder" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredEmployees.map((e) => (
                    <SelectItem key={e.authUserId} value={e.authUserId}>
                      {e.name}
                      {e.jobTitle ? ` — ${e.jobTitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rettighed</Label>
              <Select value={permissionKey} onValueChange={setPermissionKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg rettighed" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {permissionOptions.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as UserPermissionMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">Giv adgang</SelectItem>
                  <SelectItem value="deny">Bloker adgang</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "grant" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="user-perm-can-edit"
                checked={canEdit}
                onCheckedChange={(v) => setCanEdit(v === true)}
              />
              <Label htmlFor="user-perm-can-edit" className="font-normal">
                Må også rette (ikke kun se)
              </Label>
            </div>
          )}

          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gem undtagelse
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktive undtagelser</CardTitle>
          <CardDescription>
            Ændringer slår igennem, når personen indlæser systemet næste gang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (overrides || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Der er ingen undtagelser endnu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbejder</TableHead>
                  <TableHead>Rettighed</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(overrides || []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.employeeName}</div>
                      {o.employeeEmail && (
                        <div className="text-xs text-muted-foreground">{o.employeeEmail}</div>
                      )}
                    </TableCell>
                    <TableCell>{permissionLabel(o.permission_key)}</TableCell>
                    <TableCell>
                      <Badge variant={o.mode === "deny" ? "destructive" : "default"}>
                        {o.mode === "deny" ? "Blokeret" : "Tildelt"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.mode === "deny" ? "—" : o.can_edit ? "Se og rette" : "Kun se"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(o.id)}
                        disabled={remove.isPending}
                        aria-label="Fjern undtagelse"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
