

# Fjern hover-effekt fra logo

## Problem
Logo-elementet i sidebaren er pakket ind i en `div` med klassen `hover:bg-sidebar-accent/50`, som viser en synlig baggrundskasse naar musen holdes over logoet.

## Loesning
Fjern `hover:bg-sidebar-accent/50` fra begge logo-wrapper `div`-elementer i `src/components/layout/AppSidebar.tsx` (linje 403 og 488).

## Tekniske detaljer

### Fil: `src/components/layout/AppSidebar.tsx`

**Linje 403** (desktop-visning):
- Fra: `className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"`
- Til: `className="flex items-center justify-center px-3 py-2"`

**Linje 488** (mobil-visning):
- Samme aendring som ovenfor.

Ingen andre filer eller databaseaendringer er noedvendige.

