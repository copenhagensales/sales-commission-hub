# Info-, rediger- og sletknapper på kommende begivenheder

## Hvad brugerne får
- Hver linje under "Kommende begivenheder" (fx "27. nov. JULEFROKOST") får de samme små knapper til højre som "Næste begivenhed".
- **Info** (i): alle kan bruge den. Den åbner begivenhedens detaljer.
- **Blyant og skraldespand**: vises kun for ejere og rolle Rekruttering (Oscar Belcher). Andre ser dem ikke.
- Samme regel gælder også for knapperne på "Næste begivenhed". Det betyder én fælles regel i stedet for to.

## Rettigheder (ikke hardkodet)
- Rettigheden "Opret/redigér begivenheder" findes allerede under Rettigheder. Rollen Rekruttering får redigeringsadgang til den. Ejere har den i forvejen.
- Databasen tillader allerede ændringer for alle, der har den rettighed. Derfor kræves ingen nye adgangsregler.
- Konsekvens: alle med rollen Rekruttering kan rette begivenheder, ikke kun Oscar. Hvis det kun skal være Oscar, gives rettigheden i stedet til ham personligt, ligesom ved Superliga.

## Ændring af nuværende adfærd
I dag kan ejere og den person, der har oprettet en begivenhed, rette og slette den. Med planen mister den, der har oprettet begivenheden, adgangen, medmindre personen er ejer eller har rollen Rekruttering. Sig til, hvis de stadig skal have adgang.

## Tekniske detaljer
- Data: `role_page_permissions` får `rekruttering` med `can_edit=true` for `action_manage_company_events` (upsert). Det er rød zone, fordi det handler om rettigheder.
- `src/pages/Home.tsx`: `canManageEvents = canEdit('action_manage_company_events')` fra `usePermissions()`. Ejere er dækket af den eksisterende ejerregel. Værdien sendes til `NextEventHero`, og knapperne Info/Pencil/Trash2 tilføjes på hver række i `rest.map` med `setSelectedEventForDetail`, `setEditingEvent` og `deleteEventMutation`.
- Det skal kontrolleres, at `has_edit_permission` læser rolle-rettigheder. RLS-policyen findes allerede.
- Ingen ændringer i databaseskemaet.
