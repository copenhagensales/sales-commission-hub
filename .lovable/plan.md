
# Plan: Deltager-funktion til begivenheder

## Oversigt

Tilføjer mulighed for medarbejdere at markere om de deltager i en begivenhed, samt se hvem der deltager via hover.

---

## Database-ændringer

### Ny tabel: `event_attendees`

```sql
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'not_attending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, employee_id)
);

-- Index for hurtige opslag
CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_employee ON event_attendees(employee_id);

-- RLS policies
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Alle autentificerede kan se deltagere
CREATE POLICY "Users can view all attendees" ON event_attendees
  FOR SELECT TO authenticated USING (true);

-- Medarbejdere kan kun indsætte/opdatere deres egen deltagelse
CREATE POLICY "Employees can manage own attendance" ON event_attendees
  FOR ALL TO authenticated
  USING (employee_id IN (
    SELECT id FROM employee 
    WHERE private_email = auth.jwt()->>'email' 
       OR work_email = auth.jwt()->>'email'
  ));
```

---

## Frontend-ændringer

### 1. Home.tsx - Tilføj deltager-funktionalitet

**Nye imports:**
- `ThumbsUp`, `Users` (lucide-react)
- `HoverCard`, `HoverCardTrigger`, `HoverCardContent` fra ui/hover-card
- `Avatar`, `AvatarFallback` fra ui/avatar

**Ny query - Hent deltagere for alle events:**
```typescript
const { data: eventAttendees = [] } = useQuery({
  queryKey: ["event-attendees", companyEvents.map(e => e.id)],
  queryFn: async () => {
    const eventIds = companyEvents.map(e => e.id);
    if (eventIds.length === 0) return [];
    const { data } = await supabase
      .from("event_attendees")
      .select(`
        *,
        employee:employee_id(id, first_name, last_name)
      `)
      .in("event_id", eventIds);
    return data || [];
  },
  enabled: companyEvents.length > 0,
});
```

**Ny mutation - Toggle deltagelse:**
```typescript
const toggleAttendanceMutation = useMutation({
  mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'not_attending' }) => {
    if (!employee?.id) throw new Error("Ikke logget ind");
    
    const { error } = await supabase
      .from("event_attendees")
      .upsert({
        event_id: eventId,
        employee_id: employee.id,
        status: status,
      }, { onConflict: 'event_id,employee_id' });
      
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["event-attendees"] });
    toast.success("Din deltagelse er opdateret");
  },
});
```

**UI-ændringer i event-listen (linje 485-512):**

Nuværende struktur:
```
[Dato] [Titel + tid/sted] [Slet-knap (hover)]
```

Ny struktur:
```
[Dato] [Titel + tid/sted + deltagerantal] [Like-knapper] [Slet-knap (hover)]
```

- **Like-knapper**: To knapper (👍/👎) der viser brugerens nuværende status
- **Deltagerantal**: Badge med antal deltagere, f.eks. "5 deltager"
- **HoverCard**: Når man hover over deltagerantal, vises liste over deltagere

```tsx
<HoverCard>
  <HoverCardTrigger asChild>
    <Badge variant="outline" className="cursor-pointer gap-1">
      <Users className="w-3 h-3" />
      {attendingCount} deltager
    </Badge>
  </HoverCardTrigger>
  <HoverCardContent>
    <div className="space-y-2">
      <p className="font-medium text-sm">Deltagere</p>
      {attendees.filter(a => a.status === 'attending').map(a => (
        <div className="flex items-center gap-2 text-sm">
          <Avatar className="h-5 w-5">
            <AvatarFallback>{a.employee.first_name[0]}{a.employee.last_name[0]}</AvatarFallback>
          </Avatar>
          <span>{a.employee.first_name} {a.employee.last_name}</span>
        </div>
      ))}
    </div>
  </HoverCardContent>
</HoverCard>
```

---

## Brugeroplevelse

| Handling | Resultat |
|----------|----------|
| Klik 👍 på event | Markerer dig som "deltager" |
| Klik 👎 på event | Markerer dig som "deltager ikke" |
| Hover over "X deltager" | Viser liste med navne på deltagere |
| Ingen deltagere | Viser "Ingen deltagere endnu" |

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| Database migration | Ny `event_attendees` tabel med RLS |
| `src/pages/Home.tsx` | Tilføj deltagelse-logik, HoverCard, like-knapper |

---

## Eksempel på visning

```
┌─────────────────────────────────────────────────┐
│ 30   Fredagsbar - John & Woo                    │
│ JAN  Kl. 17:30 - John & Woo   [3 deltager] 👍 👎│
│                                   ↓             │
│                           ┌───────────────┐     │
│                           │ Deltagere     │     │
│                           │ 👤 Kasper M   │     │
│                           │ 👤 Mikkel K   │     │
│                           │ 👤 Signe I    │     │
│                           └───────────────┘     │
└─────────────────────────────────────────────────┘
```
