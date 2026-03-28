

## Plan: Slet FM Profit Agent

### Hvad der fjernes

1. **Database**: Drop `fm_agent_settings` tabellen (migration)
2. **Edge function**: Slet `supabase/functions/fm-profit-agent/` mappen
3. **Frontend filer**:
   - Slet `src/pages/vagt-flow/FmProfitAgentContent.tsx`
   - Slet `src/components/fm-agent/AgentSettingsDrawer.tsx`
4. **BookingManagement.tsx**: Fjern `profit-agent` tab fra `allTabs`, fjern lazy import af `FmProfitAgentContent`, fjern `TabsContent` blokken, fjern `Brain` fra imports

### Migration SQL
```sql
DROP TABLE IF EXISTS public.fm_agent_settings;
```

### Filer

| Fil | Handling |
|-----|---------|
| `supabase/migrations/...` | Ny migration: drop `fm_agent_settings` |
| `supabase/functions/fm-profit-agent/` | Slet edge function |
| `src/pages/vagt-flow/FmProfitAgentContent.tsx` | Slet |
| `src/components/fm-agent/AgentSettingsDrawer.tsx` | Slet |
| `src/pages/vagt-flow/BookingManagement.tsx` | Fjern profit-agent tab |

