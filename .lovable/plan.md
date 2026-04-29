# Multi-select i rapport-filtre

## Mål
På `/reports/admin` (filterpanelet) skal man kunne vælge **flere** Teams, Medarbejdere, Kunder og Kampagner samtidig — i stedet for kun ét ad gangen. Periode forbliver single-select. Kolonner er allerede multi-select.

## Hvad ændres

**Fil:** `src/pages/reports/ReportsAdmin.tsx` (grøn zone — UI-only)

### State
- `selectedTeam: string` → `selectedTeams: string[]`
- `selectedEmployee: string` → `selectedEmployees: string[]`
- `selectedClient: string` → `selectedClients: string[]`
- `selectedCampaign: string` → `selectedCampaigns: string[]`
- Default `[]` (= "Alle").

### UI-mønster
Genbrug det samme Popover + Checkbox + scroll-liste mønster som "Kolonner i rapport" allerede bruger længere nede i filen. Hver dropdown viser:
- Trigger-knap med tekst: `"Alle"` hvis tom, ellers `"{n} valgt"` (eller første navn + `+N` hvis 1–2 valgt).
- Popover-indhold med en scrollbar liste af checkboxes (max-height ~280px).
- Toggle-funktion pr. felt (samme idé som eksisterende `toggleColumn`).
- Bevarer den hvide-på-grøn glassmorphism-styling fra de nuværende `Select`-triggers.

### Kampagne-filtrering
Hvis brugeren har valgt en eller flere kunder, filtreres campaign-listen til kun kampagner hvor `campaign.client_id` matcher én af de valgte kunder. Hvis ingen kunder valgt, vises alle kampagner (uændret).

### Aktiv filter-badge
`getActiveFilterCount()` opdateres: tæller +1 pr. ikke-tom array.

### Header-sammendrag
Sammendraget under "Rapport" kortet opdateres til at vise antal valgte (f.eks. `• 3 teams`, `• 2 kunder`) i stedet for ét navn — undtagen ved præcis 1 valgt, så vises navnet.

### Søg-handler
`handleSearch` logger nu arrays. Faktisk rapport-generering er stadig en stub (`toast.success("Rapport genereres...")`) — uændret adfærd, blot multi-værdier i payload.

## Out of scope
- Ingen ændringer i datafetching, RPC'er, eller selve rapport-genereringen (den er allerede en stub i denne fil).
- Ingen ny UI-komponent i `components/ui/` — vi inliner mønsteret som i dag for at holde ændringen minimal.
- Ingen ændringer til Periode (single-select er korrekt der).

## Risiko
Grøn zone. Ingen DB, ingen pricing, ingen løn. Eneste forbruger af state er denne fil selv.
