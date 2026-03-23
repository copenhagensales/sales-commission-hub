

# Split godkendelseskø i to: Annulleringer og Kurv-rettelser

## Problem
Alt blandes i én liste. Brugeren vil have separate visninger for annulleringer og kurv-rettelser.

## Løsning
Tilføj en intern tab-switcher (Tabs) i `ApprovalQueueTab` der filtrerer på `upload_type`:
- **Annulleringer** (`upload_type === "cancellation"`)
- **Kurv-rettelser** (`upload_type === "basket_difference"`)

Hver sub-tab viser sin egen tabel med egne "Godkend alle / Afvis alle" knapper og tæller.

## Ændring

| Fil | Hvad |
|-----|------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Tilføj intern `Tabs` med "Annulleringer" og "Kurv-rettelser". Filtrer `oppGroups` og `flatItems` på `uploadType`/`upload_type` per tab. Flyt bulk-actions og tabeller ind i hver tab. |

## Teknisk detalje
- `filteredOppGroups` og `filteredFlatItems` splittes yderligere med `.filter(x => x.uploadType === activeSubTab)` hhv. `.filter(x => x.upload_type === activeSubTab)`
- Sub-tab state: `const [subTab, setSubTab] = useState<"cancellation" | "basket_difference">("cancellation")`
- Tælling per sub-tab vises i tab-label: "Annulleringer (12)" / "Kurv-rettelser (3)"
- Eksisterende status-filter og "kun forskelle" checkbox bevares og virker inden for den aktive sub-tab

