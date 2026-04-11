

## Omskriv booking flow-kommunikation: "Book selv først, ellers ringer vi"

Ændrer budskabet i alle templates fra "vi ringer dig – book selv hvis det ikke passer" til "book selv den tid der passer dig – ellers ringer vi bare".

### Ny kommunikationsstrategi

**Primært budskab:** Opfordr kandidaten til selv at booke
**Sekundært budskab:** "Hvis du ikke booker, ringer Oscar bare til dig"

### Tekst-ændringer

Begge steder hvor templates er defineret (edge function + frontend preview):

| Template | Nuværende kerneidé | Ny kerneidé |
|----------|-------------------|-------------|
| **Dag 0 Email** | "Vi ringer dig X – book selv hvis det ikke passer" | "Book selv en tid der passer dig – hvis du ikke booker, ringer Oscar bare til dig" |
| **Dag 0 SMS** | "Vi ringer dig X. Passer det ikke? Book selv" | "Book en tid til en snak med Oscar: {link}. Booker du ikke, ringer vi bare til dig" |
| **Dag 1 Pre-call SMS** | "Vi ringer dig i dag" | "Har du booket en tid endnu? Gør det her: {link}. Ellers ringer Oscar dig i dag" |
| **Dag 1 Follow-up SMS** | "Vi prøvede at ringe. Book en tid" | "Oscar prøvede at ringe dig. Book selv en tid her: {link} – ellers prøver vi igen" |
| **Dag 2 Reminder Email** | "Vi sendte en invitation – har du set den?" | "Du har stadig ikke booket en tid. Gør det nemt her: {link}. Ellers ringer Oscar dig" |
| **Dag 3 Last Attempt** | "Vi har forsøgt at kontakte dig" | "Sidste chance for at booke en tid – ellers lukker vi din ansøgning" |

Tonen forbliver personlig med Oscar som afsender, uforpligtende, og med en-dash.

### Filer der ændres

| Fil | Hvad |
|-----|------|
| `supabase/functions/process-booking-flow/index.ts` | Opdater alle FLOW_TEMPLATES tekster |
| `src/components/recruitment/FlowTemplatesTab.tsx` | Samme tekst-opdateringer i preview-templates |

