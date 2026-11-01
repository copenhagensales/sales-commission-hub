# TDC Erhverv Fiber: admins kan rette dagens salg

## Hvad brugeren ser
- Ejere og admins (Rasmus, Johannes) ser **alle** tastede fibersalg fra i dag under »Tastet i dag«, med navn på sælger og leadgiver. Almindelige sælgere ser som nu kun deres egne.
- Hvert salg har en »Ret«-knap (kun admins/ejere). Den åbner samme felter som formularen: salgstype, HAP/VOK, Mobilevoice, CVR og leadgiver. Vindue på computer, skuffe på telefon.
- Kun salg fra i dag kan rettes.

## Hvad der sker ved en rettelse
- **Produkt, Mobilevoice, CVR:** sælgerens og leadgiverens del skifter til det rigtige produkt; provision og omsætning hentes igen fra produktet.
- **Ny leadgiver:** leaddelen flyttes til den nye leadgiver.
- **Lukket → fuldt salg:** sælgerens del bliver »Fuldt salg« med fuld provision. Leaddelen slettes ikke, men markeres annulleret, så den giver 0 kr. og bevares i historikken.
- **Fuldt → lukket salg:** sælgerens del bliver »Lukket salg«, og der oprettes en ny leaddel til den valgte leadgiver.
- Hver rettelse gemmes i en log (hvem, hvornår, før og efter).

## Teknisk (rød zone: provision)
- Migration:
  - Tabel `tdc_fiber_rettelser` (salg_id, rettet_af, rettet_at, foer jsonb, efter jsonb). RLS: kun ejere/admins læser, indsætning kun via egen rettelse; ingen UPDATE/DELETE.
  - RLS: ejere/admins må læse og opdatere `sales`/`sale_items` med `source = 'tdc_fiber_manual'` og salgsdato i dag.
  - Stempel-triggeren på `sale_items` kører også ved UPDATE af produkt, så provision altid kommer fra produktet.
  - Funktion `tdc_fiber_ret_salg(...)` (SECURITY INVOKER) med samme kontroller som oprettelse plus admin-tjek og »kun i dag«. Annullering sker med `is_cancelled = true`, `cancelled_quantity = 1` på leaddelens linje.
- Frontend: `useRetFiberSalg` og admin-variant af »Tastet i dag« i `src/hooks/useTdcFiberSales.ts`; rette-vindue i `src/pages/TdcErhvervFiberPladsholder.tsx`, der genbruger formularens felter.
- Prøver: regler for typeskift (lukket→fuldt annullerer lead, fuldt→lukket kræver leadgiver).
- Kontrol: skærmbilleder ved 360/393/430 px og computer. Ingen rigtig rettelse afprøves (giver rigtig provision).

## Bemærk
Annullerede linjer bruges i forvejen af annulleringsflowet og lønnen. Jeg kontrollerer i første trin, at en annulleret linje giver 0 kr. i lønberegningen; viser det sig ikke at holde, stopper jeg og vender tilbage.
