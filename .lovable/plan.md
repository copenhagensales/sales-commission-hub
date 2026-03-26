

## Ret eksisterende hotel-priser til ex moms

### Hvad skal ske
Alle 9 eksisterende `booking_hotel`-poster har priser tastet inkl. moms (25%). De skal opdateres til ex moms ved at dividere `price_per_night` med 1,25.

### Ændring
**Database-opdatering** (via insert/update tool – ingen skemaændring):

```sql
UPDATE booking_hotel
SET price_per_night = ROUND((price_per_night / 1.25)::numeric, 2)
WHERE price_per_night IS NOT NULL;
```

Dette rammer alle 9 rækker og konverterer priserne korrekt.

### Ingen kodeændringer nødvendige
Systemet behandler allerede `price_per_night` som ex moms i profitabilitetsberegninger (jf. eksisterende business rule). Det er kun de indtastede værdier der var forkerte.

