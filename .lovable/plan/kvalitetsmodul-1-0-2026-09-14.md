# Kvalitetsmodul 1.0

Nyt, additivt modul til intern kvalitetskontrol af salg. Ingen påvirkning af provision, løn, annullering, pricing eller eksisterende rapporter — kun nye tabeller, nye sider og nye mails.

## Hvad jeg har fundet i systemet (evidens)

- Salg ligger i `sales` (`id`, `client_campaign_id`, `agent_email`, `agent_name`, `sale_datetime`, `customer_phone`, `external_reference_number`, `external_sales_id`, `status`, `raw_payload`). Søgenøglen til optagelsen kan derfor dannes af telefonnummer, ellers OPP-nr./Sales ID, ellers medlemsnummer fra salgets egne felter.
- Sælger findes ud fra `agent_email` via `employee_agent_mapping` / `employee_master_data` (arbejds-/privatmail). Team og teamleder findes i `team_members`, `teams.team_leader_id` og `team_assistant_leaders`.
- Annulleringer ligger i `cancellation_queue` (`sale_id`, `status`) — bruges kun til at vise "annulleret", intet skrives.
- Mails sendes i dag ved at lægge rækker i `scheduled_emails` og lade `process-scheduled-emails` sende. Samme vej bruges her.
- Roller kommer fra jobtitel/stilling (`job_positions.system_role_key`) — der findes 11 rollenøgler i dag. Superadmin er data i `superadmins`.

## Antagelse jeg beder om at få bekræftet eller rettet

"Kvalitetskontrollant" bygges som **data** i en ny tabel `quality_controllers` (aktiv/inaktiv pr. medarbejder), efter samme mønster som superadmin — ikke som ny rollenøgle. Grunden: rollenøgler hænger på jobtitel/stilling, så en ny rollenøgle ville tvinge en ændring af folks stilling og ramme hele rettighedsmotoren (rød zone). Med en separat tabel kan flere personer få adgangen uden at deres øvrige adgang ændres.

## Datamodel (nye tabeller, alle med RLS og GRANT)

- `quality_checklists` — én tjekliste pr. kampagne med `version` og `valid_from`. Ny redigering giver ny version; gamle kontroller peger på deres egen version.
- `quality_checklist_items` — tekst, vejledning, type (`obligatorisk`/`kvalitet`), rækkefølge, aktiv.
- `quality_error_codes` — kode, tekst, type, aktiv.
- `quality_reviews` — én række pr. kontrol, aldrig opdateret eller slettet: salgs-id, kampagne, sælger, team + teamleder på kontroltidspunktet, kontrollant, `started_at`, `completed_at`, tjeklisteversion, udledt resultat, kommentar (maks. 500 tegn). Ny kontrol af samme salg = ny række.
- `quality_review_items` — pr. punkt: `ok` / `mangler` / `ikke_relevant`.
- `quality_review_error_codes` — valgte fejlkoder pr. kontrol.
- `quality_uncontrolled_sales` — salg der ikke blev kontrolleret den dag, markeret med dato (bruges til dækningsgrad, slettes aldrig).
- `quality_settings` — dagsmål for kontrollanten (standard 40).
- View `quality_sale_status` — seneste kontrol pr. salg: ikke_kontrolleret / godkendt / godkendt_med_bemaerkning / afvist.

Kontrolrækkerne indeholder ingen kundedata og overlever GDPR-anonymisering. Jeg tjekker eksplicit at de nuværende oprydningsjob ikke rører de nye tabeller, og retter intet i dem.

**Adgang (RLS):** kontrollant og superadmin ser alt. Teamleder og assisterende teamleder ser kun kontroller for eget team, læseadgang. Sælgere har ingen adgang — hverken i brugerfladen eller i data.

## Siden "Kvalitetskontrol"

- Standard: i går. Mandag viser fredag, lørdag og søndag. Datovælger til andre dage.
- Faner: "Alle" plus én pr. team.
- Kolonner: sælger, team, kampagne, tidspunkt, søgenøgle med kopier-knap, status, markering hvis salget er annulleret.
- Klik åbner tjeklisten i et sidepanel. Tastatur: 1 = OK, 2 = Mangler, 3 = Ikke relevant, pil op/ned skifter punkt, Enter gemmer og åbner næste ukontrollerede salg.
- `started_at` sættes når panelet åbnes, `completed_at` når der gemmes.
- Resultat udledes: manglende obligatorisk punkt → Afvist. Alle obligatoriske OK, men manglende kvalitetspunkt → Godkendt med bemærkning. Ellers Godkendt. Ved Afvist kræves mindst én obligatorisk fejlkode.
- Kommentarfelt med hjælpetekst om kun at beskrive sælgerens adfærd, maks. 500 tegn.
- Natligt job markerer dagens ukontrollerede salg som ikke kontrolleret, så køen ikke hober sig op.

## Tal på siden

Pr. fane: afvisningsprocent og bemærkningsprocent for dagen og rullende 30 dage med pil mod forrige periode, antal kontrollerede, dækningsgrad (dag og 30 dage) og fordeling pr. fejlkode i procent. Tabel pr. sælger med samme tal, hvor procent skjules under 15 kontrollerede salg i perioden — der vises kun antal.

Panel til kontrollanten selv (og superadmin): kontroller i dag mod dagsmål, gennemsnitlig tid pr. kontrol i dag og 30 dage, og små søjler for de seneste 30 dage.

## Mails

- **Straks ved Afvist:** til sælgerens teamleder og assisterende teamleder. Indhold: sælger, team, kampagne, salgstidspunkt, søgenøgle, fejlkoder, kommentar og link til salget.
- **Knappen "Færdig for i dag"** (kun kontrollanten, bekræftelsesdialog, én gang pr. dag): daglig sammenfatning til hver berørt teamleder, samt en samlet ledelsesmail til Kasper Mikkelsen og Mathias Dandanel Grubak med tabel pr. team, dagens afviste salg uden kommentarer og de tre hyppigste fejlkoder over 30 dage.
- Alle udsendelser logges. Mailene bruger Storks eksisterende maildesign.

## Administration og seed

Administrationsside for superadmin: tjeklister (redigering opretter ny version), fejlkoder, dagsmål, tildeling af kvalitetskontrollant og oversigt pr. kontrollant.

Seed af tjekliste version 1 for alle aktive kampagner med de seks obligatoriske punkter (OA gennemgået, opsummering, pris, bindingsperiode, fortrydelsesret, korrekt produkt) og tre kvalitetspunkter (professionel tone, indvendinger, intet unødvendigt pres) plus matchende fejlkoder.

## Menu

"Kvalitetskontrol" vises for kvalitetskontrollanter, teamledere, assisterende teamledere og superadmin. Skjult for sælgere.

## Kræver opsætning efter levering

Tildeling af kvalitetskontrollant til de rette personer. Alt andet er seedet.
