

# Tilføj sidebar til Onboarding Analyse

## Problem
Siden `OnboardingAnalyse.tsx` returnerer et rå `<div>` uden `<MainLayout>` wrapper, så sidemenuen mangler.

## Løsning
Wrap indholdet i `<MainLayout>` — præcis som alle andre sider (Sales, CompanyOverview, Permissions osv.) gør det.

## Ændring
**Fil:** `src/pages/OnboardingAnalyse.tsx`
- Importér `MainLayout` fra `@/components/layout/MainLayout`
- Wrap det eksisterende return `<div>` i `<MainLayout>...</MainLayout>`

Det er en ændring på 3 linjer — ingen logik ændres.

