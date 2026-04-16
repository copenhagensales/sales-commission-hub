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

interface SocialLinks {
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  website?: string;
}

interface PageContent {
  id: string;
  page_key: string;
  title: string;
  body_lines: string[];
  tip_text: string | null;
  social_links: SocialLinks | null;
}

export function BookingPagesTab() {
  const queryClient = useQueryClient();
  const [editingPage, setEditingPage] = useState<PageContent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBodyLines, setEditBodyLines] = useState("");
  const [editTipText, setEditTipText] = useState("");
  const [editSocialLinks, setEditSocialLinks] = useState<SocialLinks>({});

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
    mutationFn: async (page: { id: string; title: string; body_lines: string[]; tip_text: string | null; social_links: SocialLinks | null }) => {
      const { error } = await supabase
        .from("booking_page_content")
        .update({
          title: page.title,
          body_lines: page.body_lines,
          tip_text: page.tip_text,
          social_links: page.social_links as any,
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
    setEditSocialLinks((page.social_links as SocialLinks) || {});
  };

  const handleSave = () => {
    if (!editingPage) return;
    updateMutation.mutate({
      id: editingPage.id,
      title: editTitle,
      body_lines: editBodyLines.split("\n").filter(l => l.trim()),
      tip_text: editTipText.trim() || null,
      social_links: editingPage.page_key === "booking_success" ? editSocialLinks : editingPage.social_links,
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
            {editingPage?.page_key === "booking_success" && (
              <div className="space-y-2">
                <Label>Sociale medier (valgfri)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={editSocialLinks.instagram || ""}
                    onChange={e => setEditSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
                    placeholder="Instagram URL"
                  />
                  <Input
                    value={editSocialLinks.linkedin || ""}
                    onChange={e => setEditSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))}
                    placeholder="LinkedIn URL"
                  />
                  <Input
                    value={editSocialLinks.tiktok || ""}
                    onChange={e => setEditSocialLinks(prev => ({ ...prev, tiktok: e.target.value }))}
                    placeholder="TikTok URL"
                  />
                  <Input
                    value={editSocialLinks.website || ""}
                    onChange={e => setEditSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="Hjemmeside URL"
                  />
                </div>
              </div>
            )}
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
        <div className="rounded-xl p-3 text-left space-y-1.5" style={{ backgroundColor: CS_GREEN_LIGHT }}>
          <p className="text-xs font-semibold" style={{ color: CS_DARK }}>Hvad sker der nu?</p>
          <ul className="text-xs space-y-1" style={{ color: "#444" }}>
            {(page.body_lines.length > 0
              ? page.body_lines
              : ["Oscar ringer dig op på det aftalte tidspunkt", "Samtalen tager 5–10 minutter"]
            ).map((line, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
                {line}
              </li>
            ))}
          </ul>
        </div>
        {page.tip_text && (
          <p className="text-[10px]" style={{ color: "#999" }}>{page.tip_text}</p>
        )}
        <p className="text-[10px] italic" style={{ color: "#bbb" }}>Dato, tid og rekrutterernavn indsættes automatisk på kandidatsiden</p>
        {page.social_links && Object.values(page.social_links).some(v => v) && (
          <div className="flex items-center justify-center gap-2">
            {(page.social_links as SocialLinks).instagram && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: CS_GREEN }}>
                <svg className="w-3 h-3" fill="white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </div>
            )}
            {(page.social_links as SocialLinks).linkedin && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: CS_GREEN }}>
                <svg className="w-3 h-3" fill="white" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </div>
            )}
            {(page.social_links as SocialLinks).tiktok && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: CS_GREEN }}>
                <svg className="w-3 h-3" fill="white" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </div>
            )}
            {(page.social_links as SocialLinks).website && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: CS_GREEN }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              </div>
            )}
          </div>
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
