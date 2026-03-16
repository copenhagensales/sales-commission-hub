

## Pulsmåling som menupunkt med badge i sidebaren

### Problem
Pulsmålingen vises kun som popup — der er intet menupunkt for medarbejdere i sidebaren. Hvis popup'en misses eller dismisses, er der ingen måde at finde pulsmålingen igen.

### Løsning
Tilføj et "Pulsmåling"-menupunkt i medarbejder-sektionen af `AppSidebar.tsx` med en pulserende badge, der viser at der er en aktiv ubesvaret survey.

### Ændringer

**1. `src/components/layout/AppSidebar.tsx`**
- Importér `useShouldShowPulseSurvey` fra `@/hooks/usePulseSurvey`
- Importér `ClipboardCheck` icon fra lucide-react
- Kald hooket i komponenten for at få `showMenuItem`, `showBadge`
- Tilføj menupunkt efter "Min Feedback" (ca. linje 601) med:
  - Link til `/pulse-survey`
  - `ClipboardCheck` icon
  - Tekst: "Pulsmåling"
  - Pulserende badge (rød "1" med `animate-pulse`) når `showBadge` er true

```text
Sidebar-sektion (medarbejder):
  Hjem
  Beskeder
  Min Profil
  Min Feedback
  ★ Pulsmåling  ← NY, med badge
  Løn & Mål
  ...
```

### Ingen database-ændringer
Hooket `useShouldShowPulseSurvey` eksisterer allerede og returnerer de korrekte værdier. Kun frontend-ændring i sidebaren.

