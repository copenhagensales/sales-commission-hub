import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Phone, CheckCircle2, Send, CalendarClock, UserMinus, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const WEEKDAYS = [
  { day: 1, name: "Mandag" },
  { day: 2, name: "Tirsdag" },
  { day: 3, name: "Onsdag" },
  { day: 4, name: "Torsdag" },
  { day: 5, name: "Fredag" },
];

interface ClosingShift {
  id: string;
  weekday: number;
  employee_name: string | null;
  email: string | null;
  phone: string | null;
  tasks: string | null;
}

interface WeekendCleanupConfig {
  id: string;
  tasks: string | null;
  recipients: string | null;
  send_time: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface DeactivationConfig {
  id: string;
  team_id: string;
  recipients: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
}

export default function ClosingShifts() {
  const queryClient = useQueryClient();
  const [editingShifts, setEditingShifts] = useState<Record<number, Partial<ClosingShift>>>({});
  const [editingTasks, setEditingTasks] = useState<string | null>(null);
  const [tasksChanged, setTasksChanged] = useState(false);
  
  // Weekend cleanup state
  const [editingWeekendTasks, setEditingWeekendTasks] = useState<string | null>(null);
  const [editingWeekendRecipients, setEditingWeekendRecipients] = useState<string | null>(null);
  const [weekendTasksChanged, setWeekendTasksChanged] = useState(false);
  const [weekendRecipientsChanged, setWeekendRecipientsChanged] = useState(false);
  
  // Deactivation reminder state
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [editingDeactivationRecipients, setEditingDeactivationRecipients] = useState<string | null>(null);
  const [editingDeactivationBody, setEditingDeactivationBody] = useState<string | null>(null);
  const [deactivationChanged, setDeactivationChanged] = useState(false);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["closing-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closing_shifts")
        .select("*")
        .order("weekday");
      if (error) throw error;
      return data as ClosingShift[];
    },
  });

  const { data: weekendConfig, isLoading: weekendLoading } = useQuery({
    queryKey: ["weekend-cleanup-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekend_cleanup_config")
        .select("*")
        .single();
      if (error) throw error;
      return data as WeekendCleanupConfig;
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-for-deactivation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const { data: deactivationConfigs = [] } = useQuery({
    queryKey: ["deactivation-reminder-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deactivation_reminder_config")
        .select("*");
      if (error) throw error;
      return data as DeactivationConfig[];
    },
  });
  const currentTasks = editingTasks ?? shifts?.find(s => s.weekday === 1)?.tasks ?? "";
  const currentWeekendTasks = editingWeekendTasks ?? weekendConfig?.tasks ?? "";
  const currentWeekendRecipients = editingWeekendRecipients ?? weekendConfig?.recipients ?? "";
  
  // Get selected team's config
  const selectedTeamConfig = deactivationConfigs.find(c => c.team_id === selectedTeamId);
  const currentDeactivationRecipients = editingDeactivationRecipients ?? selectedTeamConfig?.recipients ?? "";
  const currentDeactivationBody = editingDeactivationBody ?? selectedTeamConfig?.email_body ?? "";

  const updateShiftMutation = useMutation({
    mutationFn: async ({ weekday, updates }: { weekday: number; updates: Partial<ClosingShift> }) => {
      const { error } = await supabase
        .from("closing_shifts")
        .update(updates)
        .eq("weekday", weekday);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-shifts"] });
      toast.success("Lukkevagt opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere lukkevagt");
    },
  });

  const updateTasksMutation = useMutation({
    mutationFn: async (tasks: string) => {
      const { error } = await supabase
        .from("closing_shifts")
        .update({ tasks })
        .eq("weekday", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-shifts"] });
      toast.success("Tjekliste opdateret");
      setEditingTasks(null);
      setTasksChanged(false);
    },
    onError: () => {
      toast.error("Kunne ikke opdatere tjekliste");
    },
  });

  const updateWeekendConfigMutation = useMutation({
    mutationFn: async (updates: Partial<WeekendCleanupConfig>) => {
      const { error } = await supabase
        .from("weekend_cleanup_config")
        .update(updates)
        .eq("id", weekendConfig?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekend-cleanup-config"] });
      toast.success("Weekend oprydning opdateret");
      setEditingWeekendTasks(null);
      setEditingWeekendRecipients(null);
      setWeekendTasksChanged(false);
      setWeekendRecipientsChanged(false);
    },
    onError: () => {
      toast.error("Kunne ikke opdatere weekend oprydning");
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (shift: ClosingShift) => {
      const tasksArray = currentTasks.split("\n").filter(t => t.trim());
      const { error } = await supabase.functions.invoke("send-closing-reminder", {
        body: {
          employeeName: shift.employee_name,
          email: shift.email,
          phone: shift.phone,
          tasks: tasksArray,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Påmindelse sendt!");
    },
    onError: (err: any) => {
      toast.error("Kunne ikke sende påmindelse: " + (err.message || "Ukendt fejl"));
    },
  });

  const sendWeekendReminderMutation = useMutation({
    mutationFn: async () => {
      const tasksArray = currentWeekendTasks.split("\n").filter(t => t.trim());
      const recipientsArray = currentWeekendRecipients.split(",").map(e => e.trim()).filter(e => e);
      
      if (recipientsArray.length === 0) {
        throw new Error("Ingen modtagere angivet");
      }
      
      const { error } = await supabase.functions.invoke("send-weekend-cleanup", {
        body: {
          recipients: recipientsArray,
          tasks: tasksArray,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Weekend oprydnings-mail sendt!");
    },
    onError: (err: any) => {
      toast.error("Kunne ikke sende weekend mail: " + (err.message || "Ukendt fejl"));
    },
  });

  const updateDeactivationConfigMutation = useMutation({
    mutationFn: async ({ teamId, updates }: { teamId: string; updates: Partial<DeactivationConfig> }) => {
      const { error } = await supabase
        .from("deactivation_reminder_config")
        .update(updates)
        .eq("team_id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deactivation-reminder-configs"] });
      toast.success("Deaktiverings-skabelon opdateret");
      setEditingDeactivationRecipients(null);
      setEditingDeactivationBody(null);
      setDeactivationChanged(false);
    },
    onError: () => {
      toast.error("Kunne ikke opdatere deaktiverings-skabelon");
    },
  });

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setEditingDeactivationRecipients(null);
    setEditingDeactivationBody(null);
    setDeactivationChanged(false);
  };

  const handleSendReminder = (shift: ClosingShift) => {
    if (!shift.email && !shift.phone) {
      toast.error("Ingen email eller telefon angivet");
      return;
    }
    if (!shift.employee_name) {
      toast.error("Intet navn angivet");
      return;
    }
    sendReminderMutation.mutate(shift);
  };

  const handleInputChange = (weekday: number, field: keyof ClosingShift, value: string) => {
    setEditingShifts((prev) => ({
      ...prev,
      [weekday]: {
        ...prev[weekday],
        [field]: value,
      },
    }));
  };

  const handleSave = (weekday: number) => {
    const updates = editingShifts[weekday];
    if (updates) {
      updateShiftMutation.mutate({ weekday, updates });
      setEditingShifts((prev) => {
        const next = { ...prev };
        delete next[weekday];
        return next;
      });
    }
  };

  const getValue = (shift: ClosingShift, field: keyof ClosingShift): string => {
    const editing = editingShifts[shift.weekday];
    if (editing && field in editing) {
      return (editing[field] as string) || "";
    }
    return (shift[field] as string) || "";
  };

  const hasChanges = (weekday: number) => {
    return !!editingShifts[weekday] && Object.keys(editingShifts[weekday]).length > 0;
  };

  if (isLoading || weekendLoading) {
    return (
      <MainLayout>
        <div className="p-6">Indlæser...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lukkevagter & Påmindelser</h1>
          <p className="text-muted-foreground mt-1">
            Administrer lukkevagter og email-skabeloner
          </p>
        </div>

        <Tabs defaultValue="closing" className="space-y-6">
          <TabsList>
            <TabsTrigger value="closing" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Lukkevagter
            </TabsTrigger>
            <TabsTrigger value="deactivation" className="flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              Deaktivering
            </TabsTrigger>
          </TabsList>

          <TabsContent value="closing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Tjekliste ved lukning
                </CardTitle>
                <CardDescription>
                  Denne liste sendes med påmindelsen kl. 16:00 (én opgave per linje)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={currentTasks}
                  onChange={(e) => {
                    setEditingTasks(e.target.value);
                    setTasksChanged(true);
                  }}
                  placeholder="Skriv opgaver her (én per linje)"
                  rows={5}
                  className="resize-none"
                />
                {tasksChanged && (
                  <Button
                    size="sm"
                    onClick={() => updateTasksMutation.mutate(currentTasks)}
                    disabled={updateTasksMutation.isPending}
                  >
                    Gem tjekliste
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {WEEKDAYS.map((weekday) => {
                const shift = shifts?.find((s) => s.weekday === weekday.day);
                if (!shift) return null;

                return (
                  <Card key={weekday.day}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="w-24 font-semibold text-lg">{weekday.name}</div>
                        
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            placeholder="Navn"
                            value={getValue(shift, "employee_name")}
                            onChange={(e) => handleInputChange(weekday.day, "employee_name", e.target.value)}
                          />
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              type="email"
                              placeholder="Email"
                              value={getValue(shift, "email")}
                              onChange={(e) => handleInputChange(weekday.day, "email", e.target.value)}
                            />
                          </div>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              type="tel"
                              placeholder="Mobil"
                              value={getValue(shift, "phone")}
                              onChange={(e) => handleInputChange(weekday.day, "phone", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {hasChanges(weekday.day) && (
                            <Button
                              size="sm"
                              onClick={() => handleSave(weekday.day)}
                              disabled={updateShiftMutation.isPending}
                            >
                              Gem
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(shift)}
                            disabled={sendReminderMutation.isPending || (!shift.email && !shift.phone)}
                            title="Send påmindelse"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Weekend Cleanup Section - Friday Special */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <CalendarClock className="h-5 w-5" />
                  Fredag: Oprydning før weekenden
                </CardTitle>
                <CardDescription>
                  Sendes automatisk kl. 16:10 hver fredag til alle ledere og valgte modtagere
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modtagere (kommaseparerede emails)</label>
                  <Textarea
                    value={currentWeekendRecipients}
                    onChange={(e) => {
                      setEditingWeekendRecipients(e.target.value);
                      setWeekendRecipientsChanged(true);
                    }}
                    placeholder="leder1@firma.dk, leder2@firma.dk, reception@firma.dk"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tjekliste til weekend oprydning (én opgave per linje)</label>
                  <Textarea
                    value={currentWeekendTasks}
                    onChange={(e) => {
                      setEditingWeekendTasks(e.target.value);
                      setWeekendTasksChanged(true);
                    }}
                    placeholder="Skriv opgaver her (én per linje)"
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  {(weekendTasksChanged || weekendRecipientsChanged) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const updates: Partial<WeekendCleanupConfig> = {};
                        if (weekendTasksChanged) updates.tasks = currentWeekendTasks;
                        if (weekendRecipientsChanged) updates.recipients = currentWeekendRecipients;
                        updateWeekendConfigMutation.mutate(updates);
                      }}
                      disabled={updateWeekendConfigMutation.isPending}
                    >
                      Gem ændringer
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendWeekendReminderMutation.mutate()}
                    disabled={sendWeekendReminderMutation.isPending || !currentWeekendRecipients}
                    title="Send weekend oprydnings-mail nu"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send nu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deactivation" className="space-y-6">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <UserMinus className="h-5 w-5" />
                  Deaktiverings-påmindelser
                </CardTitle>
                <CardDescription>
                  Når en medarbejder ændres fra aktiv til inaktiv, sendes en mail til de valgte modtagere.
                  Der sendes 1 initial mail samt 1 opfølgning dagen efter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Vælg team
                  </label>
                  <Select value={selectedTeamId} onValueChange={handleTeamChange}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Vælg et team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            {team.name}
                            {deactivationConfigs.find(c => c.team_id === team.id)?.recipients && (
                              <Badge variant="secondary" className="text-xs">Konfigureret</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTeamId && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Modtagere for {teams.find(t => t.id === selectedTeamId)?.name} (kommaseparerede emails)
                      </label>
                      <Textarea
                        value={currentDeactivationRecipients}
                        onChange={(e) => {
                          setEditingDeactivationRecipients(e.target.value);
                          setDeactivationChanged(true);
                        }}
                        placeholder="it@firma.dk, hr@firma.dk, teamleder@firma.dk"
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Email-skabelon (brug {"{{employee_name}}"}, {"{{team_name}}"}, {"{{employee_email}}"}, {"{{deactivation_date}}"})
                      </label>
                      <Textarea
                        value={currentDeactivationBody}
                        onChange={(e) => {
                          setEditingDeactivationBody(e.target.value);
                          setDeactivationChanged(true);
                        }}
                        placeholder="Skriv email-indhold her..."
                        rows={12}
                        className="resize-none font-mono text-sm"
                      />
                    </div>

                    {deactivationChanged && (
                      <Button
                        onClick={() => {
                          const updates: Partial<DeactivationConfig> = {};
                          if (editingDeactivationRecipients !== null) updates.recipients = currentDeactivationRecipients;
                          if (editingDeactivationBody !== null) updates.email_body = currentDeactivationBody;
                          updateDeactivationConfigMutation.mutate({ teamId: selectedTeamId, updates });
                        }}
                        disabled={updateDeactivationConfigMutation.isPending}
                      >
                        Gem ændringer for {teams.find(t => t.id === selectedTeamId)?.name}
                      </Button>
                    )}
                  </>
                )}

                {!selectedTeamId && (
                  <div className="text-center py-8 text-muted-foreground">
                    Vælg et team ovenfor for at konfigurere deaktiverings-påmindelser
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
