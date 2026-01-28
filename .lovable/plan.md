
# Plan: Udvidet begivenhedsfunktionalitet

## Oversigt

Udvider begivenhedssystemet med:
1. "Læs mere" dialog til at vise detaljer om begivenheder
2. Team-valg ved oprettelse af begivenheder
3. Pop-up invitationer der vises ved første login for inviterede medarbejdere

---

## Database-ændringer

### 1. Ny tabel: `event_team_invitations`
Kobler begivenheder med teams der er inviteret.

```sql
CREATE TABLE public.event_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, team_id)
);

CREATE INDEX idx_event_team_invitations_event ON event_team_invitations(event_id);
CREATE INDEX idx_event_team_invitations_team ON event_team_invitations(team_id);
```

### 2. Ny tabel: `event_invitation_views`
Tracker om en medarbejder har set invitationen (for popup-logik).

```sql
CREATE TABLE public.event_invitation_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, employee_id)
);

CREATE INDEX idx_event_invitation_views_employee ON event_invitation_views(employee_id);
```

### 3. Tilføj kolonne til `company_events`

```sql
ALTER TABLE public.company_events
ADD COLUMN show_popup BOOLEAN NOT NULL DEFAULT false;
```

### 4. RLS Policies

```sql
-- event_team_invitations
ALTER TABLE event_team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invitations"
ON event_team_invitations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage event invitations"
ON event_team_invitations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- event_invitation_views
ALTER TABLE event_invitation_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all invitation views"
ON event_invitation_views FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own invitation views"
ON event_invitation_views FOR ALL TO authenticated
USING (employee_id IN (
  SELECT id FROM employee 
  WHERE private_email = auth.jwt()->>'email' 
     OR work_email = auth.jwt()->>'email'
));
```

---

## Frontend-ændringer

### 1. Ny komponent: `EventDetailDialog.tsx`

Oprettes i `src/components/home/EventDetailDialog.tsx`

| Element | Beskrivelse |
|---------|-------------|
| Titel | Begivenhedens titel |
| Dato/tid | Formateret dato og tidspunkt |
| Sted | Lokation |
| Beskrivelse | Fuld beskrivelsestekst |
| Deltagerantal | Badge med antal + hover for liste |
| Handlinger | Deltag/Deltager ikke knapper |

```typescript
interface EventDetailDialogProps {
  event: CompanyEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendees: EventAttendee[];
  myStatus: 'attending' | 'not_attending' | null;
  onToggleAttendance: (status: 'attending' | 'not_attending') => void;
}
```

### 2. Ny komponent: `EventInvitationPopup.tsx`

Oprettes i `src/components/home/EventInvitationPopup.tsx`

Vises som AlertDialog ved første login når:
- Medarbejder er i et team der er inviteret til en begivenhed
- Begivenheden har `show_popup = true`
- Medarbejderen ikke allerede har set invitationen

| Element | Beskrivelse |
|---------|-------------|
| Ikon | PartyPopper eller Calendar ikon |
| Titel | "Du er inviteret!" |
| Begivenhed | Titel, dato, tid, sted |
| Beskrivelse | Kort beskrivelse af begivenheden |
| Handlinger | "Deltager", "Deltager ikke", "Måske senere" |

Logik:
1. Ved mount henter uviewede invitationer for brugerens team
2. Viser popup for første invitation
3. Ved handling markeres invitation som set i `event_invitation_views`

### 3. Opdater `Home.tsx`

**Ændring i event-listen:**
- Tilføj "Læs mere" knap (Info ikon) der åbner `EventDetailDialog`
- Integrér `EventInvitationPopup` i toppen af komponenten

**Ændring i add-event dialog:**
- Tilføj team-valg sektion med checkboxes
- Tilføj toggle for "Vis popup-invitation"
- Opdater mutation til at indsætte team-invitations

```typescript
// State for nyt event
const [newEvent, setNewEvent] = useState({
  title: "",
  event_date: "",
  event_time: "",
  location: "",
  description: "",
  show_popup: false,
  invited_teams: [] as string[]
});

// Mutation opdateres til at håndtere teams
const addEventMutation = useMutation({
  mutationFn: async (event) => {
    // 1. Indsæt event
    const { data: newEvent } = await supabase
      .from("company_events")
      .insert({...})
      .select()
      .single();
    
    // 2. Indsæt team-invitations
    if (event.invited_teams.length > 0) {
      await supabase
        .from("event_team_invitations")
        .insert(event.invited_teams.map(teamId => ({
          event_id: newEvent.id,
          team_id: teamId
        })));
    }
  }
});
```

### 4. Hent teams data

Tilføj query til at hente alle teams for checkboxes:

```typescript
const { data: teams = [] } = useQuery({
  queryKey: ["teams-list"],
  queryFn: async () => {
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");
    return data || [];
  }
});
```

---

## UI Flow

### Opret begivenhed (udvidet)
```text
┌─────────────────────────────────────────────┐
│ Tilføj begivenhed                           │
├─────────────────────────────────────────────┤
│ Titel *                                     │
│ [_________________________]                 │
│                                             │
│ Beskrivelse                                 │
│ [_________________________]                 │
│ [_________________________]                 │
│                                             │
│ Dato *          Tidspunkt                   │
│ [________]      [________]                  │
│                                             │
│ Sted                                        │
│ [_________________________]                 │
│                                             │
│ Inviter teams                               │
│ ☑ Relatel  ☑ United  ☐ TDC Erhverv          │
│ ☐ Eesy TM  ☐ Fieldmarketing  ☑ Stab         │
│                                             │
│ ☐ Vis popup-invitation ved login            │
│                                             │
│ [      Tilføj begivenhed      ]             │
└─────────────────────────────────────────────┘
```

### Event i listen (med læs mere)
```text
┌──────────────────────────────────────────────────┐
│ 30   Fredagsbar - John & Woo   [3] 👍 👎 ℹ️  🗑   │
│ JAN  Kl. 17:30 - John & Woo                      │
└──────────────────────────────────────────────────┘
      └─────────────────────────────────────┬──────┘
                                            ↓
┌─────────────────────────────────────────────┐
│ Fredagsbar - John & Woo                   X │
├─────────────────────────────────────────────┤
│ 📅 Fredag 30. januar 2026                   │
│ 🕐 Kl. 17:30                                │
│ 📍 John & Woo                               │
│                                             │
│ Kom og nyd en hyggelig fredagsbar med       │
│ kollegerne hos John & Woo. Der er drinks    │
│ og snacks til alle!                         │
│                                             │
│ 👥 3 deltager  [Se deltagere ▾]             │
│                                             │
│ [  👍 Jeg deltager  ] [  👎 Deltager ikke  ]│
└─────────────────────────────────────────────┘
```

### Pop-up invitation (ved login)
```text
┌─────────────────────────────────────────────┐
│ 🎉 Du er inviteret!                       X │
├─────────────────────────────────────────────┤
│                                             │
│ Fredagsbar - John & Woo                     │
│                                             │
│ 📅 Fredag 30. januar 2026, kl. 17:30        │
│ 📍 John & Woo                               │
│                                             │
│ Kom og nyd en hyggelig fredagsbar med       │
│ kollegerne!                                 │
│                                             │
│ [ 👍 Deltager ] [ 👎 Nej tak ] [ Senere ]   │
└─────────────────────────────────────────────┘
```

---

## Filer der oprettes/ændres

| Fil | Type | Ændring |
|-----|------|---------|
| Database migration | Ny | Opretter tabeller og policies |
| `src/components/home/EventDetailDialog.tsx` | Ny | Dialog til begivenhedsdetaljer |
| `src/components/home/EventInvitationPopup.tsx` | Ny | Pop-up for invitationer |
| `src/pages/Home.tsx` | Ændring | Integrerer nye komponenter, udvider opret-dialog |

---

## Teknisk flow for popup-invitationer

```text
1. Bruger logger ind
        ↓
2. Home.tsx mounter
        ↓
3. Query: Hent kommende events hvor:
   - event.show_popup = true
   - event har team-invitation til brugerens team
   - Brugeren IKKE har entry i event_invitation_views
        ↓
4. Hvis resultater > 0:
   - Vis EventInvitationPopup med første event
        ↓
5. Ved handling (deltager/nej tak/senere):
   - Hvis deltager/nej tak: 
     - Upsert til event_attendees
     - Insert til event_invitation_views
   - Hvis senere:
     - Ingen handling (vises igen næste gang)
```

---

## Resultat

- Medarbejdere kan klikke på "Læs mere" for at se fuld beskrivelse af begivenheder
- Ved oprettelse kan man vælge hvilke teams der inviteres
- Hvis "Vis popup-invitation" er slået til, ser inviterede medarbejdere en popup ved næste login
- Popup vises kun én gang per begivenhed per medarbejder
- Alle handlinger trackes og synkroniseres korrekt
