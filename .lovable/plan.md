# Tryg-rapporten skal følge mappingen med det samme

Du har byttet de to Lederne-kampagner i mappingen, men rapporten viser stadig de gamle tal. Årsagen er fundet.

## Hvad der er galt

Mappingen er nu rigtig:

- 118971 (emner mærket "Konverteringsemne") → Lederne konvertering
- 118972 (emner mærket "Aktiv udringning") → Lederne

Men de gemte ugetal bærer deres egen kopi af rapportlinjen, og rapporten læser den kopi — ikke mappingen. De 199 gemte Lederne-rækker (uge 30 til uge 39) står stadig med den gamle linje: 118971 = "Lederne" (2.121 emner) og 118972 = "Lederne konvertering" (6.661 emner). Derfor er tallene uændrede på siden.

## Løsningen

Lad rapporten slå rapportlinjen op i mappingen, hver gang den vises, i stedet for at bruge den gamle kopi. Så slår denne og alle fremtidige mapping-rettelser igennem med det samme, uden at et eneste gemt tal ændres.

Effekt for uge 38, når det er på plads:

- Lederne: 1.369 emner lukket (i dag 7)
- Lederne konvertering: 7 emner lukket (i dag 1.369)

Uge, måned og år til dato følger samme rettelse, og alle øvrige kampagner er uberørt.

## Teknisk

- Ændr `get_weekly_lead_closure_report` så `lines` og `unmapped` joiner `weekly_lead_report_campaign_map` på (account, adversus_campaign_id) og bruger `m.report_line`, i stedet for `s.report_line`. `calls` og `mcr_lines` joiner allerede mappingen og forbliver som de er.
- Ingen UPDATE, DELETE eller backfill: `weekly_lead_closure_stats` rører vi ikke. Kolonnen `report_line` bliver liggende som historisk spor; den bruges blot ikke længere til visning.
- Den ugentlige hentning, mandagsmailen, statusklassificeringen og frontend-beregningerne ændres ikke. Bemærk: mailen læser tallene et andet sted — jeg tjekker om den bruger samme kolonne og retter den på samme måde, hvis den gør.
- Adgangskontrollen i funktionen (teamleder eller over) bevares uændret.
- Kontrol efter ændringen: uge 38 skal vise Lederne 1.369 lukkede og Lederne konvertering 7 lukkede, summen af alle linjer skal være uændret, og måned/år til dato skal stemme med en manuel sum i databasen.
