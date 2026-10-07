# Kundeaftaler – tillæg (allonge) til databehandleraftale

## Konklusion
Byggeriet kan laves uden at læse kundepersondata. Der er dog fire huller i dagens data, som ordren forudsætter findes. De skal besluttes før byggeriet går i gang (se "Beslutninger").

## Fund (kun metadata læst)
- 16 kunder, 24 kampagner, 23 retentionspolitikker. Mindst én kampagne mangler altså en politik.
- `ingestion_known_fields` har kolonnerne integration, container, field_label, decision og note. Der er 97 felter med UAFKLARET.
  - Feltregistret er pr. **integration** (dialerkonto), ikke pr. kampagne.
  - Der findes ingen markering af "er persondata" og intet forretningsnavn.
- Hostingregionen findes ikke som data. Den står som fast tekst i `ProcessingRegistry.tsx:138`, `DpaOverview.tsx:53` og `BackupPolicy.tsx:29`.
- `dpa_documents` har kun vendor og fil. Der er ingen CVR, ingen lokation og intet overførselsgrundlag. Leverandørlisten `DPA_REQUIRED_VENDORS` ligger i koden (`complianceDocuments.ts:49`).
- Siden `/compliance/documents/client-agreements` ("Kundeaftaler", filarkiv) findes allerede. Den nye side får derfor en anden rute og et andet navn.

## Beslutninger (A/B pr. punkt)
1. **Felter pr. kampagne.** A: Vis BEHOLD-felter for kampagnens dialerintegration (alle kampagner på samme konto får de samme felter). B: Tilføj en ny mapping fra kampagne til felt, som skal vedligeholdes manuelt.
2. **Persondata og forretningsnavn.** A: Tilføj de nye kolonnerne `is_personal_data` og `business_label` til `ingestion_known_fields`. Det er kun en tilføjelse, og ingestion læser dem ikke. Superadmin udfylder dem. B: Brug en separat tabel `dpa_field_labels`, så feltregistret ikke røres.
3. **Hostingregion som én kilde.** A: Opret en ny lille tabel `compliance_facts` (key/value) med `hosting_region = eu-west-3 (Paris)`. Art. 30-siden og allongen læser derfra. Det kræver en lille ændring af `ProcessingRegistry.tsx`, og ordren siger "ingen ændring af eksisterende compliance-dokumenter". B: Konstanten flyttes til `complianceDocuments.ts` og bruges begge steder. Det er stadig kode, men kun ét sted.
4. **Underdatabehandlere (CVR, lokation, grundlag).** Ny tabel `dpa_subprocessors`, seedet med Lovable, Supabase, Microsoft og Adversus. Kasper skal levere eller bekræfte CVR/registrering og overførselsgrundlag. Jeg finder ikke på værdier.

## Byggeri (efter beslutninger)
**Database (én migration, RLS kun for superadmin via `am_i_superadmin`-mønstret):**
- `dpa_client_profiles`: kunde, juridisk navn, CVR, adresse, oprindelig aftaletitel og -dato, godkendelsesform, varseldage, valgte underdatabehandlere og fritekst.
- `dpa_addenda`: kunde, version, `content` jsonb, `pdf_path`, oprettet af og tidspunkt, status, sendt-dato, godkendt-dato og -kontakt, afvist og `signed_pdf_path`.
  - En trigger blokerer ændring af `version`, `content` og `pdf_path`. Kun status-, dato- og signeret-felter kan ændres. Sletning er blokeret.
- Status "Erstattet" sættes automatisk på ældre versioner, når en nyere bliver Godkendt.
- Privat lagerplads `dpa-addenda`, kun for superadmin.
- Ny kontrol `compliance_check_dpa_addenda()`, som kaldes fra `compliance_run_checks`. Den sammenligner det godkendte snapshot med live-opsætningen og rejser en alarm med niveauet HOEJ. Kunder uden godkendt version giver ingen alarm.

**Frontend:**
- Hook `useDpaAddenda.ts` (React Query), som samler data fra kunder, kampagner, retention, feltregister, underdatabehandlere og hostingregion.
- Side `/compliance/dpa-addenda` "Kundeaftaler – tillæg" med listen: Kunde | Seneste version | Status | Sendt | Godkendt | Afviger.
- Kundedetalje med de manuelle felter, det automatiske indhold og advarsler.
  - Generér-knappen er deaktiveret ved UAFKLARET eller manglende retention.
  - Hver version har knapperne Sendt, Godkendt, Afvist, upload af underskrevet kopi og download.
- PDF genereres i browseren med jsPDF og brandfarver, i samme stil som `contractPdfGenerator.ts`. Sidehoved og -fod viser version, dato og sidetal. Teksten følger ordrens afsnit 1–4 og slutbestemmelse.

## Risici
- `compliance_run_checks` ligger i rød zone. Ændringen er kun et ekstra kald, og eksisterende kontroller røres ikke.
- De 97 UAFKLARET-felter kan blokere PDF for mange kunder, indtil de er afklaret i feltregistret.
