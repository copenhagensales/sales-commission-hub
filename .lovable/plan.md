

## Forbedret kontraktvisning — UI/UX opgradering

### Nuværende tilstand
Siden har allerede en god grundstruktur med progress stepper, header card, dokumentindhold og signatur-sektion. Men der er plads til forbedringer i overblik, hierarki og professionelt udtryk.

### Foreslåede forbedringer

**1. Sidebar-navigation med indholdsfortegnelse (Table of Contents)**
Tilføj en sticky sidebar (kun desktop) der viser kontraktens sektioner (H2-overskrifter) som klikbare links. Giver overblik over hele dokumentet og mulighed for at springe til specifikke sektioner. Parseres automatisk fra kontraktens HTML-indhold.

**2. Læse-progress-indikator**
En tynd progress-bar i toppen (under sticky header) der viser hvor langt brugeren er i dokumentet. Giver en fornemmelse af fremdrift og hvor meget der er tilbage at læse.

**3. Forbedret header-layout**
- Flyt metadata-pills til en mere struktureret grid-layout i stedet for wrappende badges
- Tilføj afsender-info (hvem sendte kontrakten) som et dedikeret felt
- Gør "GODKENDT"-stemplet mere subtilt og placér det inline

**4. Forbedret dokument-container**
- Tilføj sidenumre-lignende sektionsindikatorer i marginen
- Lys baggrund på selve dokumentet for bedre kontrast mod siden (paper-on-background effekt)
- Subtil skygge for at give "papir"-fornemmelsen

**5. Forbedret signatur-sektion**
- Vis signaturer som en tabel/grid i stedet for timeline når kontrakten er underskrevet
- Tilføj et visuelt "certifikat"-look for færdigunderskrevne kontrakter

**6. Sticky action-bar ved bunden (mobil)**
Erstat den bouncing floating button med en fast action-bar i bunden på mobil med accept-checkbox og underskriv-knap synlig hele tiden.

### Tekniske ændringer

**Fil: `src/pages/ContractSign.tsx`**
- Tilføj `TableOfContents` komponent der parser H2-tags fra `contract.content` via regex og renderer som klikbare anchor-links
- Tilføj scroll-progress state via `useEffect` + `scroll` event listener
- Restructurer layout til `flex` med sidebar + main content på desktop (`lg:flex lg:gap-8`)
- Tilføj progress-bar `<div>` i sticky header med dynamisk width
- Opdater dokument-container med eksplicit hvid/lys baggrund: `bg-white dark:bg-card` med `shadow-xl`
- Forbedret mobil action-bar: fast `fixed bottom-0` bar i stedet for floating bounce-button
- Refaktor signatur-kort med grid-layout for underskrevne kontrakter

### Struktur efter ændring
```text
┌─────────────────────────────────────────────┐
│ Sticky Header  [Status] [Progress ████░░░] │
├───────────────┬─────────────────────────────┤
│ TOC Sidebar   │  Contract Header Card       │
│ (sticky,      │  ─────────────────────────  │
│  desktop only)│  Document Content            │
│               │  (paper-style container)     │
│ § 1 Parterne  │                              │
│ § 2 Stilling  │  ...contract text...         │
│ § 3 Løn       │                              │
│ § 4 Ferie     │  ─────────────────────────  │
│ ...           │  Signatures Grid             │
│               │  ─────────────────────────  │
│               │  Sign Action Section         │
├───────────────┴─────────────────────────────┤
│ Mobile: Fixed Bottom Action Bar             │
└─────────────────────────────────────────────┘
```

### Omfang
- **1 fil ændres**: `src/pages/ContractSign.tsx`
- Ingen database-ændringer
- Ingen nye dependencies
- Alle ændringer er rent visuelle/UX

