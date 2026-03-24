

# Indstillinger til FM Profit Agent

## Hvad
Tilføj en indstillingspanel (Settings drawer) til FM Profit Agent, hvor managere kan konfigurere AI'ens forretningsforståelse. Indstillingerne gemmes i en ny database-tabel og sendes med til edge-funktionen, som bruger dem i system-prompten og beregningerne.

## Smarte indstillinger

| Indstilling | Beskrivelse | Default |
|---|---|---|
| **Mål-DB%** | Minimumskrav til dækningsbidrag — AI'en flagger lokationer under denne grænse | 30% |
| **Sælgeromkostning %** | Feriepenge/tillæg på provision (nu hardcodet 12.5%) | 12.5% |
| **Datavindue (uger)** | Hvor mange uger bagud AI'en analyserer | 12 |
| **Min. observationer** | Minimum datapunkter før AI'en udtaler sig med sikkerhed | 5 |
| **Forretningskontekst** | Fritekst med virksomhedsspecifik viden (fx "Vi prioriterer Eesy-produkter", "Aarhus-lokationer har sæsonudsving", "Nye sælgere skal altid starte på X") | Tom |
| **Fokus-prioritet** | Hvad AI'en vægter højest: Profitabilitet / Volumen / Konsistens | Profitabilitet |

## Ændringer

| Fil | Hvad |
|---|---|
| **Database migration** | Ny tabel `fm_agent_settings` med kolonnerne: `id`, `target_db_pct`, `seller_cost_pct`, `data_window_weeks`, `min_observations`, `business_context`, `focus_priority`, `updated_at`, `updated_by`. Én række (singleton). RLS: authenticated kan select/update. |
| `src/components/fm-agent/AgentSettingsDrawer.tsx` | **Ny fil.** Sheet/drawer med formular for alle indstillinger. Henter og gemmer til `fm_agent_settings`. Fritekst-felt til forretningskontekst med placeholder-eksempler. |
| `src/pages/vagt-flow/FmProfitAgentContent.tsx` | Tilføj tandhjuls-ikon (Settings) der åbner draweren. Send `settings` med i request body til edge-funktionen. |
| `supabase/functions/fm-profit-agent/index.ts` | Læs `settings` fra request body (eller hent fra DB som fallback). Brug `target_db_pct` i risikoflag, `seller_cost_pct` i beregninger, `data_window_weeks` for dataperiode, `min_observations` for konfidenstærskel, `business_context` i system-prompten, `focus_priority` til at justere scoring-vægtning. |

## Teknisk detalje

**System-prompt tilføjelse:**
```
Virksomhedens forretningskontekst:
{business_context}

Mål-DB%: {target_db_pct}% — flagger lokationer under dette.
Fokus: {focus_priority} — vægt dine anbefalinger derefter.
```

**Scoring-justering baseret på fokus:**
- Profitabilitet: nuværende adfærd (DB%-baseret)
- Volumen: vægt salesCount højere i score
- Konsistens: vægt lav varians højere

