# Adgang til "TDC Erhverv - ret salg" for Oliver (uden at ændre sælgerne)

## Konklusion først

Backoffice-rollen er ikke løsningen. To grunde, begge verificeret:

- System-rollen `backoffice` har kun 8 rettigheder (compliance, mine FM-vagter, mål, powerdag-input) — ingen dashboards, ingen tast-selv-salg. Oliver ville *miste* alt det sælgerne har.
- Stillingen "Backoffice" i `job_positions` peger i dag på `system_role_key = medarbejder`. At sætte ham på den stilling ændrer altså ingenting.

Den rene løsning: en **ny system-rolle**, der er en kopi af `medarbejder` plus den ene rettighed — og en tilsvarende stilling, som Oliver sættes på. Den almindelige `medarbejder`-rolle røres ikke, så ingen andre sælgere får adgang.

Oliver = Oliver Gonsalves Vatting Arentoft (`olar@copenhagensales.dk`), Salgskonsulent på TDC Erhverv, i dag stilling "Salgskonsulent" → rolle `medarbejder`.

## Sådan gør vi

1. Ny system-rolle `salgskonsulent_tdc_support` (label: "Salgskonsulent + TDC ret salg", ikon/farve som medarbejder, priority 20).
2. Kopiér alle `medarbejder`-rettigheder 1:1 til den nye rolle (48 rækker med view/edit, resten som i dag).
3. Tilføj til den nye rolle:
   - `menu_reports_tdc_edit_sales` (view + edit)
   - `menu_section_reports` (kun view — nødvendigt for at menupunktet kan vises i sidebaren; sektionen viser kun de underpunkter man har adgang til, så han ser ingen andre rapporter)
4. Ny stilling i `job_positions`: "Salgskonsulent (TDC ret salg)" med `system_role_key = salgskonsulent_tdc_support`.
5. Sæt Olivers `position_id` til den nye stilling. `job_title` forbliver "Salgskonsulent", så løn, liga-berettigelse og sælger-logik er uændret.

## Hvad der ikke ændres

- `medarbejder`-rollen og alle andre sælgere: uændret.
- `backoffice`-rollen: uændret (fortsat 0 brugere — separat oprydning).
- Ingen kodeændring nødvendig. Adgangen styres allerede udelukkende af rettigheden `menu_reports_tdc_edit_sales` (`src/routes/config.tsx:423`, `src/hooks/useTdcErhvervSales.ts:326`), efter at allowlisten blev fjernet.
- Ingen ændring af løn, pricing, RLS-funktioner eller dagsrapporter. Han får ikke dagsrapporter — kun det ene menupunkt oveni sit nuværende.

## Teknisk

- Migration: insert i `system_role_definitions`, `insert ... select` fra `role_page_permissions where role_key = 'medarbejder'` til den nye `role_key`, plus upsert af de to ekstra rettigheder, insert i `job_positions`, og update af Olivers `position_id`.
- `permissionKeys.ts` ændres ikke — nøglen findes allerede (`src/config/permissionKeys.ts:241`).
- Efter migration: Oliver skal logge ud/ind (eller vente på cache-invalidering) før menupunktet er synligt.
- Fremover kan andre sælgere, der skal have samme adgang, blot sættes på den nye stilling.
