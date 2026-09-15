# Kvalitetskontrol: fuld adgang for ejere + filter pr. kampagne

## Hvorfor du kun ser TDC Erhverv

Der er to forskellige ting i spil, og begge er bekræftet i data:

1. **Tom liste i dag:** Siden åbner på dagens dato. Kl. 08:17 er der endnu 0 salg registreret i dag, mens i går havde 312. Derfor stod der "0 salg i køen".
2. **Kun TDC Erhverv i går:** Kvalitetskøen viser alt for kvalitetskontrollanter og superadmins, men kun eget team for teamledere og assisterende teamledere. Din bruger (`jm@copenhagensales.dk`, Ejer) er registreret som assisterende teamleder på **TDC Erhverv** og er hverken kvalitetskontrollant eller superadmin. Derfor filtreres køen ned til TDC Erhverv-teamets salg.

I går var der salg på 10 kampagner: Tryg Products (104), Eesy gaden (79), Eesy TM Products (44), Hiper Bredbånd (23), Relatel Products (18), TDC Erhverv Products (17), Yousee gaden (14), Finansforbundet Products (11) og et par enkelte. Du kunne kun se de 17.

Der er i øvrigt **ingen kampagnefilter** på siden i dag — fanerne øverst grupperer kun efter team. Teksten "Viser: Alle kampagner" er blot en fast hjælpetekst.

## Hvad jeg foreslår

1. **Ejere får fuld adgang til kvalitetskøen** — samme fulde overblik som kvalitetskontrollanten, uden at du bliver registreret som kontrollant (så du ikke tælles med i kontrollanternes tal). Teamledere beholder deres nuværende begrænsning til eget team.
2. **Filter pr. kampagne** tilføjes ved siden af datovælgeren: en liste med de kampagner der findes i den valgte dags kø, plus "Alle kampagner". Antallet i overskriften følger valget. Team-fanerne bevares og virker sammen med filteret.
3. **Genvejsknapper "I dag" og "I går"** ved datovælgeren, så du hurtigt kan skifte, og datoen ikke kun kan vælges i kalenderfeltet.

Kvalitetsresultater påvirker fortsat ikke løn, provision, pricing, afregning eller annullering. Ingen kontroller eller historik ændres.

## Teknisk

- `public.quality_can_view_all(_user_id)` udvides med `public.is_owner(_user_id)` (funktionen findes allerede). Migration med `CREATE OR REPLACE`; returtype og signatur uændret, så `quality_has_module_access`, `get_quality_queue`, `get_quality_overview` og RLS-politikker virker uændret. Ingen adgang fjernes fra nogen.
- Ingen ændring i `quality_sales_scope`/`get_quality_queue` — de indeholder allerede alle kampagner; filtrering sker kun via `quality_can_view_all`.
- `src/pages/quality/QualityControl.tsx`: ny `activeCampaign`-state (nøgle = `dialer_campaign_label ?? product_label ?? campaign_name`-gruppering på `client_campaign_id` + navn), `Select` med kampagner udledt af `rows`, anvendes i `filteredRows` før team-filtret. To knapper "I dag"/"I går" som sætter `date` via `todayInCopenhagen()`/`addDays(...,-1)` fra `src/lib/qualityDates.ts`. Ingen nye direkte Supabase-kald i komponenten.
- Verificeres bagefter med typecheck og et opslag der bekræfter, at ejer-brugeren nu får hele køen.
