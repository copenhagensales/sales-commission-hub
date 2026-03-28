

## Tilføj Lovable (Supabase) som databehandler i DataTransferRegistry

### Ændring i `src/pages/compliance/DataTransferRegistry.tsx`

Tilføj en ny entry i `transfers`-arrayet:

| Modtager | Datakategorier | Lokation | Retsgrundlag | DPA-type | Link |
|----------|---------------|----------|-------------|----------|------|
| Lovable (Supabase) | Brugerdata, auth-data, database-indhold | EU | GDPR Art. 28 | Standard DPA | https://supabase.com/legal/dpa |

Supabase's offentlige DPA dækker alle business-brugere og accepteres ved brug af tjenesten — samme model som de øvrige leverandører.

### Risiko
Ingen. Én ny række i en statisk tabel.

