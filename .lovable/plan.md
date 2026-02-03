
# Plan: Fix Opkaldsvisning og Status-Tracking

## Problemanalyse

Oscar Belcher kan ikke se indgående/missede opkald. Efter undersøgelse er der identificeret to hovedproblemer:

### Problem 1: Messages-siden viser ikke opkaldsdata
**Årsag**: Messages-siden (`/recruitment/Messages.tsx`) henter KUN fra `communication_logs` tabellen, men opkaldsdata gemmes i `call_records` tabellen af Twilio webhook.

**Beviser fra database**:
- `communication_logs` med type='call': **0 rækker**
- `call_records` med indgående opkald: **Mange rækker** (inkl. +4530809044)

### Problem 2: Opkaldsstatus opdateres ikke
**Årsag**: 35 opkald sidder fast på `in-progress`, kun 6 har `completed`. Twilio webhook callbacks for slutstatus (no-answer, busy, completed) modtages ikke korrekt.

---

## Løsningsplan

### Trin 1: Opdater Messages-siden til at inkludere call_records
**Fil**: `src/pages/recruitment/Messages.tsx`

Ændringer:
1. Tilføj en separat query for `call_records` 
2. Kombiner data fra begge kilder i "Opkald"-fanen
3. Normaliser data-strukturen så begge kilder vises ens

Forventet ændring (ca. 30-50 linjer):
- Tilføj `useQuery` for `call_records`
- Opdater filteredMessages logikken for "call" tab
- Vis indgående opkald med korrekt status (missed/no-answer/completed)

### Trin 2: Tilføj visning af missede opkald på kandidat-siden
**Fil**: `src/components/recruitment/CandidateCallLogs.tsx`

Denne komponent henter allerede fra `call_records` - men status-logikken kan forbedres:
- Vis "Misset" badge for opkald uden `connected_at`
- Forbedret status-detection for indgående opkald

### Trin 3: Undersøg og ret webhook-konfiguration (separat opgave)
For at løse det underliggende problem med at status ikke opdateres:
- Verificer at Twilio webhook URLs er konfigureret korrekt
- Tjek at `StatusCallbackEvent` inkluderer alle relevante events
- Tilføj logging til `incoming-call` funktionen for at debugge

---

## Tekniske detaljer

### Database-struktur

**call_records** (korrekt data):
```
id, candidate_id, from_number, to_number, direction, status, 
started_at, connected_at, ended_at, duration_seconds
```

**communication_logs** (bruges nu, men mangler opkald):
```
id, candidate_id, type, direction, content, phone_number, 
outcome, created_at, read
```

### Ændringer i Messages.tsx

Nuværende kode (linje 71-82):
```typescript
const { data: messages = [] } = useQuery({
  queryKey: ["communication_logs"],
  queryFn: async () => {
    const { data } = await supabase
      .from("communication_logs")
      .select("*")
      .order("created_at", { ascending: false });
    return data;
  },
});
```

Ny kode tilføjer:
```typescript
const { data: callRecords = [] } = useQuery({
  queryKey: ["call_records_for_messages"],
  queryFn: async () => {
    const { data } = await supabase
      .from("call_records")
      .select("*, candidates(first_name, last_name)")
      .order("started_at", { ascending: false })
      .limit(200);
    return data;
  },
});
```

Kombiner i filteredMessages for "call" tab:
```typescript
const callsFromRecords = callRecords.map(cr => ({
  id: cr.id,
  type: 'call',
  direction: cr.direction,
  content: `${cr.direction === 'inbound' ? 'Indgående' : 'Udgående'} opkald`,
  created_at: cr.started_at,
  read: true, // Opkald har ikke "læst" status
  outcome: cr.status,
  phone_number: cr.direction === 'inbound' ? cr.from_number : cr.to_number,
  candidate_name: cr.candidates ? 
    `${cr.candidates.first_name} ${cr.candidates.last_name}` : null,
  duration_seconds: cr.duration_seconds,
  is_missed: cr.direction === 'inbound' && !cr.connected_at
}));
```

### RLS-tilladelser
Oscar Belcher har `job_title = 'Rekruttering'` som er inkluderet i:
- `is_rekruttering()` → Giver fuld adgang til `call_records`
- `is_teamleder_or_above()` → Giver læseadgang til `call_records`

**Ingen RLS-ændringer nødvendige**.

---

## Filer der ændres
1. `src/pages/recruitment/Messages.tsx` - Tilføj call_records query og kombiner data
2. `src/components/recruitment/CandidateCallLogs.tsx` - Forbedret status-visning for missede opkald

## Forventet resultat
- "Opkald"-fanen på Messages-siden viser alle opkald fra `call_records`
- Missede opkald vises med korrekt status og rødt badge
- Oscar kan se når kandidater har forsøgt at ringe forgæves
