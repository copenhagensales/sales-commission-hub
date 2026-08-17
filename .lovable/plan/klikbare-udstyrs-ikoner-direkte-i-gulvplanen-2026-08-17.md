# Klikbare udstyrs-ikoner direkte i gulvplanen

## Mål
Man skal kunne klikke på fx headset-ikonet på et bordkort på forsiden og skifte status med ét klik — uden at åbne detalje-panelet. Klik igen fjerner markeringen.

## Adfærd
- Hvert udstyrs-ikon på bordkortet bliver sin egen klikbare knap.
- Klik skifter mellem OK og "mangler/defekt": ikonet får en rød overstregning (kryds) og bliver rødt. Klik igen sætter det tilbage til OK og krydset forsvinder.
- Klik på ikonet må ikke åbne bordets detalje-panel (kun klik uden for ikonerne gør det).
- Ændringen gemmes med det samme og optimistisk: ikonet skifter øjeblikkeligt, og rulles tilbage med en fejl-toast hvis gemning fejler.
- Hvert klik logges i aktivitetsloggen præcis som i dag (samme tekst), og opdaterer "sidst tjekket", så bordet ikke længere står som "Ikke verificeret".
- Tooltip/aria-label på hvert ikon: "Headset: OK — klik for at markere som mangler".

## Detaljer
- Krydset tegnes som en diagonal streg over ikonet (rød, tydelig), så det er læsbart i lille størrelse.
- Kun brugere med redigeringsadgang til IT-modulet får klikbare ikoner; øvrige ser dem uændret som i dag.
- Tre-vejs status (mangler vs. defekt) beholdes i detalje-panelet — hurtig-klik dækker kun OK/ikke-OK, da det er det man laver mest.

## Yderligere forslag til hurtigere arbejde (kan vælges til/fra)
1. **Alt OK direkte på kortet** — lille flueben-knap i kortets hjørne, der sætter hele bordet til OK og markerer det som tjekket i ét klik.
2. **Markér som opdateret på kortet** — samme princip for "opdateret nu", så 30-dages-uret nulstilles uden at åbne panelet.
3. **Tastatur-flow** — piletaster mellem borde og tal 1-6 til at toggle udstyr, når et bord er i fokus.
4. **Fortryd-toast** — "Fortryd" i toasten efter hvert klik, som sikkerhedsnet ved fejlklik.

Sig til hvilke af de fire du vil have med (eller alle), så bygges de i samme runde.

## Teknisk
- `src/components/it/WorkstationCard.tsx`: ikonerne bliver `<button>` inde i kortet (kortet skifter fra `<button>` til `<div role="button">` for at undgå ugyldig nesting), med `stopPropagation` på klik.
- Ny mutation-wrapper baseret på eksisterende `useSaveWorkstation` (`equipment`-feltet) med optimistisk cache-opdatering af `it-workstations`-queryen.
- Ingen DB-ændringer: `it_equipment.status` og `it_activity_logs` bruges som de er.
- Ingen ændringer i status-afledningen (`useItWorkstations.ts`) ud over evt. optimistisk cache-patch.
