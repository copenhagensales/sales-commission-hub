

## Plan: Kør rematch-pricing-rules for ASE salg uden matchet prisregel (2026)

### Status nu

| Produkt | Unmatched | Matched | Total |
|---------|-----------|---------|-------|
| **Salg** | 75 | 393 | 468 |
| **Lead** | 56 | 0 | 56 |
| **Lønsikring** | 0 | 226 | 226 |

De 75 "Salg" items bruger fallback-basispriser i stedet for prisregler. De 56 "Lead" items har basispriser (65/150 kr).

### Aktive prisregler for ASE

- **Salg**: 4 regler med conditions (A-kasse type, Forening, osv.) - prioritet 1-10
- **Lønsikring**: 2 regler baseret på Dækningssum (under/over 6000) - prioritet 5
- **Lead**: Ingen aktive prisregler (basispriser bruges korrekt)

### Eksekveringsplan

**Trin 1: Dry run** - Kald rematch-pricing-rules med `source: "ase"`, `dry_run: true` for at se hvad der ville ændres uden at lave opdateringer.

**Trin 2: Vurder resultat** - Gennemgå stats fra dry run (antal matches, fallbacks, sample matches med nye kommissioner).

**Trin 3: Kør skarpt** - Kald funktionen igen med `dry_run: false` for at opdatere de 131 sale_items.

### Teknisk detalje

Funktionen henter allerede kun `matched_pricing_rule_id IS NULL` items (medmindre et specifikt `product_id` angives). Den normaliserer ASE raw_payload-nøgler, beriger Dækningssum, og matcher mod aktive prisregler med dato-validering. Lead-items vil sandsynligvis forblive på basispriser, da der ikke findes specifikke prisregler for Lead-produktet.

### Hvad jeg gør

1. Kører dry run via edge function invoke
2. Viser resultatet
3. Kører skarpt hvis tallene ser korrekte ud
4. Verificerer at de 75 Salg-items nu har matchede prisregler

