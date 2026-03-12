

## Fjern Thomas Wehage fra Eesy TM

Thomas Wehage er staff-medarbejder (`is_staff_employee = true`) og medlem af 3 teams: **Eesy TM**, **Fieldmarketing** og **Stab**.

### Handling
Slet hans team_members-record for Eesy TM via en database migration:

```sql
DELETE FROM public.team_members 
WHERE id = '2c0e7888-f346-42cf-a05d-50566b25fe86';
```

Han forbliver på Fieldmarketing og Stab.

