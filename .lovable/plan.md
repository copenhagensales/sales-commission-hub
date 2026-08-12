# Indtastninger vises ikke i kontrakt-forhåndsvisningen

## Årsag (bekræftet i koden)

Forhåndsvisningen bygger på en tekst, der kun bliver flettet **én gang** — i det øjeblik du vælger skabelon.

- `src/components/contracts/SendContractDialog.tsx:402-410`: `handleTemplateChange` kalder `mergeContent(template.content)` og gemmer resultatet i `previewContent`. På det tidspunkt er Team, Timeløn, Månedsløn og Bonus stadig tomme, så pladsholderne bliver erstattet af `[Team ikke angivet]` / `[Bonus ikke angivet]`.
- `src/components/contracts/SendContractDialog.tsx:888`: "Forhåndsvis"-knappen sætter kun `setShowPreview(true)` — den fletter ikke igen med de nye værdier.
- `src/components/contracts/SendContractDialog.tsx:422-423`: ved afsendelse flettes indholdet **på ny**, så den afsendte kontrakt faktisk får dine værdier. Det er altså udelukkende forhåndsvisningen der er forkert (i dette tilfælde).

Bemærk: felterne kun-læses hvis skabelonen bruger `{{team}}`/`{{bonus}}` (eller `${...}`)-pladsholdere. Hvis skabelonteksten i stedet er skrevet med firkantede klammer som fast tekst, vil intet blive erstattet — det verificeres som første skridt.

## Løsning

1. Verificér skabelonens indhold ("Assisterende teamleder kontrakt (timeløn)") for at bekræfte hvilke pladsholder-navne der bruges til team og bonus.
2. Gør forhåndsvisningen live: udled den flettede tekst fra de aktuelle felter i stedet for at gemme den i state ved skabelonvalg — dvs. beregn `mergeContent(template.content)` når forhåndsvisningen åbnes (og ved hver ændring), så Team, Timeløn, Månedsløn og Bonus altid er med.
3. Hvis skabelonen mangler korrekte pladsholdere, retter vi skabelonteksten så den bruger `{{team}}`, `{{bonus}}`, `{{timeløn}}`, `{{månedsløn}}`.

## Teknisk

- Fil: `src/components/contracts/SendContractDialog.tsx` (gul zone — UI/præsentation, ingen løn- eller pricing-logik).
- Erstat `previewContent`-state med en `useMemo`-afledt værdi baseret på valgt skabelon + de fire assistent-felter og teamleder-felterne; `handleTemplateChange` sætter derefter kun titel og valgt id.
- Ingen ændringer i afsendelseslogikken (`mergeContent` kaldes allerede friskt der), ingen DB-ændringer medmindre skabelonteksten skal rettes (trin 3).
