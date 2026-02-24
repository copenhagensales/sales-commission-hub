

# Forbedret soegning og datovalg paa Sales-siden

## Oversigt

To forbedringer af Sales-feedet:

1. **Udvidet soegning** -- soeg paa ALLE kunde/salgs-felter (ikke kun telefon, firma og agent)
2. **Bedre datovalger** -- direkte dato-input med kalender integreret i samme popover (som DBPeriodSelector-moenstret)

---

## 1. Udvidet soegning

**Problem:** Soegningen (linje 276) filtrerer kun paa `customer_phone`, `customer_company` og `agent_name` via `.or()`. Man kan ikke soege paa f.eks. lead ID, Sales ID, agent email, kampagnenavn eller data i `raw_payload`.

**Loesning:** Implementer en to-trins soegning:

- **Database-niveau**: Udvid `.or()` til ogsaa at inkludere `agent_email` og `internal_reference`
- **JSONB soegning**: Tilfoej `raw_payload::text` soegning via en RPC-funktion der kan lave `ILIKE` paa `raw_payload::text`, saa man kan finde lead ID'er, Sales ID'er, kundedata osv. der ligger i JSON-payloaden

**Konkret:**
- Opret en ny database-funktion `search_sales_full_text(query text)` der returnerer sale IDs matchende paa `raw_payload::text ILIKE '%' || query || '%'`
- I queryen: naar soegning er aktiv, hent matchende IDs fra RPC og filtrer `.in("id", matchedIds)` ELLER brug den udvidede `.or()` for de regulaere kolonner
- Alternativt (simplere): Brug PostgreSQL `to_tsvector` / `websearch_to_tsquery` paa en genereret kolonne -- men den simpleste loesning er at lave en RPC-funktion

**Simpleste tilgang (anbefalet):** Opret en RPC `search_sales` der tager en soege-streng og returnerer matchende sales med alle relationer. Funktionen soeger paa:
- `agent_name`, `agent_email`, `customer_phone`, `customer_company`, `internal_reference`
- `raw_payload::text` (fanger lead ID, Sales ID, alle lead-felter)

Placeholder-teksten opdateres til: "Soeg paa alle felter..."

## 2. Forbedret datovalger

**Problem:** Datovalg kraever to trin -- foerst vaelg "Vaelg periode..." i preset-listen, derefter aabnes en separat popover med kalenderen. Det er langsomt og uintuitivt.

**Loesning:** Kombiner presets og kalender i samme popover (som `DashboardPeriodSelector` allerede goer):

- Venstre side: Preset-knapper (I dag, I gaar, Sidste 7 dage, etc.)
- Hoejre side: Kalender til brugerdefineret periode
- Fjern den separate `isRangePickerOpen` popover
- Tilfoej mulighed for at skrive dato direkte i et input-felt over kalenderen

---

## Tekniske detaljer

### Database-migration

Ny RPC-funktion:

```sql
CREATE OR REPLACE FUNCTION search_sales(search_query text, max_results int DEFAULT 200)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT s.id FROM sales s
  WHERE
    s.agent_name ILIKE '%' || search_query || '%'
    OR s.agent_email ILIKE '%' || search_query || '%'
    OR s.customer_phone ILIKE '%' || search_query || '%'
    OR s.customer_company ILIKE '%' || search_query || '%'
    OR s.internal_reference ILIKE '%' || search_query || '%'
    OR s.raw_payload::text ILIKE '%' || search_query || '%'
  ORDER BY s.sale_datetime DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Fil: `src/components/sales/SalesFeed.tsx`

**Soegning (linje 237-315):**
- Naar `searchQuery` er sat, kald foerst `search_sales` RPC for at faa matchende IDs
- Brug `.in("id", matchedIds)` i stedet for `.or()` til filtrering
- Behold debounce paa soegning (300ms) for at undgaa for mange kald

**Datovalger (linje 628-724):**
- Fjern `isRangePickerOpen` state og den separate popover
- Erstat med en enkelt popover der viser presets til venstre og kalender til hoejre (side-by-side layout)
- Opdater placeholder til "Alle datoer"

**Soege-placeholder (linje 621):**
- Aendr fra "Soeg efter telefon, kunde eller agent..." til "Soeg i alle felter (kunde, telefon, lead ID, agent...)"

