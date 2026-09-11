# Sletningspolitikker: virker de reelt?

Kort svar: nej, ikke som siden giver indtryk af. Politikkerne er sat op og den natlige kørsel er tændt, men rensningen af salg står stille, og advarslen på siden er direkte forkert.

## Hvad jeg har verificeret

- 31 politikker er markeret aktive (23 kampagner, 8 datatyper).
- Den natlige kørsel er tændt og bliver kaldt kl. 03:30 (plus dialer-opkald kl. 03:45).
- Rensningen er ikke i "prøvetilstand" — den skriver rigtigt i data. 2.912 salg er faktisk anonymiseret tidligere, så mekanismen virker.
- MEN: 19.387 salg er over deres frist og har stadig telefonnummer og/eller rå kundedata liggende. Fordelt bl.a. Tryg 4.587, Finansforbundet 4.426, Eesy gaden 3.608, ASE 2.048, TDC Erhverv 1.643.
- Sikkerhedsspærringen (spring salg over, som mangler provision) er ikke årsagen: kun 19 af de 19.387 er blokeret af den.
- Der er ingen spor i renselogbogen af natlige kørsler siden 9. september, kun manuelle oprydninger.
- Til sammenligning er de øvrige datatyper stort set rene: 0 forfaldne kandidater, 0 forfaldne login-hændelser, 0 forfaldne integrationslogs, 1 forfalden kundehenvendelse.

## Konklusion

To reelle problemer:

1. Advarselsboksen siger "Automatisk sletning er deaktiveret systemwide … Ingen data slettes endnu". Det er ikke sandt. Kørslen er aktiv og har allerede anonymiseret rigtige salg. Teksten kan få nogen til at tro, at et klik på "Aktiv" er uden konsekvens.
2. Rensningen af salg tømmer ikke køen. Den tager højst 500 salg pr. kampagne pr. nat, og den samlede natlige kørsel løber tør for regnekraft undervejs — vi har tidligere set den fejle med netop den grænse. Resultatet er en voksende pukkel af kundedata, vi skulle have fjernet.

## Foreslået plan

1. Bekræft årsagen først: kør natjobbet i prøvetilstand og læs loggen, så vi ser præcis hvor den stopper, og hvor mange salg den ville nå.
2. Ret teksten på siden, så den beskriver virkeligheden: kørslen er aktiv, den anonymiserer, og hvad der bevares.
3. Flyt salgsrensningen til samme robuste model som opkaldsdata (databasekørsel i portioner i stedet for én stor nattekørsel), så puklen på 19.387 tømmes over få dage uden at fejle undervejs.
4. Tøm den eksisterende pukkel kontrolleret, kampagne for kampagne, med optælling før og efter og evidens for at salgstal, provision og rapporter er uændrede.
5. Efterlad synlig status på siden: hvor mange salg er forfaldne lige nu, og hvornår kørte rensningen sidst — så det ikke igen kan stå stille ubemærket.

## Teknisk

- Kilder: `campaign_retention_policies` (23 aktive), `data_retention_policies` (8 aktive), `cron.job` (`gdpr-data-cleanup-daily` 30 3 * * *, aktiv), `gdpr_cleanup_log`.
- `supabase/functions/gdpr-data-cleanup/index.ts:330` sætter `.limit(500)` pr. kampagne; `dry_run` er `false` som standard for cron (linje 105-116).
- Spærringen for umappede salg ligger i linje 388-395; kun 19 rækker rammes.
- Ingen ændring af provision, `sale_items.mapped_commission`, lønkørsel eller rapporter i denne plan. Rød zone (GDPR) — punkt 3 og 4 udføres kun efter godkendelse og med før/efter-evidens.
- Sidens advarselstekst: `src/pages/compliance/RetentionPolicies.tsx:238-250`.
