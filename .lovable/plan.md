

# Annulleringer fra godkendelsesfanen → Sælgerlønninger

## Hvad
Hent godkendte annulleringer fra `cancellation_queue` og vis den tabte provision per sælger i "Annulleringer"-kolonnen på Sælgerlønninger-tabellen, som i dag altid viser 0 kr.

## Logik
For den valgte lønperiode: hent alle `cancellation_queue`-rækker med `status = 'approved'`, hvor `deduction_date` (fallback til `reviewed_at`) falder inden for perioden. Join med `sales` (for `agent_email`) og `sale_items` (for `mapped_commission`). Aggregér provision per sælger.

## Ændringer

### `src/hooks/useSellerSalariesCached.ts`
1. Tilføj en ny query (Query 7) der henter godkendte annulleringer for perioden:
   - `cancellation_queue` → `status = 'approved'`
   - Join `sales` for agent_email og `sale_items` for mapped_commission
   - Filtrér på `deduction_date` (eller `reviewed_at`) inden for `periodStart`–`periodEnd`
   - Aggregér total provision per employee_id (via agent_email → employee mapping)
2. Byg et `cancellationMap: Record<string, number>` i useMemo
3. Sæt `cancellations: cancellationMap[emp.id] || 0` i stedet for det nuværende hardcoded `0`

### Ingen ændringer i UI
`SellerSalariesTab.tsx` viser allerede `seller.cancellations` — kolonnen er der, den mangler bare data.

