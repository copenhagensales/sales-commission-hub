

# Fix: "Sæt ny kode" fejler for ikke-ejere

## Problem
Knappen "Sæt ny kode" vises for alle med `canEditEmployees`-rettighed (inkl. teamledere), men edge-funktionen `set-user-password` kræver `is_owner`. Når en ikke-ejer (f.eks. Kasper som teamleder/manager) forsøger at sætte en ny kode for Oscar Belcher, returnerer edge-funktionen en 403-fejl: "Kun ejere kan udføre denne handling".

Fejltoasten vises i højre hjørne som rapporteret.

## Løsning
Ændr adgangskontrollen i edge-funktionen til at bruge `is_manager_or_above` i stedet for `is_owner`, så den matcher UI-gaten. Teamledere og managers skal kunne sætte nye koder for deres medarbejdere.

## Tekniske ændringer

### Fil: `supabase/functions/set-user-password/index.ts`
**Linje 45-51**: Ændr `is_owner` til `is_manager_or_above`:

```typescript
// Før:
const { data: isOwner } = await supabaseAdmin.rpc("is_owner", { _user_id: callingUser.id });
if (!isOwner) {
  return new Response(
    JSON.stringify({ error: "Kun ejere kan udføre denne handling" }),
    ...
  );
}

// Efter:
const { data: isManager } = await supabaseAdmin.rpc("is_manager_or_above", { _user_id: callingUser.id });
if (!isManager) {
  return new Response(
    JSON.stringify({ error: "Kun ledere kan udføre denne handling" }),
    ...
  );
}
```

Ingen andre filer ændres.

