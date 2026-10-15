# Fanny Schjønning: Løn & Mål følger ikke hendes salg

## Fund (read-only, bekræftet)
- Fanny (provisionslønnet, aktiv) har **ingen kobling i agent-mappingen**. Hendes salg er Fieldmarketing-salg registreret på `fasc@copenhagensales.dk` (136 salg siden 15/9, seneste i dag 11:23).
- Salgene har alle salgslinjer og provision (fx 14/10: 10 salg, 3.630 kr.). Data er altså i orden.
- **Mål-fanen** henter agent-mails og falder tilbage til arbejdsmailen, når mapping mangler (`usePersonalSalesStats.ts:46-56`) → hun bør få tal her (opdateres hvert 2. min.).
- **Løn-fanen** (`PayrollDayByDay.tsx:28-58`) henter KUN mails fra mappingen og har ingen fallback. Uden mapping er listen tom → salg, annulleringer og provision på Løn-fanen vises ikke.
- Samme problem rammer 30 af 33 FM-sælgere med salg siden 15/9 (de har heller ingen mapping).

Ikke bekræftet: om Fanny også oplever fejl på Mål-fanen. Jeg har ikke kunnet køre aggregerings-funktionen som hende. Trin 1 tjekker det i browseren.

## Plan
1. Åbn Løn & Mål som Fanny (visning som medarbejder) og bekræft: Løn-fanen tom/forkert, Mål-fanen korrekt.
2. Saml mail-opslaget ét sted: én fælles hook `useEmployeeSalesEmails(employeeId)` (mapping → fallback til arbejdsmail, lowercase), som både `usePersonalSalesStats` og `PayrollDayByDay` bruger. Ingen dobbelt logik.
3. Ingen ændring af provisionsberegning, satser, løndata eller databasen. Kun hvilke salg Løn-fanen læser.
4. Lille test for fallback-reglen (mapping findes → bruges; mangler → arbejdsmail).
5. Browserkontrol: Fannys Løn-fane viser hendes salg/provision dag for dag, og summen matcher Mål-fanen for samme periode. Stikprøve på én TM-sælger med mapping (uændret).

## Teknisk
- Filer: ny `src/hooks/useEmployeeSalesEmails.ts` (+test af ren funktion i `src/lib/`), `src/hooks/usePersonalSalesStats.ts`, `src/components/my-profile/PayrollDayByDay.tsx`.
- Query-key ændres ikke for salgsdata; agent-mail-keys samles.
- Løn-visning er gul/rød zone: kun visningskilde ændres, ingen beregning.
