

## Fix: Bookinger vises ikke i Samtaler-fanen

### Problemer fundet

**Problem 1: `candidates`-tabellen opdateres aldrig ved booking**

`public-book-candidate` opdaterer kun `applications.status` — men `BookingCalendarTab` filtrerer på `candidates.status = 'interview_scheduled'` og `candidates.interview_date IS NOT NULL`. Funktionen sætter aldrig disse felter på kandidaten.

**Problem 2: Kasper Mikkelsen har ingen `applications`-post**

`auto-segment-candidate` opretter ikke en application — den læser kun en eksisterende. Så `public-book-candidate` linje 128-133 gør intet, da `application` er `null`.

### Løsning

Opdater `supabase/functions/public-book-candidate/index.ts` til at:

1. **Opdatere `candidates`-tabellen direkte** med `status: 'interview_scheduled'` og `interview_date` (som timestamp fra dato+tidspunkt).
2. **Oprette en application** hvis der ikke allerede findes en, så der er en post at opdatere og tracke.

### Konkrete ændringer

**`supabase/functions/public-book-candidate/index.ts`**

Efter linje 49 (application lookup), tilføj:
```ts
// If no application exists, create one
if (!application) {
  const { data: newApp } = await supabase
    .from("applications")
    .insert({
      candidate_id: candidateId,
      role: "Salgskonsulent",
      status: "interview_scheduled",
    })
    .select("id, role, status")
    .single();
  application = newApp;
}
```

Efter application-update blokken (linje 127-133), tilføj:
```ts
// Update candidate status and interview_date
const interviewDatetime = `${date}T${startTime}:00+02:00`;
await supabase
  .from("candidates")
  .update({
    status: "interview_scheduled",
    interview_date: interviewDatetime,
  })
  .eq("id", candidateId);
```

**Derudover**: Ret Kasper Mikkelsen manuelt via en migration der opdaterer hans `interview_date` og `status`.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/public-book-candidate/index.ts` | Opdater `candidates`-tabellen + opret application hvis manglende |
| **Database** | Ret Kasper Mikkelsens data manuelt |

### Resultat
Alle kandidater der booker via den offentlige side vil fremgå i Samtaler-fanen med korrekt dato og tidspunkt.

