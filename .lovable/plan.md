

# Flyt kundevælger til toppen af Annulleringer-siden

## Hvad
En global kundevælger i toppen af `/salary/cancellations` som alle tabs deler. Når man vælger en kunde, handler hele siden om den kunde.

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/pages/salary/Cancellations.tsx` | Tilføj `selectedClientId` state + clients query + Select i toppen. Send `clientId` som prop til alle tab-komponenter. |
| `src/components/cancellations/ManualCancellationsTab.tsx` | Modtag `clientId` prop i stedet for egen kundevælger. Fjern lokal `selectedClientId` state og client-select UI. |
| `src/components/cancellations/UploadCancellationsTab.tsx` | Modtag `clientId` prop. Fjern lokal kundevælger. |
| `src/components/cancellations/DuplicatesTab.tsx` | Modtag `clientId` prop. Fjern lokal kundevælger. Behold "Alle kunder" som fallback når `clientId` er tom. |
| `src/components/cancellations/ApprovalQueueTab.tsx` | Modtag `clientId` prop. Filtrer queue items på `client_id` når sat. |
| `src/components/cancellations/UnmatchedTab.tsx` | Modtag `clientId` prop. Filtrer imports/results på den valgte kunde. |

## Teknisk detalje

**Cancellations.tsx** — ny state og UI:
```tsx
const [selectedClientId, setSelectedClientId] = useState("");
// Query clients
// Render Select i header-sektionen mellem titel og tabs
```

**Alle tabs** — interface ændring:
```tsx
interface Props { clientId: string; }
// Erstatter lokal selectedClientId med props.clientId
// Fjerner client Select fra UI
// Queries bruger clientId fra props
```

**ApprovalQueueTab + UnmatchedTab** — filtrering:
- Disse tabs har ikke en eksisterende kundevælger, så de får tilføjet et `.eq("client_id", clientId)` filter på deres queries når `clientId` er sat.

