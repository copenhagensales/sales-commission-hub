

## Problem

De to assisterende teamleder-skabeloner har fået deres type ændret fra `assistant_team_leader` til `employment` (sandsynligvis ved navneændring i UI). Koden i `SendContractDialog.tsx` er korrekt — felterne vises kun når `selectedContractType === "assistant_team_leader"`.

## Løsning

Én database-opdatering der sætter begge skabeloner tilbage til den korrekte type:

```sql
UPDATE contract_templates 
SET type = 'assistant_team_leader' 
WHERE id IN (
  'a4596e6a-188b-49f7-93c7-6bce107b91c4',  -- Assisterende Teamleder (månedsløn)
  '8746ec14-b621-42fb-83f1-4a938d60b04b'   -- Assisterende teamleder kontrakt (timeløn)
);
```

Det er det eneste der skal til. Frontend-koden har allerede alle felter og merge tags korrekt implementeret:

| Felt | Merge tags |
|------|-----------|
| Team | `{{team}}`, `{{assist_team}}`, `{{teams}}` |
| Timeløn | `{{timeløn}}`, `{{assist_timelon}}`, `{{hourly_rate}}` |
| Månedsløn | `{{månedsløn}}`, `{{assist_maanedslon}}`, `{{monthly_salary}}` |
| Bonus | `{{bonus}}`, `{{assist_bonus}}` |

