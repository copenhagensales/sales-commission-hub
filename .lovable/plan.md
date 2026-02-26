

## Gør hoteladresse tydeligere + tilføj Google Maps-link

### Hvad ændres
Adressen vises i dag inline med hotelnavnet, men er svær at se. Vi giver den sin egen linje og gør den klikbar med et Google Maps-link.

### Ændring i `src/pages/vagt-flow/MyBookingSchedule.tsx`

**Linje 384-392 (hotel callout)** opdateres:

1. Hotelnavn forbliver på første linje med Hotel-ikonet
2. Adresse flyttes til en **ny linje** under navnet med et `MapPin`-ikon
3. Adressen wraps i et `<a>`-tag der linker til Google Maps:
   - URL: `https://www.google.com/maps/search/?api=1&query={encodedAddress}`
   - `target="_blank"` og `rel="noopener noreferrer"`
   - Understreget tekst i blå så det tydeligt er klikbart

### Resultat

```
[Hotel-ikon] Hotel Scandic Aarhus
[MapPin-ikon] Banegårdspladsen 14, Aarhus  (klikbart link)
Ind: tor 27/2 kl. 15:00    Ud: fre 28/2 kl. 10:00
```

### Omfang
Kun UI-ændring i en enkelt fil, ingen database-ændringer.
