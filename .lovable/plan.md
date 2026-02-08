

# Plan: Fjern ASE OPP-Mapping

## Handling

Sletter den forkerte mapping fra ASE-integrationen:

| Felt | Værdi |
|------|-------|
| **ID** | `b9e8b82b-497e-4efa-b356-1e3dd0560ad6` |
| **Integration** | ASE (`a76cf63a-4b02-4d99-b6b5-20a8e4552ba5`) |
| **Kilde-sti** | `data.OPP` |
| **Årsag** | Feltet eksisterer ikke i ASE's API data |

## SQL

```sql
DELETE FROM integration_field_mappings 
WHERE id = 'b9e8b82b-497e-4efa-b356-1e3dd0560ad6';
```

## Resultat

ASE vil ikke længere have en OPP-mapping. De resterende OPP-mappings forbliver:
- **Lovablecph (TDC)**: `leadResultData[OPP nr]` → opp_number ✅
- **Relatel**: `leadResultData[Sales ID]` → opp_number (kan diskuteres senere)

