# Admin: opret fibersalg for andre (med tilbagedatering)

## Hvad brugeren får
- En ny knap »Opret salg for sælger« ved siden af »Administrér sælgere«. Den kan kun ses af admins (Rasmus, Johannes) og ejere.
- Knappen åbner et eget vindue: en skuffe fra bunden på telefon og en dialogboks på computer. Den almindelige formular er uændret.
- Felter i vinduet:
  - Salgstype (Fuldt salg eller Lukket salg)
  - Produkt (HAP eller VOK)
  - Inkl. Mobilevoice
  - CVR-nummer
  - Lukker eller sælger: kan kun vælges blandt sælgere på adgangslisten
  - Leadgiver: kun ved Lukket salg og fra samme liste som i dag (TDC Erhverv først, så Relatel)
  - Salgsdato: fra den 15. i den igangværende lønperiode til og med i dag. Den forvalgte dato er i dag.
- Lukker og leadgiver kan ikke være den samme person.
- Salget tæller som om, sælgeren selv havde tastet det. Provision og omsætning tages fra produkterne. Det følger de samme regler for bisalg og dashboards som i dag.
- »Tastet i dag« får et mærke »oprettet af admin«, når et salg er oprettet på denne måde.

## Sikkerhed og historik
- Databasen kontrollerer reglerne, ikke kun skærmen. Den tjekker, at man er admin eller ejer, at lukkeren står på adgangslisten, at leadgiveren er gyldig, og at datoen ligger i den igangværende lønperiode og ikke efter i dag.
- Det gemmes, hvem der har oprettet salget, og at det er oprettet af en admin.
- Lukkede lønperioder kan ikke ændres.

## Teknisk
- Migration med ny funktion `tdc_fiber_admin_opret_salg(p_salg_id, p_lead_salg_id, p_type, p_variant, p_mobilevoice, p_cvr, p_lukker, p_leadgiver, p_dato)` som SECURITY INVOKER med fast search_path. Kontrollerne er de samme som i `tdc_fiber_opret_salg`. Derudover tjekkes admin- eller ejerstatus via eksisterende `tdc_fiber_access`-admin og `is_owner`, og at lukkeren har en række i `tdc_fiber_access`.
- Lønperiodens start beregnes i funktionen: den 15. i denne måned, hvis dagen er 15 eller senere, ellers den 15. i sidste måned. Det gøres i dansk tid. `sale_datetime` sættes til den valgte dato kl. 12:00 dansk tid, så salget ikke skifter dag på grund af tidszone.
- `raw_payload` får `oprettet_af_admin: true` og `registreret_af`. RLS-INSERT for admins tjekkes og udvides kun, hvis det er nødvendigt. Salg kan stadig ikke slettes.
- Klienten får en ny mutation i `useTdcFiberSales.ts` (retry 0, stabile klient-UUID'er, fejl oversættes ved præcis match af fejlkode). Datoreglen kommer i `tdcFiber.ts` med tests, også negative prøver for dato før perioden, dato i fremtiden og lukker lig med leadgiver. Den nye dialog lægges i `TdcErhvervFiberPladsholder.tsx` og bygges med de eksisterende BottomSheet/Dialog-byggeklodser.
- Kontrol: tests, typecheck, build og mobilmåling ved 360/393/430 px. Der laves intet prøvesalg, fordi det ville give rigtig provision.
