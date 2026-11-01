# Ny fane: TDC Erhverv Fiber (pladsholder)

## Hvad brugeren ser
Under Registrér salg kommer en tredje fane i toppen: **TDC Erhverv Fiber**. Siden viser kun en kort tekst: »TDC Erhverv Fiber – kommer snart«. Intet kan indtastes eller gemmes endnu.

## Hvem ser fanen
Samme personer, som i dag ser fanen »Salg« (ingen nye rettigheder oprettes nu). Når siden får indhold, kan den få sin egen rettighed.

## Teknisk
- Ny komponent `src/pages/TdcErhvervFiberPladsholder.tsx` (kun tekst, ingen datakald), lazy i `src/routes/pages.ts`.
- `src/pages/samlesider/MitArbejde.tsx`: ny fane `{ id: "tdc-erhverv-fiber", label: "TDC Erhverv Fiber", synlig: salg.salg }`, åbnes via `/registrer-salg?tab=tdc-erhverv-fiber`.
- Ingen database, rettighedsfiler, routes eller migrationer ændres. Desktop og mobil (360/393/430) tjekkes visuelt.
