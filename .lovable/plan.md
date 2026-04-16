

# Plan: Tilføj "Kampagne pris" betingelse til TDC Erhverv produkt-mapping

## Hvad ændres
En ny betingelse-kolonne "Kampagne pris" tilføjes til produkt-mapping dialogen, kun for TDC Erhverv. Valgmuligheder: Ja/Nej. Eksisterende produkters betingelser påvirkes ikke (de vil have "Ligegyldigt" som standard).

## Ændringer

**Fil: `src/components/cancellations/SellerMappingTab.tsx`**

1. **Udvid `ALLOWED_COLUMNS` for TDC Erhverv** (linje 174-176):
   - Fra: `["Produkt", "TT trin"]`
   - Til: `["Produkt", "TT trin", "Kampagne pris"]`

2. **Tilføj specialhåndtering i condition-builder dialogen** for "Kampagne pris" kolonnen:
   - I stedet for fritekst/checkbox-listen vises kun to valgmuligheder: "Ja" og "Nej" (hardcoded)
   - Operatoren låses til "Er en af" når der vælges en værdi, og "Ligegyldigt" som standard
   - Skjul "Tilføj værdi..." input-feltet for denne kolonne

3. **Tilføj "Kampagne pris" til `hiddenFields`** i `ApprovalQueueTab.tsx` (linje 303), så den ikke vises som rå data.

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**
- Tilføj `"Kampagne pris"` til TDC Erhverv `hiddenFields` sættet
- Vis "Kampagne pris" i structured rendering (som TT trin)

Ingen databaseændringer — den eksisterende `cancellation_product_conditions` tabel understøtter allerede vilkårlige kolonne-navne.

