import { useState } from "react";
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

export interface CampaignOption {
  id: string;
  name: string;
  clientName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ClientForecastCohort, 'id' | 'created_at' | 'created_by'>) => void;
  campaigns?: CampaignOption[];
}

export function CreateCohortDialog({ open, onOpenChange, onSubmit, campaigns = [] }: Props) {
  const [startDate, setStartDate] = useState('');
  const [headcount, setHeadcount] = useState('5');
  const [note, setNote] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const handleSubmit = () => {
    if (!startDate || !headcount) return;
    onSubmit({
      client_id: 'mock-client',
      client_campaign_id: selectedCampaignId || null,
      start_date: startDate,
      planned_headcount: parseInt(headcount, 10),
      ramp_profile_id: null,
      survival_profile_id: null,
      note: note || null,
    });
    setStartDate('');
    setHeadcount('5');
    setNote('');
    setSelectedCampaignId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilføj opstartshold</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="campaign">Kampagne</Label>
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
            <Label htmlFor="start-date">Startdato</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headcount">Antal personer</Label>
            <Input
              id="headcount"
              type="number"
              min="1"
              max="50"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (valgfri)</Label>
            <Textarea
              id="note"
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
            Tilføj hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
