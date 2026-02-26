

## Vis lokationsadresse med Google Maps-link i vagtplanen

### Hvad ændres
Når du ser din vagtplan, vises lokationen kun med navn og by (f.eks. "Kvickly Næstved, Næstved"). Vi tilføjer gadenavn under lokationsnavnet som et klikbart Google Maps-link.

### Ændring i `src/pages/vagt-flow/MyBookingSchedule.tsx`

**1. Udvid data-query (linje 54)**
Tilføj `address_street` til location-select:
```
location:location_id ( id, name, address_city, address_street )
```

**2. Tilføj adresselinje under lokationsnavnet (linje 319-325)**
Under den eksisterende lokationslinje tilføjes en ny linje med `MapPin`-ikon og klikbar adresse:

```
Kvickly Næstved, Næstved
  [MapPin] Ringstedgade 43, Næstved  ← klikbart Google Maps-link
```

- Adressen sammensættes af `address_street` og `address_city`
- Vises kun hvis mindst ét adressefelt er udfyldt
- Linket åbner Google Maps i ny fane

### Omfang
- 1 fil ændres, kun UI -- ingen database-ændringer
- Adressedata findes allerede i `location`-tabellen, vi henter bare feltet med

