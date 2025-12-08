import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ContentItem, ContentPlatform, ContentType } from "@/hooks/useSomeContent";

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStartDate: string;
  editItem?: ContentItem | null;
  onSave: (item: Omit<ContentItem, "id" | "created_at" | "updated_at">) => void;
  onUpdate?: (item: Partial<ContentItem> & { id: string }) => void;
  defaultType?: ContentType;
}

const typeConfig: Record<ContentType, { platform: ContentPlatform; label: string }> = {
  tiktok_video: { platform: "TikTok", label: "TikTok video" },
  insta_story: { platform: "Instagram", label: "Insta story" },
  insta_post: { platform: "Instagram", label: "Insta post" },
};

export function AddContentDialog({
  open,
  onOpenChange,
  weekStartDate,
  editItem,
  onSave,
  onUpdate,
  defaultType = "tiktok_video",
}: AddContentDialogProps) {
  const [title, setTitle] = useState(editItem?.title || "");
  const [notes, setNotes] = useState(editItem?.notes || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    editItem?.due_date ? new Date(editItem.due_date) : undefined
  );
  const [type, setType] = useState<ContentType>(editItem?.type || defaultType);

  const handleSave = () => {
    if (!title.trim()) return;

    const config = typeConfig[type];
    
    if (editItem && onUpdate) {
      onUpdate({
        id: editItem.id,
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        type,
        platform: config.platform,
      });
    } else {
      onSave({
        week_start_date: weekStartDate,
        platform: config.platform,
        type,
        title: title.trim(),
        status: "planned",
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        notes: notes.trim() || null,
        sort_order: 0,
      });
    }
    
    onOpenChange(false);
    setTitle("");
    setNotes("");
    setDueDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Rediger indhold" : "Tilføj indhold"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(typeConfig) as ContentType[]).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType(t)}
                >
                  {typeConfig[t].label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Titel / Idé</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. 'Hook: Sådan får du X uden Y'"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Deadline (valgfrit)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "d. MMMM yyyy", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  locale={da}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Noter (valgfrit)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Yderligere noter..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {editItem ? "Gem" : "Tilføj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
