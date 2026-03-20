
# Tilføj Kundehenvendelser til AppSidebar

## Problem
"Kundehenvendelser" blev kun tilføjet til `PreviewSidebar` (preview-mode), men den rigtige sidebar i normal brug er `AppSidebar`. Derfor er menupunktet usynligt.

## Ændringer

### 1. `src/components/layout/AppSidebar.tsx`
- Tilføj `Inbox` icon til imports (linje 1)
- Udvid `showLedelseMenu` betingelsen (linje 438-439) til at inkludere `p.canView("menu_customer_inquiries")`
- Tilføj `/customer-inquiries` til `ledelseOpen` state-initialisering (linje 67)
- Tilføj `/customer-inquiries` til Collapsible trigger active-check (linje 913)
- Tilføj NavLink for Kundehenvendelser i Ledelse-menuen (efter Pulsmåling, før `</CollapsibleContent>` ca. linje 1033):
  ```tsx
  {p.canView("menu_customer_inquiries") && (
    <NavLink to="/customer-inquiries" onClick={handleNavClick} className={...}>
      <Inbox className="h-4 w-4" />
      Kundehenvendelser
    </NavLink>
  )}
  ```

### 2. Ingen andre filer
Database-rettigheden er allerede korrekt indsat. Route og side eksisterer allerede.

| Fil | Handling |
|-----|---------|
| `src/components/layout/AppSidebar.tsx` | Tilføj Kundehenvendelser menupunkt under Ledelse |
