

# Udskudte samtaler — ny fane og dato-vælger

## Oversigt
Tilføj en "Udskudte samtaler" fane på Winback-siden, og giv mulighed for at sætte en kandidat til status "Udskudt samtale" med en opfølgningsdato. På fanen sorteres kandidater efter opfølgningsdato (tidligste først).

## Database-ændring
Tilføj en ny kolonne `postponed_until` (date, nullable) på `candidates`-tabellen til at gemme den valgte opfølgningsdato.

## Ændringer

### 1. `src/pages/recruitment/Winback.tsx`
- Tilføj ny tab: `{ value: "udskudt_samtale", label: "Udskudte samtaler", permissionKey: "tab_winback_udskudt" }`
- For `udskudt_samtale`-fanen: sortér kandidater efter `postponed_until` (tidligste først) i stedet for `created_at`
- Vis `postponed_until`-datoen på CandidateCard når fanen er aktiv

### 2. `src/pages/recruitment/CandidateDetail.tsx`
- Tilføj `udskudt_samtale` til `statusLabels` og `statusColors`
- Når brugeren vælger "Udskudt samtale" som status: vis en dialog med dato-vælger (måned/år/dag) for opfølgningsdato
- Gem `postponed_until` + `status: "udskudt_samtale"` via `updateCandidateMutation`

### 3. `src/components/recruitment/CandidateCard.tsx`
- Vis `postponed_until`-dato som badge/tekst (f.eks. "Opfølgning: 15. apr. 2026") når status er `udskudt_samtale`
- Tilføj `udskudt_samtale` til status-select dropdown (linje ~266)

### 4. `src/pages/recruitment/Candidates.tsx`
- Tilføj `udskudt_samtale` til `finishedStatuses` så de skjules fra aktiv-visning
- Tilføj `<SelectItem value="udskudt_samtale">Udskudt samtale</SelectItem>` til status-filter

### 5. Ny komponent: `src/components/recruitment/PostponeDateDialog.tsx`
- Dialog med Calendar dato-vælger til at vælge opfølgningsdato
- Bruges fra både CandidateDetail og CandidateCard ved status-ændring til `udskudt_samtale`

## Sortering på Winback-fanen
Kandidater med `udskudt_samtale` sorteres efter `postponed_until ASC` (dem der skal følges op snarest vises øverst). Kandidater uden dato vises sidst.

