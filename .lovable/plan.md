

# Erstat "Afventer" sub-tab: Vis alle pending salg (uden import-vælger)

## Hvad
Fjern den nuværende import-baserede logik i "Afventer"-fanen. I stedet vis alle salg med `validation_status = 'pending'` for den valgte kunde, som IKKE allerede ligger i `cancellation_queue` (hverken som annullering eller kurvrettelse).

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/components/cancellations/UnmatchedTab.tsx` | Komplet omskrivning. Fjern import-vælger og al import-relateret logik. Erstat med en simpel query: hent alle salg med `validation_status = 'pending'` for kundens kampagner, ekskluder dem der har en `sale_id` i `cancellation_queue`. Vis i en tabel med dato, sælger, OPP, produkter, omsætning, telefon, virksomhed. |

## Teknisk detalje

**Query-logik:**
1. Hent kampagne-IDs for `clientId` via `client_campaigns`
2. Hent alle `sale_id`s fra `cancellation_queue` (uanset status) → Set
3. Hent salg fra `sales` hvor `client_campaign_id in campaignIds` og `validation_status = 'pending'`
4. Filtrer salg der IKKE er i cancellation_queue-sættet
5. Hent `sale_items` med produktnavne for visning

**UI:** Simpel tabel uden import-vælger. Viser "Ingen afventende salg" hvis listen er tom. Behold `extractOpp`-hjælpefunktionen.

