# Manuel import af Lukas Nielsens salg på OPP-1095538

## Bekræftet i koden
- Værktøjet findes allerede: `supabase/functions/integration-engine/actions/import-single-sale.ts`, kaldt via action `import-single-sale` i `integration-engine/index.ts:115-117`.
- `mode: "lookup"` er ren læsning og kan finde salget ud fra OPP-nummer (`OPP_PATTERN`, lead-scan pr. kampagne).
- `mode: "import"` er insert-only: salg hvis `adversus_external_id` allerede findes i `sales`, springes over og opdateres aldrig. Max 5 sale ids pr. kald. Ingen watermarks, ingen rematch, ingen delete.
- Importen kører gennem den normale `processSales` fra `core/sales.ts`, så klient-mapping, produkt-mapping, pricing, `sale_items`, provision og omsætning dannes præcis som ved en almindelig sync.
- `agent_email_override` findes som parameter og blev brugt sidst, fordi Lukas' Adversus-bruger har en e-mail, som den normale sync filtrerer væk. Om det er nødvendigt igen, afgøres i trin 1.

Ingen kodeændringer er nødvendige. Ingen migrationer, ingen ændringer i pricing, løn eller RLS.

## Trin 1 – Lookup (kun læsning)
Kald `integration-engine` med `action: "import-single-sale"`, `mode: "lookup"`, `opp: ["OPP-1095538"]`, integration `Lovablecph` og TDC Erhverv-kampagnen, med et lookback der dækker salgsdatoen.

Jeg rapporterer: `saleId`, `leadId`, `campaignId`, `state`, `closedTime`, ejer (navn/e-mail), produktlinjer og OPP-nummer — samt om salget allerede findes i Stork.

## Trin 2 – Import af netop det ene salg
Efter din bekræftelse af, at det er det rigtige salg og den rigtige sælger:
`mode: "import"` med præcis det ene `sale_id`, og `agent_email_override` til Lukas' arbejdsmail hvis Adversus-mailen ikke kan bruges.

## Trin 3 – Verifikation
- Læs det indsatte salg + `sale_items` (produkt, `mapped_commission`, `mapped_revenue`, `needs_mapping`).
- Bekræft at kun én ny række er indsat på TDC Erhverv, at sælger er Lukas, og at ingen andre salg er ændret.

## Ikke i scope
- Ændringer i importlogik, lookback eller state-filtre.
- Rematch eller genberegning af eksisterende salg.

## Zone-note
Trin 1 er læsning. Trin 2 skriver i provisions-/pricing-området (rød zone) via det eksisterende, isolerede værktøj — uden ændringer i delte filer. Jeg beder om din bekræftelse efter trin 1, før der skrives data.
