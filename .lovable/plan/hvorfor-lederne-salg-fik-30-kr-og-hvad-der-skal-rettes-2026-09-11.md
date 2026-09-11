# Hvorfor Lederne-salg fik 30 kr — og hvad der skal rettes

## Svar på spørgsmålet

Salgene blev ændret, fordi prismotoren har en "tom leaddata"-undtagelse: hvis et salg ikke har nogen leadfelter, får en regel med betingelser alligevel lov at matche. Manuelle bulk-salg (Tast selv salg) har ingen leaddata — `raw_payload.data` er `null` på fx salget `6bd5d245…` med kilde `manual_entry`. Derfor blev Telefonmøde-reglen brugt på salg, der slet ikke har en mødetype.

Evidens:
- `supabase/functions/rematch-pricing-rules/index.ts:315` — hvis betingelserne IKKE er opfyldt, men leaddata er tom, returneres reglen alligevel.
- Samme undtagelse findes i `supabase/functions/integration-engine/core/sales.ts`.
- 156 Lederne-linjer står nu til 30 kr med regel `ef0d812a…` i stedet for basissatsen 75 kr (`products.commission_dkk = 75`).

Der er også en fejl i selve reglerne: begge regler har betingelsen `Hvilket type møde = Telefonmøde`. Onlinemøde-reglen (90 kr) matcher altså telefonmøder. Begge regler har desuden `priority = 0`, så rækkefølgen mellem dem er tilfældig.

## Sådan skal det virke

Intet mødetype-felt på salget = basissatsen (75 kr). Kun når arket faktisk indeholder Telefonmøde eller Onlinemøde, må de nye satser bruges.

## Det der laves

1. **Undtagelsen slås fra for manuelle salg.** I `rematch-pricing-rules` og `integration-engine` gælder "tom leaddata"-undtagelsen fremover kun for dialer-salg (Adversus/Enreach), ikke for salg med kilden `manual_entry`. Manuelle salg uden mødetype falder derfor tilbage til produktets basispris. Undtagelsen bevares uændret for dialer-salg, så ASE, Tryg og de øvrige klienter ikke ændrer sig.
2. **Reparation af de 156 linjer.** Efter rettelsen køres rematch for Lederne — først som tørkørsel, hvor jeg viser hvor mange linjer der går fra 30 til 75 kr, og derefter for alvor. Ingen salg slettes eller flyttes.
3. **Reglerne rettes i MG Test (du gør det, eller jeg gør det hvis du siger til).** Onlinemøde-reglen skal have betingelsen `Onlinemøde`, og de to regler bør have forskellig priority, så der ikke er uafgjort.
4. **Verifikation:** typecheck, deploy af de to edge functions, og kontrol af at Lederne-linjer uden mødetype står til 75/200 kr, samt at et testsalg med hver mødetype giver 30 og 90 kr.

## Teknisk

- Berørt kode: `matchPricingRule()` i `supabase/functions/rematch-pricing-rules/index.ts` og den tilsvarende funktion i `supabase/functions/integration-engine/core/sales.ts`. Begge holdes 1:1.
- Kilden er allerede tilgængelig i begge funktioner (`sales.source`), så fallback-betingelsen kan snævres ind uden ny dataadgang.
- Ingen ændringer i skema, RLS, provisionssatser, lønsider eller `sale_items` ud over den beløbsreparation punkt 2 beskriver.
- Rød zone: pricing-motoren. Ændringen holdes til den ene fallback-betingelse.
