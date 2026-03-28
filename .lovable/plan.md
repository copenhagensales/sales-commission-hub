

## Opdater leverandørtabel med bekræftede oplysninger

**Fil:** `src/pages/compliance/AdminDocumentation.tsx` (linje 100-115)

Erstatter `[afklar]`-placeholders med faktiske værdier:

| Leverandør | DPA | Tredjeland | Sidst vurderet |
|------------|-----|------------|----------------|
| Lovable | Ja (Business/Enterprise) | Nej (EU-hostet) | [dato] |
| Supabase (via Lovable Cloud) | Ja (inkl. i Lovable Cloud) | Nej (EU-hostet) | [dato] |

- DPA-felter: grøn badge med "Ja" + kort note
- Tredjeland-felter: grøn badge med "Nej (EU-hostet)"
- `[dato]` forbliver som gul placeholder — I udfylder selv datoen for seneste vurdering
- Tilføj en kort note under tabellen: *"Bekræft at DPA'er er underskrevet og arkiveret."*

