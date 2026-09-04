# Alle tryg & alka salg — få alle salgslinjer med

## Hvad der er galt i dag

Fanen viser kun salg på produkter, der er koblet direkte til en Tryg-/ALKA-kampagne. Kun 5 af 110 salgslinjer i dag opfylder det.

Målt på dagen 4/9 2026 (kunderne Tryg + ALKA):

| Produkt | Linjer | Kundekobling ligger på |
| --- | --- | --- |
| Partnersalg - FDM - TRYG | 64 | salget |
| Meeting -- CPH sales Kanvas | 30 | salget |
| Partnersalg Hjerteforeningen - Tryg | 11 | salget |
| Lederne | 4 | både produkt og salg |
| Meeting -- FDM eksisterende | 1 | produktet |

De fleste Tryg-produkter har ingen kampagnetilknytning — kunden står i stedet på selve salget. Derfor falder de ud af visningen.

## Hvad der ændres

Fanen tager alle salgslinjer med, hvor **enten** produktet **eller** salget hører til Tryg eller ALKA. Kolonnen "Kunde" viser fortsat Tryg eller ALKA pr. linje, med kunden på salget som primær kilde og produktets kunde som reserve.

Ingen ændringer på Kanvas-møder-fanen, i status-markeringer, løn, provision eller rapporter. Ren læsning.

## Teknisk

`src/hooks/useTrygAlkaSales.ts`:

1. Hent kampagne-id'erne for Tryg + ALKA fra `client_campaigns` (client_id in [TRYG, ALKA]) og byg `campaignId -> clientName`.
2. Hent dagens `sale_items` i to spor og forén på `sale_items.id`:
   - salg hvor `sales.client_campaign_id` er en Tryg/ALKA-kampagne,
   - salg hvor `products.client_campaign_id` er en Tryg/ALKA-kampagne (dækker linjer uden kunde på salget).
   Begge spor filtreres på `sales.sale_datetime` inden for den valgte dag og henter `products(name)` samt `sales(id, sale_datetime, agent_email, agent_name, customer_phone, client_campaign_id)`.
3. `clientName` = kundenavn for salgets kampagne, ellers produktets kampagne, ellers "Ukendt kunde".
4. Sælgernavn-opslag via `employee_master_data.work_email` og sortering nyeste først bevares uændret.

`TrygSalesTable.tsx` og `TrygEditSales.tsx` ændres ikke.
