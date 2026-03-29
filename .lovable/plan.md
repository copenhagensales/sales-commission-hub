

## Plan: Deduplikering af Excel-rækker baseret på telefonnummer — før klassificering

### Problem
Den nuværende dedup kører **efter** klassificering (linje 1812), og beholder blot den første entry per telefonnummer. Kravet er at merger rækker med samme telefonnummer **før** klassificering, så:
- Kun én entry per telefonnummer går videre til godkendelseskøen
- Et salg tæller kun som annullering hvis **alle** rækker for det telefonnummer er markeret som annullering

### Tilgang — Ingen ændringer i eksisterende logik

Indsæt et nyt trin **mellem** matching (som bygger `matchedSales`) og klassificering/queue-building (linje 1766). Eksisterende matching-logik, klassificeringslogik og product-matching forbliver 100% uændret.

### Implementering

**Fil:** `src/components/cancellations/UploadCancellationsTab.tsx`

**Trin 1 — Merger matchedSales efter telefonnummer (nyt trin før linje 1766)**

Efter `matchedSales` er færdigbygget fra matching, men før `queueItems` bygges:

1. Gruppér `matchedSales` efter normaliseret telefonnummer (via `normalizePhone()`)
2. For grupper med kun 1 entry → behold som-is
3. For grupper med flere entries → behold kun den **første** entry (den repræsenterer salget)
4. For den bevarede entry: Sammensæt `uploadedRowData` fra alle rækker i gruppen, så annullerings-check kan evaluere alle rækker:
   - Sæt "Annulled Sales" til "1" **kun** hvis alle rækker i gruppen har annulleringsmarkør
   - Hvis bare én række ikke er annullering → sæt "Annulled Sales" til "0"
   - Tilsvarende for `type_detection_column`: kun sæt cancellation-værdi hvis alle rækker har den

```text
Eksempel:
  phone=12345678, row1: Annulled Sales=1
  phone=12345678, row2: Annulled Sales=1
  → Merged: Annulled Sales=1 (alle er annullering) ✓

  phone=87654321, row1: Annulled Sales=1
  phone=87654321, row2: Annulled Sales=0
  → Merged: Annulled Sales=0 (ikke alle er annullering) ✗
```

5. Erstat `matchedSales` med den deduplikerede liste

**Trin 2 — Fjern den gamle dedup-logik (linje 1812-1834)**

Den eksisterende dedup efter `queueItems` er ikke længere nødvendig, da deduplikeringen nu sker før klassificering. Fjern `phoneLookup`, `seenPhones`, og `deduplicatedItems`-filteret. Batch-insert bruger `queueItems` direkte.

**Trin 3 — Opdater preview (Dubletter-fane, linje 1919-1932)**

Preview-logikken bruger allerede `matchedSales` til at vise dubletter. Da `matchedSales` nu er deduplikeret, skal preview i stedet vise de rækker der **blev merget** (fjernet). Gem en `mergedDuplicates`-liste under dedup-trinnet og vis den i preview-fanen med info-tekst: "Disse rækker blev automatisk slået sammen med en anden række for samme telefonnummer."

**Trin 4 — Opdater counts i toast**

Brug det nye antal (efter merge) i success-toast, og vis antal mergede rækker.

### Tekniske detaljer
- `normalizePhone()` funktionen (linje 136) bruges til at normalisere telefonnumre
- Annullerings-check sker via `type_detection_column`/`type_detection_values` OG "Annulled Sales" kolonne — begge skal evalueres for alle rækker i gruppen
- `matchedSales` er et array af `MatchedSale` — vi erstatter det med den filtrerede version
- Ingen ændringer i: matching-logik, product-matching, klassificeringslogik (linje 1766-1810), eller nogen anden eksisterende kode

### Filer
- `src/components/cancellations/UploadCancellationsTab.tsx`

