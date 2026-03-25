import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClientForecastCohort } from "@/types/forecast";
import type { CampaignOption } from "./CreateCohortDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohort: ClientForecastCohort | null;
  onSubmit: (id: string, data: { start_date: string; planned_headcount: number; note: string | null; client_campaign_id: string | null }) => void;
  campaigns?: CampaignOption[];
}

export function EditForecastCohortDialog({ open, onOpenChange, cohort, onSubmit, campaigns = [] }: Props) {
  const [startDate, setStartDate] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  useEffect(() => {
    if (cohort) {
      setStartDate(cohort.start_date);
      setHeadcount(String(cohort.planned_headcount));
      setNote(cohort.note || '');
      setSelectedCampaignId(cohort.client_campaign_id || '');
    }
  }, [cohort]);

  const handleSubmit = () => {
    if (!cohort || !startDate || !headcount) return;
    onSubmit(cohort.id, {
      start_date: startDate,
      planned_headcount: parseInt(headcount, 10),
      note: note || null,
      client_campaign_id: selectedCampaignId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger opstartshold</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-campaign">Kampagne</Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kampagne" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.clientName} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-start-date">Startdato</Label>
            <Input
              id="edit-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-headcount">Antal personer</Label>
            <Input
              id="edit-headcount"
              type="number"
              min="1"
              max="50"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-note">Note (valgfri)</Label>
            <Textarea
              id="edit-note"
              placeholder="Fx '5 nye Tryg-sælgere'"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button onClick={handleSubmit} disabled={!startDate || !headcount}>
            Gem ændringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
