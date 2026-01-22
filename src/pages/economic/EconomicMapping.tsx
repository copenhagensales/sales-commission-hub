import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wand2, AlertTriangle, Check, Plus, Trash2, Search } from "lucide-react";
import { 
  useEconomicKategorier, 
  useEconomicKontoMapping, 
  useEconomicFordelingsregler,
  useEconomicKontoplan,
  useTeams, 
  useUpdateKontoMapping,
  useAutoSuggestMapping,
  useCreateFordelingsregel,
  EconomicKategori,
} from "@/hooks/useEconomicData";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function EconomicMapping() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [showNeedsReview, setShowNeedsReview] = useState(false);
  
  const { data: kategorier } = useEconomicKategorier();
  const { data: kontoMapping, refetch: refetchMapping } = useEconomicKontoMapping();
  const { data: fordelingsregler, refetch: refetchRegler } = useEconomicFordelingsregler();
  const { data: kontoplan } = useEconomicKontoplan();
  const { data: teams } = useTeams();
  const updateMapping = useUpdateKontoMapping();
  const autoSuggest = useAutoSuggestMapping();
  const createRegel = useCreateFordelingsregel();
  
  // Build konto list with mapping info
  const kontoList = useMemo(() => {
    if (!kontoplan) return [];
    
    const mappingByKonto = new Map(kontoMapping?.map(m => [m.konto_nr, m]) || []);
    
    return kontoplan.map(k => {
      const mapping = mappingByKonto.get(k.konto_nr);
      const kategori = kategorier?.find(kat => kat.id === mapping?.kategori_id);
      const team = teams?.find(t => t.id === mapping?.team_id);
      
      return {
        konto_nr: k.konto_nr,
        navn: k.navn,
        type: k.type,
        kategori: kategori?.navn || null,
        kategori_id: mapping?.kategori_id || null,
        team: team?.name || null,
        team_id: mapping?.team_id || null,
        is_auto_suggested: mapping?.is_auto_suggested || false,
        needs_review: mapping?.needs_review || !mapping,
      };
    }).filter(k => {
      if (searchTerm && !k.navn.toLowerCase().includes(searchTerm.toLowerCase()) && !k.konto_nr.toString().includes(searchTerm)) {
        return false;
      }
      if (showUnmapped && k.kategori) return false;
      if (showNeedsReview && !k.needs_review) return false;
      return true;
    });
  }, [kontoplan, kontoMapping, kategorier, teams, searchTerm, showUnmapped, showNeedsReview]);
  
  // Run auto-suggest
  const handleAutoSuggest = async () => {
    try {
      const count = await autoSuggest.mutateAsync();
      toast.success(`Auto-mapping foreslog ${count} konti`);
      refetchMapping();
    } catch (error) {
      toast.error("Fejl ved auto-mapping");
    }
  };
  
  // Delete a regel
  const handleDeleteRegel = async (id: string) => {
    try {
      await supabase.from("economic_fordelingsregler").delete().eq("id", id);
      toast.success("Regel slettet");
      refetchRegler();
    } catch (error) {
      toast.error("Kunne ikke slette regel");
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mapping & Regler</h1>
          <p className="text-muted-foreground">Administrer kategorier og fordelingsregler</p>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="konti" className="space-y-4">
        <TabsList>
          <TabsTrigger value="konti">Konti ({kontoList.length})</TabsTrigger>
          <TabsTrigger value="regler">Fordelingsregler ({fordelingsregler?.length || 0})</TabsTrigger>
          <TabsTrigger value="kategorier">Kategorier ({kategorier?.length || 0})</TabsTrigger>
        </TabsList>
        
        {/* Konti Tab */}
        <TabsContent value="konti">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Konto-mapping</CardTitle>
                  <CardDescription>Tildel kategorier og teams til konti</CardDescription>
                </div>
                <Button onClick={handleAutoSuggest} disabled={autoSuggest.isPending}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Auto-forslag
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i konti..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showUnmapped} onCheckedChange={setShowUnmapped} />
                  <Label>Kun umappede</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showNeedsReview} onCheckedChange={setShowNeedsReview} />
                  <Label>Behøver gennemgang</Label>
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Konto</TableHead>
                      <TableHead>Kontonavn</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kontoList.slice(0, 100).map((konto) => (
                      <TableRow key={konto.konto_nr}>
                        <TableCell className="font-mono">{konto.konto_nr}</TableCell>
                        <TableCell>{konto.navn}</TableCell>
                        <TableCell>
                          <Select
                            value={konto.kategori_id || "none"}
                            onValueChange={(value) => {
                              if (value !== "none") {
                                updateMapping.mutate({
                                  konto_nr: konto.konto_nr,
                                  kategori_id: value,
                                  team_id: konto.team_id || undefined,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Vælg kategori..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen</SelectItem>
                              {kategorier?.map((kat) => (
                                <SelectItem key={kat.id} value={kat.id}>{kat.navn}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={konto.team_id || "none"}
                            onValueChange={(value) => {
                              if (konto.kategori_id) {
                                updateMapping.mutate({
                                  konto_nr: konto.konto_nr,
                                  kategori_id: konto.kategori_id,
                                  team_id: value === "none" ? undefined : value,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Vælg team..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Standard</SelectItem>
                              {teams?.map((team) => (
                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {konto.needs_review ? (
                            <Badge variant="outline" className="text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Gennemgå
                            </Badge>
                          ) : konto.is_auto_suggested ? (
                            <Badge variant="outline" className="text-blue-600">
                              <Wand2 className="h-3 w-3 mr-1" />
                              Auto
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {kontoList.length > 100 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Viser 100 af {kontoList.length} konti. Brug søg for at finde specifikke konti.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Regler Tab */}
        <TabsContent value="regler">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fordelingsregler</CardTitle>
                  <CardDescription>Regler der overskriver konto-mapping baseret på posteringstekst</CardDescription>
                </div>
                <NewRegelDialog kategorier={kategorier || []} teams={teams || []} onCreate={() => refetchRegler()} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioritet</TableHead>
                    <TableHead>Match felt</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>Værdi</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Ramt</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fordelingsregler?.map((regel) => {
                    const kategori = kategorier?.find(k => k.id === regel.kategori_id);
                    const team = teams?.find(t => t.id === regel.team_id);
                    
                    return (
                      <TableRow key={regel.id}>
                        <TableCell className="font-mono">{regel.priority}</TableCell>
                        <TableCell>{regel.match_field}</TableCell>
                        <TableCell>{regel.match_operator}</TableCell>
                        <TableCell className="font-mono">{regel.match_value}</TableCell>
                        <TableCell>{kategori?.navn || "-"}</TableCell>
                        <TableCell>{team?.name || "Standard"}</TableCell>
                        <TableCell>{regel.affected_count}</TableCell>
                        <TableCell>
                          <Badge variant={regel.is_active ? "default" : "secondary"}>
                            {regel.is_active ? "Ja" : "Nej"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteRegel(regel.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Kategorier Tab */}
        <TabsContent value="kategorier">
          <Card>
            <CardHeader>
              <CardTitle>Kategorier</CardTitle>
              <CardDescription>De 12 udgiftskategorier</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr</TableHead>
                    <TableHead>Navn</TableHead>
                    <TableHead>Beskrivelse</TableHead>
                    <TableHead>Standard team</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kategorier?.map((kat) => {
                    const defaultTeam = teams?.find(t => t.id === kat.default_team_id);
                    return (
                      <TableRow key={kat.id}>
                        <TableCell>{kat.sort_order}</TableCell>
                        <TableCell className="font-medium">{kat.navn}</TableCell>
                        <TableCell className="text-muted-foreground">{kat.beskrivelse}</TableCell>
                        <TableCell>{defaultTeam?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={kat.is_expense ? "destructive" : "default"}>
                            {kat.is_expense ? "Udgift" : "Indtægt"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Dialog for creating new regel
function NewRegelDialog({ 
  kategorier, 
  teams,
  onCreate,
}: { 
  kategorier: EconomicKategori[];
  teams: { id: string; name: string }[];
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("50");
  const [matchField, setMatchField] = useState<"tekst" | "leverandoer_nr" | "kunde_nr" | "konto_nr">("tekst");
  const [matchOperator, setMatchOperator] = useState<"contains" | "equals">("contains");
  const [matchValue, setMatchValue] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [teamId, setTeamId] = useState("");
  
  const createRegel = useCreateFordelingsregel();
  
  const handleSubmit = async () => {
    if (!matchValue || !kategoriId) {
      toast.error("Udfyld alle påkrævede felter");
      return;
    }
    
    try {
      await createRegel.mutateAsync({
        priority: parseInt(priority),
        match_field: matchField,
        match_operator: matchOperator,
        match_value: matchValue.toLowerCase(),
        kategori_id: kategoriId,
        team_id: teamId || null,
        active_from: "2000-01-01",
        active_to: "2099-12-31",
        note: null,
        is_active: true,
      });
      toast.success("Regel oprettet!");
      setOpen(false);
      onCreate();
    } catch (error) {
      toast.error("Kunne ikke oprette regel");
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ny regel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opret ny fordelingsregel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioritet</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <div>
              <Label>Match felt</Label>
              <Select value={matchField} onValueChange={(v: any) => setMatchField(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tekst">Tekst</SelectItem>
                  <SelectItem value="leverandoer_nr">Leverandør nr.</SelectItem>
                  <SelectItem value="kunde_nr">Kunde nr.</SelectItem>
                  <SelectItem value="konto_nr">Konto nr.</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Operator</Label>
              <Select value={matchOperator} onValueChange={(v: any) => setMatchOperator(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Indeholder</SelectItem>
                  <SelectItem value="equals">Lig med</SelectItem>
                  <SelectItem value="starts_with">Starter med</SelectItem>
                  <SelectItem value="ends_with">Slutter med</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Værdi</Label>
              <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="fx 'adversus'" />
            </div>
          </div>
          
          <div>
            <Label>Kategori *</Label>
            <Select value={kategoriId} onValueChange={setKategoriId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kategori..." />
              </SelectTrigger>
              <SelectContent>
                {kategorier.map((kat) => (
                  <SelectItem key={kat.id} value={kat.id}>{kat.navn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Team (valgfrit)</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Standard fra kategori..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Standard</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button className="w-full" onClick={handleSubmit} disabled={createRegel.isPending}>
            Opret regel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
