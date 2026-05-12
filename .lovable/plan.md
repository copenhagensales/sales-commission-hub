## Problem
Kunder-dropdown'en på `/reports/daily` viser kun A→E (7 første kunder). Tryg, TDC Erhverv, Yousee m.fl. ligger længere nede, men dropdown'en kan ikke scrolles.

## Root cause
`src/components/reports/MultiSelectFilter.tsx` linje 88:
```
<div className="space-y-1 max-h-[280px] overflow-y-auto">
```
Listen overflow'er korrekt rent CSS-mæssigt, men komponenten bruges inde i en Radix `Sheet` (filterpanelet, `DailyReports.tsx:1236`). Sheet'ens scroll-lock og event-håndtering forhindrer wheel-events i at nå den indre `overflow-y-auto`-container i Popover'en.

## Fix
Én ændring i `src/components/reports/MultiSelectFilter.tsx`:

1. Erstat den rå `<div className="... overflow-y-auto">` med shadcn's `ScrollArea`-komponent (`@/components/ui/scroll-area`), som håndterer wheel-events korrekt inde i Sheet/Dialog-kontekster og giver synlig scrollbar.

```tsx
<ScrollArea className="max-h-[280px] pr-2">
  <div className="space-y-1">
    {visibleOptions.map(...)}
  </div>
</ScrollArea>
```

Det er en grøn-zone UI-ændring i én præsentationskomponent. Ingen forretningslogik, ingen DB.

## Verifikation
- Åbn `/reports/daily` → Filtre → Kunder. Bekræft at alle 14 kunder (incl. Tryg) kan scrolles.
- Samme komponent bruges også til Teams, Medarbejdere, Kampagner — bekræft at de stadig virker.
