import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, CheckCircle2, XCircle, Phone, Clock } from "lucide-react";

const CS_GREEN = "#52c68d";
const CS_GREEN_LIGHT = "#e8f8f0";
const CS_DARK = "#2e3136";

interface PageContent {
  id: string;
  page_key: string;
  title: string;
  body_lines: string[];
  tip_text: string | null;
}

export function BookingPagesTab() {
  const queryClient = useQueryClient();
  const [editingPage, setEditingPage] = useState<PageContent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBodyLines, setEditBodyLines] = useState("");
  const [editTipText, setEditTipText] = useState("");

  const { data: pages, isLoading } = useQuery({
    queryKey: ["booking-page-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_page_content")
        .select("*")
        .order("page_key");
      if (error) throw error;
      return data as PageContent[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (page: { id: string; title: string; body_lines: string[]; tip_text: string | null }) => {
      const { error } = await supabase
        .from("booking_page_content")
        .update({
          title: page.title,
          body_lines: page.body_lines,
          tip_text: page.tip_text,
          updated_at: new Date().toISOString(),
        })
        .eq("id", page.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-page-content"] });
      setEditingPage(null);
      toast.success("Side opdateret");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const openEdit = (page: PageContent) => {
    setEditingPage(page);
    setEditTitle(page.title);
    setEditBodyLines(page.body_lines.join("\n"));
    setEditTipText(page.tip_text || "");
  };

  const handleSave = () => {
    if (!editingPage) return;
    updateMutation.mutate({
      id: editingPage.id,
      title: editTitle,
      body_lines: editBodyLines.split("\n").filter(l => l.trim()),
      tip_text: editTipText.trim() || null,
    });
  };

  const bookingSuccess = pages?.find(p => p.page_key === "booking_success");
  const unsubscribeSuccess = pages?.find(p => p.page_key === "unsubscribe_success");

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Kandidat-sider</h3>
        <p className="text-xs text-muted-foreground">
          Rediger teksten på de sider kandidaten ser efter booking og ved afmelding
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Success Preview */}
        {bookingSuccess && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Booking-bekræftelse
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => openEdit(bookingSuccess)} className="gap-1.5">
                <Pencil className="h-3 w-3" />
                Rediger
              </Button>
            </CardHeader>
            <CardContent>
              <BookingSuccessPreview page={bookingSuccess} />
            </CardContent>
          </Card>
        )}

        {/* Unsubscribe Preview */}
        {unsubscribeSuccess && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-gray-500" />
                Afmeldingsside
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => openEdit(unsubscribeSuccess)} className="gap-1.5">
                <Pencil className="h-3 w-3" />
                Rediger
              </Button>
            </CardHeader>
            <CardContent>
              <UnsubscribePreview page={unsubscribeSuccess} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPage} onOpenChange={(open) => !open && setEditingPage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Rediger {editingPage?.page_key === "booking_success" ? "booking-bekræftelse" : "afmeldingsside"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              {editingPage?.page_key === "unsubscribe_success" && (
                <p className="text-xs text-muted-foreground">Brug {"{{firstName}}"} som pladsholder for kandidatens navn</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Brødtekst (én linje per afsnit)</Label>
              <Textarea
                value={editBodyLines}
                onChange={e => setEditBodyLines(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Tip-tekst (valgfri)</Label>
              <Input
                value={editTipText}
                onChange={e => setEditTipText(e.target.value)}
                placeholder="F.eks. 💡 Tip: Hav gerne dit CV klar"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPage(null)}>Annuller</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingSuccessPreview({ page }: { page: PageContent }) {
  const fontStyle = { fontFamily: "'Figtree', sans-serif" };
  return (
    <div className="overflow-hidden border border-dashed rounded-xl">
      <div className="bg-white p-6 text-center space-y-4" style={fontStyle}>
        <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: CS_GREEN }} />
        <h2 className="text-lg font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>
          {page.title}
        </h2>
        <p className="text-sm" style={{ color: "#666" }}>
          Oscar ringer dig <strong>tirsdag d. 22. april</strong> kl. <strong>10:00</strong>. Samtalen er helt uforpligtende.
        </p>
        <div className="rounded-xl p-3 text-left space-y-1.5" style={{ backgroundColor: CS_GREEN_LIGHT }}>
          <p className="text-xs font-semibold" style={{ color: CS_DARK }}>Hvad sker der nu?</p>
          <ul className="text-xs space-y-1" style={{ color: "#444" }}>
            <li className="flex items-start gap-1.5">
              <Phone className="h-3 w-3 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
              Oscar ringer dig op på det aftalte tidspunkt
            </li>
            <li className="flex items-start gap-1.5">
              <Clock className="h-3 w-3 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
              Samtalen tager 5–10 minutter
            </li>
          </ul>
        </div>
        {page.tip_text && (
          <p className="text-[10px]" style={{ color: "#999" }}>{page.tip_text}</p>
        )}
      </div>
    </div>
  );
}

function UnsubscribePreview({ page }: { page: PageContent }) {
  const displayTitle = page.title.replace("{{firstName}}", "Marie");
  return (
    <div className="overflow-hidden border border-dashed rounded-xl">
      <div className="bg-white p-6 text-center space-y-3" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div
          className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#ecfdf5" }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-semibold" style={{ color: "#111827" }}>{displayTitle}</h2>
        {page.body_lines.map((line, i) => (
          <p key={i} className="text-xs leading-relaxed" style={{ color: "#4b5563" }}>{line}</p>
        ))}
        <div className="w-8 h-0.5 mx-auto" style={{ backgroundColor: "#e5e7eb" }} />
        <p className="text-[10px]" style={{ color: "#9ca3af" }}>Venlig hilsen, Copenhagen Sales</p>
      </div>
    </div>
  );
}
