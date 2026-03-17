

## Plan: Flyt Madhan til Stab

Opdater `is_staff_employee` til `true` for Madhan's record i `employee_master_data`, så profilen vises under "Stab"-fanen i stedet for "Alle medarbejdere".

**Ændring:** Kør en UPDATE query via insert-tool:
```sql
UPDATE employee_master_data SET is_staff_employee = true WHERE private_email = 'madhan@statfinity.in';
```

Ingen kodeændringer nødvendige — kun en dataændring.

