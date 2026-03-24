

# Forbedring: Søgbar medarbejder-vælger i Match Errors

## Problem
Den nuværende Select-dropdown viser alle medarbejdere i en lang liste uden søgning. Det er svært at finde den rigtige medarbejder hurtigt.

## Løsning
Erstat Select med en Popover + Command (cmdk) komponent — en søgbar dropdown med fuzzy-filtrering. Projektet har allerede `command.tsx` og `popover.tsx` UI-komponenter.

### Ændringer i `MatchErrorsSubTab.tsx`

1. **Erstat Select med Popover + Command** — Hver række får en knap der åbner en popover med et søgefelt og filtreret medarbejderliste. Brugeren skriver navn og vælger fra den filtrerede liste.

2. **Vis valgt medarbejders fulde navn** på knappen efter valg, i stedet for truncated tekst.

3. **Én åben popover ad gangen** — Track `openPopoverIdx` state så kun én popover er åben.

### UI-flow
```text
[Vælg medarbejder... ▼]  →  klik  →  Popover med:
  ┌──────────────────────┐
  │ 🔍 Søg medarbejder...│
  │ ──────────────────── │
  │ Adam Jensen           │
  │ Noah Wichmann Duus    │
  │ Silas Soelberg-Larsen │
  │ ...                   │
  └──────────────────────┘
```

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

