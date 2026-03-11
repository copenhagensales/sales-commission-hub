

# Fix: Teamleder-skabeloner har forkert type

## Problem
De to teamleder-skabeloner ("Teamleder kontrakt" og "Assisterende teamleder kontrakt") har stadig `type = 'employment'` i databasen. Koden viser kun de ekstra felter når `type = 'team_leader'`, så felterne dukker aldrig op.

## Løsning
Kør en database-migration der opdaterer de to skabeloner:

```sql
UPDATE contract_templates 
SET type = 'team_leader' 
WHERE id IN (
  '017b0f24-d274-4f5b-8d30-c7395340b446',
  '8746ec14-b621-42fb-83f1-4a938d60b04b'
);
```

Ingen kodeændringer nødvendige — felterne er allerede implementeret korrekt i `SendContractDialog.tsx`.

