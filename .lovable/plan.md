

## Tilføj forretningsregler til FM Profit Agent

### Hvad skal ændres
Profit Agent'en kender i dag ikke til tre vigtige FM-regler:

1. **Kapacitetskrav**: Der skal altid stå 2 sælgere på hver lokation
2. **Klient-separation**: Yousee og Eesy FM er forskellige kunder og kan **ikke** blandes på samme lokation
3. **Lokations-klientbinding**: Hver lokation har en liste over tilladte kunder (`bookable_client_ids`)

### Ændring: `supabase/functions/fm-profit-agent/index.ts`

**1. Hent klient-info til datakontekst**
- Udvid `location`-query til at inkludere `bookable_client_ids`
- Hent klientnavne fra `client_campaigns` / `clients`-tabellen, så agenten kan vise "Eesy FM" / "Yousee" i stedet for UUIDs
- Inkluder klient-info i observations og scores

**2. Tilføj lokations-klient-mapping i datakontekst**
- I `formatDataContext()`: Tilføj en sektion der viser hvilke lokationer der tilhører hvilke kunder
- Marker lokationer der kun kan bruges til én kunde vs. begge

**3. Opdater system prompt med forretningsregler**
Tilføj følgende regler til systemprompten (linje ~466):

```
### Vigtige forretningsregler for FM-planlægning
- Hver lokation kræver ALTID 2 sælgere. Man kan ikke sende kun 1 person.
- Yousee og Eesy FM er helt separate kunder med separate lokationer. De kan IKKE blandes.
- Hver lokation har en specifik liste af kunder den må bruges til (bookable_client_ids).
- Når du anbefaler lokationer eller ugeplaner, skal du altid respektere disse begrænsninger.
- Angiv altid hvilken kunde en lokation tilhører når du nævner den.
```

**4. Berig observations med klient-kontekst**
- Tilføj `clientName` felt til `Observation`-interfacet (udledt fra `client_campaign_id` → klientnavn)
- Vis klient-navn i datakonteksten så AI'en kan skelne mellem Yousee- og Eesy-lokationer

### Ingen UI-ændringer nødvendige
Kun edge function opdateres.

