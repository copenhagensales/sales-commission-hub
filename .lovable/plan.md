
## Powerdag: Del Fieldmarketing op i YouSee og Eesy FM

### Hvad jeg ændrer

To UPDATE-rækker i `powerdag_point_rules` for det aktive event "Powerdag 2026":

| Rule ID | Før | Efter |
|---|---|---|
| `62e9f47e…` | team_name=`Fieldmarketing`, sub=`YouSee` | team_name=`YouSee`, sub=`NULL` |
| `aa8c4d86…` | team_name=`Fieldmarketing`, sub=`Eesy FM` | team_name=`Eesy FM`, sub=`NULL` |

`points_per_sale` (2.80 og 0.69), `display_order` og `event_id` bevares uændret.

### Effekt

- "Fieldmarketing" forsvinder som samlet team både i input-skærmen og på podiet
- YouSee og Eesy FM optræder hver for sig med deres egne point i `computeStandings()`
- `powerdag_scores` er knyttet til `rule_id`, ikke `team_name` — eksisterende salgstal følger automatisk med, intet datatab

### Hvad jeg IKKE rører

- `team_clients`, `team_members`, `teams`-tabellen — uberørt
- Andre dashboards, lønberegning, attribution — uberørt
- Andre rækker i `powerdag_point_rules` (TDC Erhverv, Eesy TM, Relatel, United-grupperne) — uberørt
- Andre Powerdag-events end det aktive — uberørt

### Zone

`powerdag_point_rules` er gul zone. UPDATE på 2 rækker, ingen skema-ændring.
