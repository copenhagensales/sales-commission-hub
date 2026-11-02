# Flyt Jeppes lønudgift til Stabslønninger

## Bekræftet
- Én aktiv medarbejder med Jeppe-navn har fast løn på stamkortet og kategorien `assistant`.
- Lønnen er allerede koblet til assistentberegningen; den må ikke lægges til igen.
- Stabslønninger henter aktive `staff`-lønrækker (`useMonthlyOverhead.ts:99-115`).
- Den eksisterende database-trigger synkroniserer kategorien og bevarer stamkortets beløb; den tidligere kategori deaktiveres frem for at blive slettet.

## Ændring
Flyt kun denne medarbejders udgiftskategori fra assistent til stab gennem stamkortets eksisterende kategorifelt. Bevar lønbeløb, lønmodel, dato, timekilde, team, stilling og rettigheder. Ingen ny lønudgift, migration, afsendelse eller publicering.

## Kontrol og begrænsninger
- Afgræns ændringen til præcis én entydig medarbejder og forventet nuværende kategori.
- Kontrollér én aktiv stabsløn, ingen aktiv assistentløn og uændret løngrundlag efter flytning.
- Den eksisterende assistenttilknytning bevares; assistentoversigten kan derfor vise manglende løngrundlag, når kategorien flyttes. Dette skjules ikke med en ekstra ændring.
- Tidligere perioders viste udgiftsfordeling kan ændres, fordi beregningen bruger den aktuelle kategori uden datoversionering. Historiske salg og lønbeløb ændres ikke.

## Teknisk afgrænsning
Kun `employee_master_data.personnel_category` opdateres. Den eksisterende `sync_personnel_salary_from_master_trg` vedligeholder `personnel_salaries`. Ingen ændring af beregningskode eller team-assistentrelationer.