# Fjern den hvide kant om Superliga-siden

Den hvide kant er den almindelige luft, som alle sider får rundt om indholdet. På Superliga-siden skal den mørke baggrund i stedet gå helt ud til kanten og op under menuen.

## Ændring
- Kun `src/pages/CommissionLeague.tsx` (grøn zone: layout).
- Den mørke yderboks (`cph-board ... bg-slate-900`, linje 391) får negativ margin, der ophæver layoutets luft: `-m-4 md:-m-8`. Indholdets egen indre luft beholdes, så teksten ikke rammer kanten.
- Ingen ændringer i fælles layout, så andre sider ser ud som før.
- Ingen data, beregninger eller adgang berøres.
