# Fjern de fire totalkort øverst i Tryg-ugemailen

## Hvad ændres
De fire kort øverst i mailen fjernes: Lukkede emner, Bookede møder, Mødebook-hitrate og Ugyldig / ukvalificeret. Mailen starter derefter direkte med tallene pr. kampagne.

Indledningen tilrettes, så den ikke længere siger "Øverst ser I totalerne". Den kommer i stedet til at lyde: "Her er ugens tal for mødebooking på Tryg pr. kampagne, derefter statusfordeling og pr. sælger."

## Hvad ændres ikke
Tabellerne, rækken "Tryg i alt", forklaringerne, siden i Stork, beregningerne og tidspunktet for mandagsudsendelsen er uændrede.

## Teknisk
- `supabase/functions/_shared/weekly-lead-closure-mail.ts`:
  - Blokken `statCards` (linje 330-364) fjernes sammen med de hjælpevariable, der kun bruges af den.
  - `${statCards}` fjernes fra linje 488.
  - Indledningsteksten på linje 484-485 tilrettes.
  - `statCard()` slettes, hvis den ikke bruges andre steder.
- Edge-funktionen `weekly-lead-closure-report` deployes igen, fordi mailskabelonen er delt kode.
- Der er ingen migration og ingen dataændring.
