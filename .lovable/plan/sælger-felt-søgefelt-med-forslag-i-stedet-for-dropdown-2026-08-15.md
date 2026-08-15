# Sælger-felt: søgefelt med forslag i stedet for dropdown

## Mål
I dialogen "Rediger" under Claims/Reimport erstattes sælger-dropdownen med et søgefelt (autocomplete), der viser forslag først når der er tastet mindst 3 tegn.

## Adfærd
- Fritekstfelt med placeholder "Søg sælger (min. 3 tegn)".
- 0-2 tegn: ingen forslagsliste.
- Fra 3 tegn: liste med sælgere, hvis navn starter med de indtastede bogstaver — først match på fornavn, derefter match på efternavn (fx "Jep" → Jeppe Buster Munk).
- Klik/Enter på et forslag vælger sælgeren, feltet udfyldes med det fulde navn og listen lukker.
- Valgt sælger vises tydeligt; ryddes feltet, nulstilles valget (gem kræver fortsat en valgt sælger).
- Ingen ændring af gemme-logik eller datakilder.

## Teknisk
- Kun `src/pages/vagt-flow/EesyFmDeviations.tsx` (ClaimEditDialog, linje ~299-313).
- Erstat `Select` med `Command`/`Popover`-baseret combobox fra `src/components/ui` (samme mønster som øvrige søgefelter i projektet), styret af lokal state: `sellerQuery` + eksisterende `sellerId`.
- Filtrering sker klientside på det eksisterende `useEesyFmSellers()`-resultat (accent/case-insensitiv, prefix-match), maks. ~20 forslag vist.
- Grøn zone: ren UI-ændring, ingen hooks, RPC'er eller pricing berøres.
