
Mål: få Eesy FM til faktisk at vise Excel-produktnavne som “Subscription Name”, så de kan auto-matches mod systemets produkter og bruges i godkendelsesflowet.

1. Bekræftet årsag
- I de aktuelle Eesy FM-kø-rækker findes produktnavnet i `uploaded_data["Subscription Name"]`, men `target_product_name` er `null`.
- Eesy FM-konfigurationen har i dag `product_columns: []`.
- Derfor læser produkt-mapping fanen fra de forkerte kilder for denne type import.

2. Hvad jeg vil ændre
- Udvide produktnavne-kilden i `SellerMappingTab.tsx`, så den ikke kun læser `target_product_name`, men også udleder Excel-produktnavne direkte fra upload-rækkerne.
- Bruge konfigurationens `product_columns` når de findes, og ellers falde tilbage til tydelige produktfelter som f.eks. `Subscription Name`, `Product`, `Produkt`, `Abonnement`.
- Beholde de eksisterende systemprodukter og auto-match, men nu med de rigtige Excel-navne som input.

3. Gøre løsningen brugbar fremadrettet
- Tilføje valg af produktkolonne i upload-konfigurationen i `UploadCancellationsTab.tsx`, så Eesy FM kan gemmes med `Subscription Name` som officiel produktkolonne.
- Udvide redigering af eksisterende config, så produktkolonnen også kan sættes dér, ikke kun telefon/filter.

4. Sikre at mappings bruges i selve flowet
- Opdatere `ApprovalQueueTab.tsx`, så produktgodkendelse kan slå Excel-produktnavnet op via `cancellation_product_mappings` og matche til det rigtige systemprodukt.
- Beholde nuværende direkte match som fallback, så eksisterende flows ikke brydes.

5. UX-forbedring
- I preview/godkendelse vise både Excel-produktnavn og systemprodukt side om side, så brugeren tydeligt kan godkende sammenligningen.

Berørte filer
- `src/components/cancellations/SellerMappingTab.tsx`
- `src/components/cancellations/UploadCancellationsTab.tsx`
- `src/components/cancellations/ApprovalQueueTab.tsx`
- Eventuelt mindre justering i `src/components/cancellations/ProductAutoMatch.tsx` hvis visningen skal vise både Excel- og systemnavn tydeligere.

Teknisk note
- Ingen databaseændring er nødvendig for denne løsning.
- Jeg vil genbruge eksisterende data i `uploaded_data`, `cancellation_upload_configs` og `cancellation_product_mappings`.
- Den vigtigste ændring er at stoppe med at antage, at Excel-produktnavnet altid ligger i `target_product_name`.
