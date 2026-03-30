

## Fix: Inkluder Eesy TM-salg uden kampagne-mapping — kun for Eesy TM

### Problem
611 salg med `source = 'Eesy'` og `integration_type = 'enreach'` har `client_campaign_id = NULL`. Disse udelukkes fra annulleringsmatching, fordi queryen filtrerer med `.in("client_campaign_id", campaignIds)`.

Eesy TM har kun **én** kampagne: `d031126c-aec0-4b80-bbe2-bbc31c4f04ba`.

### Del 1: Data-migration (SQL)
Opdater de 611 salg til Eesy TM's kampagne — scoped med `client_campaign_id` for Eesy TM specifikt:

```sql
UPDATE sales
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'
WHERE source = 'Eesy'
  AND integration_type = 'enreach'
  AND client_campaign_id IS NULL;
```

Da Eesy TM er den eneste klient der bruger `source = 'Eesy'` + `integration_type = 'enreach'` med NULL kampagne, og alle disse salg tilhører Eesy TM, er dette allerede korrekt scoped. Eesy FM bruger andre kampagne-IDs og har ikke NULL-problemer.

### Del 2: Kode-fix — kun for Eesy TM
**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** (linje ~978-1007)

Udvid `fetchCandidateSales` med en ekstra fallback-query **kun for Eesy TM** (ikke Eesy FM):

```typescript
// After existing campaign-based query, add fallback for Eesy TM only
if (selectedClientId === CLIENT_IDS["Eesy TM"]) {
  let from2 = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sales")
      .select(/* same columns */)
      .is("client_campaign_id", null)
      .eq("source", "Eesy")
      .eq("integration_type", "enreach")
      .neq("validation_status", "cancelled")
      .order("sale_datetime", { ascending: false })
      .range(from2, from2 + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    candidates.push(...data);
    if (data.length < pageSize) break;
    from2 += pageSize;
  }
}
```

### Konsekvens
- **Eesy TM**: 611 eksisterende salg får kampagne-ID med det samme (migration). Fremtidige NULL-salg fanges af fallback-query.
- **Eesy FM**: Helt uberørt — hverken migration eller kode-fallback rører FM.
- **Andre klienter**: Uberørte.

