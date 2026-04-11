

## Forbedringer til booking-siden

Baseret på din feedback implementerer vi tre ting:

### 1. Kort pitch under overskriften
Tilføj en uforpligtende, motiverende tekst under "Book en samtale":
> "Samtalen tager kun 10 minutter — og så finder vi ud af om det er et match."

### 2. Varighed-indikator
Tilføj et lille ikon+tekst ved tidsvælgeren: "⏱ Ca. 10 min" så kandidaten ved hvad de siger ja til.

### 3. Forbedret bekræftelsesside
Udvid "Du er booket"-siden med:
- "Hvad sker der nu?" — kort forklaring (vi ringer dig op, hav evt. CV klar)
- Holder kandidaten engageret efter booking

### Filer

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/PublicCandidateBooking.tsx` | Pitch-tekst, varighed-badge, forbedret bekræftelse |
| `src/components/recruitment/BookingPreviewTab.tsx` | Samme ændringer i preview |

