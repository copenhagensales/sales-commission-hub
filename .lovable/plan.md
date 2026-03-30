

## Fix: Filtrer "Korrekt match" fra Godkendte/Afviste-fanen + tilføj pagination

### Problem
Fanen viser 1000 rækker fordi den inkluderer 997 `correct_match`-rækker (automatisk godkendte korrekte matches) sammen med de ægte annulleringer (230) og kurv-rettelser (19). Supabase's 1000-rækkers grænse afskærer desuden reelle data.

### Ændringer

**`src/components/cancellations/ApprovedTab.tsx`**

1. **Filtrer `correct_match` fra queryen** — tilføj `.in("upload_type", ["cancellation", "basket_difference"])` til Supabase-queryen (linje 49), så kun ægte annulleringer og kurv-rettelser vises.

2. **Tilføj pagination** — brug `fetchAllRows` eller `.range()` med load-more for at undgå 1000-rækkers grænsen, så alle relevante rækker kan ses.

### Tekniske detaljer
- Queryen på linje 42-55 mangler et `upload_type`-filter og pagination
- `correct_match` er auto-godkendte rækker der bekræfter at salget er korrekt — de hører ikke til i denne oversigt
- Efter filtreringen reduceres Eesy FM fra ~1246 til ~249 rækker (230 annulleringer + 19 kurv-rettelser)

