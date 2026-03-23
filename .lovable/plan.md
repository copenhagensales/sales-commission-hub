

# Flyt "Ingen match" ind som sub-tab "Afventer" i Godkendelseskøen

## Hvad
Fjern "Ingen match" som selvstændig top-fane. Tilføj den i stedet som en tredje sub-tab kaldet **"Afventer"** inde i Godkendelseskøen, ved siden af "Annulleringer" og "Kurv-rettelser". Denne fane viser alle salg der endnu ikke er matchet eller godkendt.

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/pages/salary/Cancellations.tsx` | Fjern "Ingen match" fra `visibleTabs` og fjern `<UnmatchedTab>` renderingen. |
| `src/components/cancellations/ApprovalQueueTab.tsx` | Tilføj tredje sub-tab "Afventer" i den interne `Tabs`. Importer og render `UnmatchedTab` indhold i denne sub-tab. Send `clientId` videre. |

## Teknisk detalje
- `ApprovalQueueTab` får en tredje `TabsTrigger` med value `"unmatched"` og label "Afventer".
- `TabsContent value="unmatched"` renderer `<UnmatchedTab clientId={clientId} />` direkte.
- `subTab` state udvides til `"cancellation" | "basket_difference" | "unmatched"`.
- Fjern `tab_cancellations_unmatched` permission-check og import fra `Cancellations.tsx`.

