

# Plan: Tilføj MainLayout til alle AMO-sider

## Problem
Ingen af AMO-siderne (`/amo`, `/amo/apv`, `/amo/meetings`, etc.) er wrapped i `<MainLayout>`, så sidebaren med navigation vises ikke når man er på disse sider.

## Løsning
Tilføj `<MainLayout>` wrapper til alle 11 AMO-sider, præcis som resten af appens sider gør det (f.eks. ReportsAdmin, Bookings, etc.).

## Filer der skal ændres
Alle filer i `src/pages/amo/`:
1. **AmoDashboard.tsx** — wrap return i `<MainLayout>`
2. **AmoApv.tsx** — wrap return i `<MainLayout>`
3. **AmoKemiApv.tsx** — wrap return i `<MainLayout>`
4. **AmoMeetings.tsx** — wrap return i `<MainLayout>`
5. **AmoAnnualDiscussion.tsx** — wrap return i `<MainLayout>`
6. **AmoTraining.tsx** — wrap return i `<MainLayout>`
7. **AmoDocuments.tsx** — wrap return i `<MainLayout>`
8. **AmoTasks.tsx** — wrap return i `<MainLayout>`
9. **AmoAuditLog.tsx** — wrap return i `<MainLayout>`
10. **AmoSettings.tsx** — wrap return i `<MainLayout>`
11. **AmoOrganisation.tsx** — wrap return i `<MainLayout>`

## Ændring per fil
- Tilføj `import { MainLayout } from "@/components/layout/MainLayout";`
- Wrap det yderste return-element i `<MainLayout>...</MainLayout>`

Ingen andre ændringer nødvendige — sidebaren har allerede AMO-navigationen konfigureret.

