import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, RefreshCw, Save, ArrowRight, Ban } from "lucide-react";
import { toast } from "sonner";
import type { FieldDefinition } from "./FieldDefinitionsManager";

interface Integration {
  id: string;
  name: string;
  provider: string;
}

interface FieldMapping {
  id?: string;
  integration_id: string;
  source_field_path: string;
  target_field_id: string | null;
  is_excluded: boolean;
  sample_value: string | null;
  transform_rule: Record<string, unknown> | null;
}

interface SampleField {
  fieldId: string;
  label: string;
  sampleValue: string;
}

export function IntegrationMappingEditor() {
  const queryClient = useQueryClient();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [localMappings, setLocalMappings] = useState<Map<string, FieldMapping>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [fetchingSamples, setFetchingSamples] = useState(false);
  const [sampleFields, setSampleFields] = useState<SampleField[]>([]);

  // Fetch integrations
  const { data: integrations = [], isLoading: loadingIntegrations } = useQuery({
    queryKey: ["dialer-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Integration[];
    },
  });

  // Fetch field definitions
  const { data: fieldDefinitions = [] } = useQuery({
    queryKey: ["data-field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_field_definitions")
        .select("*")
        .order("category")
        .order("display_name");
      if (error) throw error;
      return data as FieldDefinition[];
    },
  });

  // Fetch existing mappings for selected integration
  const { data: existingMappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["integration-field-mappings", selectedIntegrationId],
    queryFn: async () => {
      if (!selectedIntegrationId) return [];
      const { data, error } = await supabase
        .from("integration_field_mappings")
        .select("*")
        .eq("integration_id", selectedIntegrationId);
      if (error) throw error;
      return data as FieldMapping[];
    },
    enabled: !!selectedIntegrationId,
  });

  // Initialize local mappings when existing mappings change
  useMemo(() => {
    if (existingMappings.length > 0 || sampleFields.length > 0) {
      const mappingsMap = new Map<string, FieldMapping>();
      
      // Add existing mappings
      existingMappings.forEach((m) => {
        mappingsMap.set(m.source_field_path, m);
      });

      // Add sample fields that don't have mappings yet
      sampleFields.forEach((sf) => {
        if (!mappingsMap.has(sf.fieldId)) {
          mappingsMap.set(sf.fieldId, {
            integration_id: selectedIntegrationId!,
            source_field_path: sf.fieldId,
            target_field_id: null,
            is_excluded: false,
            sample_value: sf.sampleValue,
            transform_rule: null,
          });
        } else {
          // Update sample value
          const existing = mappingsMap.get(sf.fieldId)!;
          existing.sample_value = sf.sampleValue;
        }
      });

      setLocalMappings(mappingsMap);
      setHasChanges(false);
    }
  }, [existingMappings, sampleFields, selectedIntegrationId]);

  const fetchSampleFields = async () => {
    if (!selectedIntegrationId) return;
    
    const integration = integrations.find((i) => i.id === selectedIntegrationId);
    if (!integration) return;

    setFetchingSamples(true);
    try {
      const { data, error } = await supabase.functions.invoke("integration-engine", {
        body: {
          action: "fetch-sample-fields",
          integrationId: selectedIntegrationId,
        },
      });

      if (error) throw error;
      if (data?.fields) {
        setSampleFields(data.fields as SampleField[]);
        toast.success(`Hentet ${data.fields.length} felter fra API`);
      }
    } catch (err) {
      toast.error("Kunne ikke hente sample-felter fra API");
      console.error(err);
    } finally {
      setFetchingSamples(false);
    }
  };

  const updateLocalMapping = (sourcePath: string, updates: Partial<FieldMapping>) => {
    setLocalMappings((prev) => {
      const next = new Map(prev);
      const existing = next.get(sourcePath);
      if (existing) {
        next.set(sourcePath, { ...existing, ...updates });
      }
      return next;
    });
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIntegrationId) return;

      const mappingsToSave = Array.from(localMappings.values()).filter(
        (m) => m.target_field_id || m.is_excluded
      );

      // Upsert all mappings one by one
      for (const mapping of mappingsToSave) {
        const payload = {
          integration_id: mapping.integration_id,
          source_field_path: mapping.source_field_path,
          target_field_id: mapping.target_field_id,
          is_excluded: mapping.is_excluded,
          sample_value: mapping.sample_value,
        };
        
        // Check if exists first
        const { data: existing } = await supabase
          .from("integration_field_mappings")
          .select("id")
          .eq("integration_id", mapping.integration_id)
          .eq("source_field_path", mapping.source_field_path)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from("integration_field_mappings")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("integration_field_mappings")
            .insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Mappings gemt");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["integration-field-mappings", selectedIntegrationId] });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke gemme: ${error.message}`);
    },
  });

  const selectedIntegration = integrations.find((i) => i.id === selectedIntegrationId);
  const mappingsArray = Array.from(localMappings.values());

  const groupedDefinitions = useMemo(() => {
    const grouped: Record<string, FieldDefinition[]> = {};
    fieldDefinitions.forEach((fd) => {
      if (!grouped[fd.category]) grouped[fd.category] = [];
      grouped[fd.category].push(fd);
    });
    return grouped;
  }, [fieldDefinitions]);

  const categoryLabels: Record<string, string> = {
    customer: "Kunde",
    sale: "Salg",
    employee: "Medarbejder",
    campaign: "Kampagne",
    product: "Produkt",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">API Feltmapping</CardTitle>
        <CardDescription>
          Map felter fra eksterne API'er til standarddefinitioner
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <Select
              value={selectedIntegrationId ?? ""}
              onValueChange={(v) => {
                setSelectedIntegrationId(v || null);
                setSampleFields([]);
                setLocalMappings(new Map());
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg integration..." />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((int) => (
                  <SelectItem key={int.id} value={int.id}>
                    {int.name} ({int.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIntegrationId && (
            <Button
              variant="outline"
              onClick={fetchSampleFields}
              disabled={fetchingSamples}
            >
              {fetchingSamples ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Hent sample-felter
            </Button>
          )}

          {hasChanges && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Gem mapping
            </Button>
          )}
        </div>

        {loadingIntegrations || loadingMappings ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Indlæser...
          </div>
        ) : !selectedIntegrationId ? (
          <div className="text-center py-12 text-muted-foreground">
            Vælg en integration for at konfigurere feltmapping
          </div>
        ) : mappingsArray.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Ingen felter fundet.</p>
            <p className="text-sm mt-2">Klik "Hent sample-felter" for at hente felter fra API'en</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">API-felt (kilde)</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[220px]">Standard felt</TableHead>
                  <TableHead className="w-[80px] text-center">Ignorer</TableHead>
                  <TableHead className="w-[200px]">Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingsArray.map((mapping) => (
                  <TableRow
                    key={mapping.source_field_path}
                    className={mapping.is_excluded ? "opacity-50 bg-muted/20" : ""}
                  >
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {mapping.source_field_path}
                      </code>
                    </TableCell>
                    <TableCell>
                      {mapping.is_excluded ? (
                        <Ban className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping.target_field_id ?? "none"}
                        onValueChange={(v) =>
                          updateLocalMapping(mapping.source_field_path, {
                            target_field_id: v === "none" ? null : v,
                            is_excluded: false,
                          })
                        }
                        disabled={mapping.is_excluded}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Vælg felt..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Ingen mapping</span>
                          </SelectItem>
                          {Object.entries(groupedDefinitions).map(([category, fields]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                {categoryLabels[category]}
                              </div>
                              {fields.map((fd) => (
                                <SelectItem key={fd.id} value={fd.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{fd.display_name}</span>
                                    {fd.is_pii && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                                        PII
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={mapping.is_excluded}
                        onCheckedChange={(checked) =>
                          updateLocalMapping(mapping.source_field_path, {
                            is_excluded: checked === true,
                            target_field_id: checked ? null : mapping.target_field_id,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {mapping.sample_value && (
                        <span className="text-sm text-muted-foreground truncate block max-w-[180px]">
                          "{mapping.sample_value}"
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
