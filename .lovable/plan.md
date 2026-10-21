# Compliance: godkendelse ved Kasper, 3 nye dokumenter, 2 registre, PDF

Rød zone (compliance + RLS). Ordre fra Kasper. Bygges i den rækkefølge, Kasper har angivet. Intet andet i Stork røres.

## Afklaring først (ét spørgsmål)
"Godkendes alene af Kasper" og "kun superadmin kan redigere og godkende" kan læses på to måder:
- **A (anbefalet):** Alle superadmins må redigere, men kun Kasper kan godkende. Kasper gemmes som data ("godkender"-markering på hans superadmin-række) og ikke som navn i koden.
- **B:** Alle superadmins må både redigere og godkende. Dokumentet viser blot navnet på den, der godkendte.

Planen nedenfor går ud fra A.

## 1. Godkendelsesflow
- Nye tabeller: `compliance_documents` (nøgle, titel, aktuel version, status) og `compliance_document_versions` (versionsnummer, markdown-tekst, ændringsnote, godkendt af, godkendt dato, oprettet af). Versioner kan ikke ændres, når de er godkendt. Historikken bevares.
- Statusser: "Afventer Kaspers godkendelse" og "Gældende".
- Godkend: første godkendelse giver 1.0 "Gældende". Når en gældende tekst redigeres, oprettes 1.1, 1.2 osv. som udkast med ændringslog. Den gældende version gælder, indtil den nye bliver godkendt. Tidligere versioner kan ses på en versionsliste.
- RLS: superadmin læser og redigerer. Kun en godkender kan sætte en version til godkendt, og det håndhæves i databasen med en trigger. Der laves ingen ny SECURITY DEFINER.
- De tre eksisterende dokumenter (backup, art. 30 + risikovurdering, DPA-oversigt) flyttes over som markdown og sættes til "Afventer Kaspers godkendelse". Teksten om Mathias' og Lones godkendelse fjernes fra status og godkendelsesafsnit. Den faste dato og godkendelse i `complianceDocuments.ts` erstattes af data fra databasen.

## 2. Tre nye dokumenter
Persondatapolitik, Databrudsprocedure og Procedure for konsekvensvurdering lægges ind ordret som markdown, version 1.0 og status "Afventer". Telefonnummeret i pkt. 3.1 i databrudsproceduren er Kaspers egen tekst og kommer med uændret.

## 3. To registre
- **Databrudslog** (`compliance_breach_log`) med alle felterne fra ordren. Berørte kunder vælges blandt klienter. Der er en udløbsdato på 5 år, som bruges til sletning, når de 5 år er gået. Kun superadmin har adgang. Der er PDF-eksport pr. hændelse.
- **Konsekvensvurderinger** (`compliance_impact_assessments`) med titel, dato, hvad der vurderes, 8 svarfelter, konklusion og om kunden skal orienteres. Godkendelse sker som for dokumenterne.
- Begge registre får egne sider under Compliance og bruger React Query-hooks.

## 4. PDF-eksport
Fælles PDF-skabelon med Figtree, Onyx #2E3136 og en emerald-linje #3BE086 under overskrifter. Den bruges til alle dokumenter, til hver hændelse og til hver vurdering.

## Henvisninger, der skal tjekkes i Stork (rapporteres bagefter)
Disse er ikke bekræftet endnu: feltregister med BEHOLD/BLOKER/UAFKLARET, compliance-kontroller to gange dagligt med alarm, loginlog med 30 dages opbevaring, årlig gennemgang registreret i DPA-oversigten og kundegodkendelser i DPA-oversigten. Desuden mangler Twilio og e-conomic i den nuværende DPA-leverandørliste. Det bliver ikke bygget, kun rapporteret.

## Teknisk
- 1 migration: tabeller, GRANT, RLS og trigger til godkendelse og låsning af versioner.
- Nye filer under `src/pages/compliance/`, `src/hooks/useComplianceDocuments.ts`, `useBreachLog.ts`, `useImpactAssessments.ts` og en PDF-hjælper. Ruter og menupunkter tilføjes kun under Compliance.
- Markdown vises med den eksisterende `ComplianceDocument`-ramme.
