

## Problem: Auto-fordel kampagner matcher ikke "Eesy TM"

### Årsag
`parseClientFromTitle()` (linje 143-165) matcher kun kampagner til kunder hvis kampagne**navnet** indeholder kundenavnet efter en separator (f.eks. "Noget - Eesy TM"). Kampagner som "70108", "91834", "Campaign 80334", "Blandet leads - Premium" osv. indeholder ikke "Eesy TM" nogen steder i navnet, så auto-fordelingen springer dem over.

### Løsning: Tilføj "default client" heuristik

Udvid `autoAssignCampaigns`-logikken med en **fallback-strategi**: Hvis `parseClientFromTitle` ikke finder et match, og **størstedelen af allerede mappede kampagner** peger på én bestemt kunde, tildel nye kampagner til samme kunde.

**Fil: `src/pages/MgTest.tsx`**

1. **Udvid `autoAssignCampaigns` mutationen** (linje 1674-1737):
   - Efter den eksisterende `parseClientFromTitle`-loop, find kampagner der stadig er umappede
   - Beregn hvilken kunde der har flest allerede mappede kampagner (den "dominerende" kunde)
   - Hvis én kunde har ≥60% af de mappede kampagner, tildel resterende umappede kampagner til denne kunde
   - Vis i toast-beskeden hvor mange der blev fordelt via navnematch vs. default

2. **Alternativ tilgang** (enklere, mere forudsigelig):
   - Tilføj en "Standard kunde for nye kampagner"-dropdown i UI'et ved siden af "Auto-fordel"-knappen
   - Brugeren vælger f.eks. "Eesy TM", og auto-fordel tildeler alle umappede til denne kunde
   - Gemmes evt. i localStorage eller en settings-tabel

### Anbefaling
Tilgang 2 (dropdown) er mere forudsigelig og giver brugeren kontrol. Tilgang 1 (dominerende kunde) er mere automatisk men kan lave fejl hvis der er flere kunder.

### Tekniske detaljer
- Ændring kun i `src/pages/MgTest.tsx`
- Dropdown bruger eksisterende `clients`-data
- Auto-fordel logikken udvides til at bruge valgt default-kunde som fallback

