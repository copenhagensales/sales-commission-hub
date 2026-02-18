
# Tilpas tidslinje og overlap-detektion

## Problem

Tidslinjen og overlap-detektionen sammenligner alle integrationer mod hinanden, men overlap er kun relevant mellem integrationer der deler samme provider-type. ASE (Enreach) og Lovablecph (Adversus) pavirker ikke hinanden, da de rammer forskellige API'er.

## Forslag

### Option A: Grupper overlap per provider (anbefalet)

Behold tidslinjen som et overblik, men aendr overlap-detektionen saa den kun markerer konflikter mellem integrationer med **samme provider**.

**Aendringer:**

1. **TimelineOverlap.tsx** -- Tilfoej `provider` til Integration-interfacet og grupper overlap-detektion:
   - Vis stadig alle integrationer paa tidslinjen (nyttigt overblik)
   - Men kald kun `detectOverlaps()` inden for samme provider-gruppe
   - Roede markeringer vises kun for reelle konflikter (fx to Adversus-integrationer der syncer samtidig)

2. **ScheduleEditor.tsx** -- Filtrer overlap-preview:
   - Naar en integration vaelges, sammenlignes dens nye schedule kun med andre integrationer af samme provider-type
   - "Ingen konflikter" badget vises kun baseret paa relevante integrationer

3. **cronOverlapDetector.ts** -- Udvid `detectOverlaps()`:
   - Tilfoej optional `provider`-filter saa funktionen kun sammenligner jobs med matchende provider
   - Eksisterende kald uden provider fungerer stadig (backward compatible)

### Filer der redigeres
- `src/components/system-stability/TimelineOverlap.tsx`
- `src/components/system-stability/ScheduleEditor.tsx`
- `src/utils/cronOverlapDetector.ts`

### Ingen nye filer eller database-aendringer
