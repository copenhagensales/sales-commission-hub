# Laura kan ikke se "Kommende" hold under Kommende opstarter

## Årsag (verificeret)

Siden `src/pages/personnel/UpcomingStarts.tsx` henter to slags data:

- Øverste boks "Nyansatte uden hold" læser `candidates` — den kan hun se.
- Sektionen "Kommende" (og alt nedenunder) læser `onboarding_cohorts` + `cohort_members`.

SELECT-policyerne på begge de tabeller er:

```
is_teamleder_or_above(auth.uid()) OR is_rekruttering(auth.uid())
```

Rollen `some` opfylder ingen af dem, så databasen returnerer 0 rækker — derfor er sektionen tom, uden fejlbesked.

## Løsning (RØD ZONE: RLS-migration)

Udvid de to SELECT-policyer med et ekstra `OR`-led baseret på rettighedsnøglen hun allerede har på menupunktet:

```
is_teamleder_or_above(auth.uid())
  OR is_rekruttering(auth.uid())
  OR has_page_permission(auth.uid(), 'menu_upcoming_starts')
```

- `onboarding_cohorts` — policy "Authorized users can view cohorts"
- `cohort_members` — policy "Authorized users can view cohort members"

Rent tilføjende: eksisterende betingelser bevares, ingen mister adgang. Kun roller med view på `menu_upcoming_starts` får den nye vej ind.

Læseadgang kun. Opret/redigér hold og deltagere (INSERT/UPDATE/DELETE) forbliver hos rekruttering/ejer, så knapperne "Opret hold", "Tilføj" og "Start hold og send invitationer" vil stadig fejle for hende. Sig til hvis hun også skal kunne det — så tilføjes samme tjek på skrive-policyerne.

## Verifikation

1. Log ind som Laura → Kommende opstarter viser hold under "Kommende".
2. Kontroltest med rollen `medarbejder` (uden view på nøglen): sektionen skal fortsat være tom/utilgængelig.
3. Ingen ændring for teamledere/rekruttering.

## Teknisk

- Migration: `DROP POLICY` + `CREATE POLICY` for de to navngivne SELECT-policyer.
- `has_page_permission(uuid, text, boolean default false)` findes som SECURITY DEFINER og slår op i `role_page_permissions` via stillingens `system_role_key`.
- Ingen frontend-ændringer nødvendige.
