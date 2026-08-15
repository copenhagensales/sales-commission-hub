# Marker salg som Claim/Reimport i "Ret salgsregistrering (Leder)"

## Hvad der bygges

1. **Ny knap pr. salg i redigeringsboksen**
   - I dialogen "Rediger hele salgsgruppen" (som åbnes via Rediger ud fra en sælger) får hvert salg en knap "Marker som Claim/Reimport".
   - Knappen er en til/fra-markering: umarkeret = neutral, markeret = fremhævet med teksten "Claim/Reimport".
   - Startværdien er salgets nuværende værdi, så et salg der allerede er markeret, vises som markeret.

2. **Gemmes ved "Gem ændringer"**
   - Når der trykkes Gem ændringer, gemmes markeringen på hvert enkelt salg (true/false).
   - Salg man fjerner markeringen fra får værdien false igen.
   - Nye salg, man tilføjer i samme dialog, kan også markeres og gemmes med markeringen.

3. **Vises under "Eesy FM afvigelser (Leder)"**
   - Markerede salg dukker op på fanen Claims/Reimport, som i dag læser præcis den markering. Gælder salg på kunden Eesy FM.
   - Ingen godkendelse sættes automatisk — salget starter som "Afventer", indtil en leder godkender det på fanen.

4. **Kommentarkrav**
   - Ligesom ved sælgernes egen registrering kræves en kommentar på salget, når markeringen er slået til. Mangler kommentaren, gemmes der ikke, og der vises en fejlbesked med hvilket salg der mangler tekst.

5. **Uændret**
   - Ingen ændring af pris, provision, rapporter eller de øvrige felter. Markeringen vises fortsat kun i tabellen i "Ret salgsregistrering (Leder)" og på Claims/Reimport-fanen.

## Teknisk

- `src/pages/vagt-flow/EditSalesRegistrations.tsx`:
  - `GroupSaleItem` udvides med `claim_reimport: boolean`.
  - `openGroupEditDialog` initialiserer feltet fra `sale.claim_reimport` (findes allerede på `SaleRecord`, læst fra `raw_payload.fm_claim_reimport`).
  - Ny toggle-knap i hvert salgs-kort (ved siden af Slet) som kalder `updateGroupSaleItem(index, 'claim_reimport', !item.claim_reimport)`.
  - `handleGroupSave` validerer: for hvert ikke-slettet item med `claim_reimport === true` skal `comment` være udfyldt, ellers `toast.error` og afbryd.
  - `updateGroup`-mutationen skriver `fm_claim_reimport: item.claim_reimport === true` i `raw_payload` både i update-grenen og i `newSales`-insert-grenen. Ingen ændring af `coreDataChanged`-logikken, så pricing/rematch kun trigges som i dag.
  - `onSuccess` invaliderer desuden `["eesy-fm-claim-sales"]`, så Claims/Reimport-fanen opdateres uden reload.
- Ingen DB-migration; feltet ligger i `sales.raw_payload` som i dag. Ingen ændringer i `useEesyFmClaimSales.ts`, pricing-service eller rapport-RPC'er.
