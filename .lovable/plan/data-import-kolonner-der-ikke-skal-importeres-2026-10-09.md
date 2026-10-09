# Data import: kolonner der ikke skal importeres

## Hvad der bygges
- Hver kolonne får valget **"Importeres ikke"** i kategorivælgeren, fx til "age".
- En kolonne med "Importeres ikke" tæller som færdigdefineret i statuslinjen og skal ikke have kategori eller sletteregel. Den vises med et gråt mærke "Gemmes ikke".
- Ved upload bliver kolonnen fjernet, før noget gemmes, ligesom en udefineret kolonne. Der vises ingen advarsel om den, fordi det er et bevidst valg.
- **Undtagelse:** Kolonner, som matchingen bruger (telefon, sælger, dato, "Annulled Sales" og produktkolonner), gemmes stadig, så kurvmatchingen ikke går i stykker. Hvis man vælger "Importeres ikke" på en af dem, vises en note: "Bruges af matchingen og gemmes derfor alligevel."

## Teknisk
- Migration: `data_import_column_rules.excluded boolean NOT NULL DEFAULT false`.
- `fetchUploadFilterSets` returnerer også `excluded`. `filterUploadedRow` fjerner udelukkede kolonner, medmindre de er beskyttede. De lægges ikke i advarselslisten.
- Test: en kolonne med "Importeres ikke" bliver fjernet, og en beskyttet kolonne bliver bevaret.
- Brugerfladen sætter `excluded=true` og `category_id=null`. Sletjobbet er uændret.
