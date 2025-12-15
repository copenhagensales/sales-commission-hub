import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Phone, Send, CheckCircle2 } from "lucide-react";

const WEEKDAYS = [
  { day: 1, name: "Mandag" },
  { day: 2, name: "Tirsdag" },
  { day: 3, name: "Onsdag" },
  { day: 4, name: "Torsdag" },
  { day: 5, name: "Fredag" },
];

const CLOSING_TASKS = [
  "Lukke alle vinduer (inkl. mødelokaler)",
  "Fylde opvaskeren og starte den",
  "Ryd kopper af alle borde",
  "Lukke begge døre",
];

interface ClosingShift {
  id: string;
  weekday: number;
  employee_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function ClosingShifts() {
  const queryClient = useQueryClient();
  const [editingShifts, setEditingShifts] = useState<Record<number, Partial<ClosingShift>>>({});
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);

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

  const sendReminderMutation = useMutation({
    mutationFn: async (shift: ClosingShift) => {
      const { error } = await supabase.functions.invoke("send-closing-reminder", {
        body: {
          employeeName: shift.employee_name,
          email: shift.email,
          phone: shift.phone,
          tasks: CLOSING_TASKS,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Påmindelse sendt!");
      setSendingReminder(null);
    },
    onError: () => {
      toast.error("Kunne ikke sende påmindelse");
      setSendingReminder(null);
    },
  });

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

  const handleSendReminder = (shift: ClosingShift) => {
    if (!shift.email && !shift.phone) {
      toast.error("Ingen email eller telefon angivet");
      return;
    }
    setSendingReminder(shift.weekday);
    sendReminderMutation.mutate(shift);
  };

  if (isLoading) {
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
          <h1 className="text-3xl font-bold">Lukkevagter</h1>
          <p className="text-muted-foreground mt-1">
            Administrer hvem der lukker kontoret hver dag
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Tjekliste ved lukning
            </CardTitle>
            <CardDescription>
              Denne liste sendes med påmindelsen kl. 16:00
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {CLOSING_TASKS.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
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
                        disabled={sendingReminder === weekday.day || (!shift.email && !shift.phone)}
                        title="Send påmindelse nu"
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
      </div>
    </MainLayout>
  );
}
