## Sæson-dropdown er allerede implementeret — gør den synlig

Dropdownen findes allerede i `CommissionLeague.tsx` (linje 435-454) og vises automatisk når der er mere end én sæson. Den er aktiv på dit skærmbillede ("Sæson 2 - kval ▾"), men er meget diskret stylet og let at overse.

### Ændring i `src/pages/CommissionLeague.tsx`

Gør dropdownen tydeligt klikbar og synlig:

- Skift fra grå (`bg-slate-800/60 border-slate-700`) til guld-tonet (`bg-yellow-500/10 border-yellow-500/40 text-yellow-200`) så den matcher Hall of Fame-temaet og signalerer interaktivitet.
- Tilføj kalender-ikon foran teksten.
- Bredere min-width (180px) så fulde labels kan ses.
- Tilføj `aria-label="Vælg sæson"`.
- Tilføj header "Skift sæson" øverst i dropdown-listen som visuel afklaring.
- Sortér sæsoner faldende (nyeste først) i listen.
- Skriv "kvalifikation" fuldt ud i stedet for "kval" inde i menuen.

Ingen logik-ændringer. Ingen andre filer rørt.

### Zone

Grøn — kun visuel polish af eksisterende komponent.