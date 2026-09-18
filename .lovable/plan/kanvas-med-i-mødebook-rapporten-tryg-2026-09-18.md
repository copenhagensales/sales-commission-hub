# Kanvas med i Mødebook-rapporten (Tryg)

## Hvorfor
Kanvas-linjen står på 0, fordi de fire kanvas-kampagner kører i Enreach, mens rapporten i dag kun spørger Adversus. Enreach-kampagnerne (CAMP…S3064) findes ikke i Adversus, så der kommer ingen emner tilbage.

## Hvad der bygges

1. **Afklaring først (læsning, ingen ændringer).** Kald Enreach og få bekræftet, hvilke "afslutnings-udfald" der findes på kanvas-kampagnerne, og hvilket felt der viser hvem der har haft emnet. Uden det kan vi ikke afgøre, hvad "lukket emne" og "booket møde" er i Enreach. Resultatet rapporteres til dig, før noget beregnes.

2. **Enreach-hentning i rapporten.** Samme rapport, samme tabeller — den henter blot også fra Enreach for de kampagner, der er mappet til en Enreach-kampagne. Kun de samme få oplysninger læses (emne-id til dubletfjernelse, kampagne, udfald, sælger, ændringstidspunkt). Ingen emnedata gemmes; kun antal pr. uge, kampagne, linje, sælger og status — præcis som i dag.

3. **Konfiguration, ikke kode.** De nye Enreach-udfald lægges i den samme tabel over afsluttende statusser, så du selv kan markere nye som "lukket" eller "åben" uden kodeændring. Ukendte udfald tælles som "ukendt" og nævnes i mailen, som i dag.

4. **Bagudfyldning.** Når hentningen virker, køres de seneste 8 uger igennem, så Kanvas også står korrekt i de fire foregående uger i mandagsmailen.

## Hvad der ikke røres
Adversus-hentningen, lederne-sync, adversus-webhook, mailopsætningen og de eksisterende tal for FDM, Finansforbundet, Hjerteforeningen, Kræftens Bekæmpelse og Lederne. De genberegnes ikke.

## Teknisk
- Udvider `supabase/functions/weekly-lead-closure-report/index.ts` med en Enreach-kilde ved siden af Adversus-kilden; fælles aggregering og samme RPC `weekly_lead_closure_add`.
- Enreach læses via `/simpleleads` med `Campaigns=<id>` + `ModifiedFrom/ModifiedTo`, paginering som i dag, med genforsøg ved 429/5xx.
- `weekly_lead_report_campaign_map.account` får værdien `enreach` for de fire kanvas-kampagner (og evt. flere), så kilden vælges ud fra mappingen — ingen hardkodede kampagne-id'er.
- `lead_closing_statuses` udvides med de Enreach-udfald, trin 1 finder, inkl. `is_closing` og dansk label.
- Ingestion-tjekket udvides til også at probe de Enreach-felter, der læses, og stopper kørslen hvis et felt er blokeret.

## Åbent punkt
Hvis Enreach ikke udstiller et entydigt "booket møde"-udfald, skal du eller Kasper beslutte, hvilket udfald der tælles som booket møde. Det gætter jeg ikke på.
