# "Kun lead" i Opret salg for sælger (TDC Erhverv Fiber)

## Hvad du får
I popup'en **Opret salg for sælger** kommer en tredje salgstype: **Kun lead (lukket i Adversus)**.
- Vælges den, forsvinder feltet "Lukker". Admin vælger kun produkt (HAP/VOK), Mobilevoice, CVR, leadgiver og dato (samme datoregel som i dag: fra den 15. i lønperioden til i dag).
- Der oprettes kun leadgiverens Lead Provi-del. Ingen lukkerdel, så lukkerens salg fra Adversus tælles ikke dobbelt.
- Leadgiveren får samme leadprovision som ved et almindeligt lukket salg (fx VOK 625 kr.), og det tæller som bisalg på boardet som i dag: 0,5 på TDC og 1 på Relatel.
- Salget kan slettes som de andre. "Ret" vises ikke på kun-lead-salg i denne omgang, fordi rettelsen i dag går ud fra, at der er en lukker.
- Sælgernes egen formular er uændret.

## Det bliver ikke ændret
Adversus-salg, provisionssatser, eksisterende salg og andre kunder.

## Teknisk
- Migration: `tdc_fiber_admin_opret_salg` accepterer `p_type = 'kun_lead'`, hvor `p_lukker` er NULL og der kun indsættes ét salg med `rolle='lead'`, `oprettet_af_admin=true`, `kun_lead=true`, og `agent_email` = leadgiverens mail. Produkt er `tdc_fiber_produkt('lead', variant, mobilevoice)`. Leadgiver skal fortsat være aktiv på Relatel eller TDC Erhverv. Funktionen bevarer SECURITY INVOKER, og RLS-insertreglen for admin genbruges uændret. Validerings-, admin- og dato-tjek er de samme som i dag.
- `useTdcFiberSales.ts` sender den nye type. I `TdcErhvervFiberPladsholder.tsx` skjules lukkerfeltet, og "Ret" skjules for `kun_lead`.
- Test i `tdcFiber.test.ts`: kun-lead giver præcis én lead-linje og ingen lukkerlinje.
- Boardlogikken i `tv-dashboard-data` er uændret, da den allerede tæller Lead Provi-linjer pr. leadgiver.
