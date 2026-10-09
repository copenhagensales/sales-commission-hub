# Slet "Age" fra tidligere annulleringsuploads

## Hvad der ligger i dag (bekræftet, kun antal er læst)

Kolonnen "Age" ligger stadig gemt på hver linje fra tidligere uploads under Annulleringer:

| Kunde | Linjer med Age | Uploadperiode | Status |
|---|---|---|---|
| Eesy TM | 290 | 29. apr – 28. maj 2026 | godkendt |
| Eesy FM | 230 | 28. maj 2026 | godkendt |

- Alderen ligger kun i de gemte uploadrækker. Listerne med umatchede rækker indeholder den ikke.
- Ingen del af matchingen, lønnen eller rapporterne læser "Age". Søgningen i koden fandt den kun på en liste over felter, der aldrig må gemmes fra opkaldssystemerne.
- Nye uploads fra Eesy TM gemmer den ikke længere, når den står som "Importeres ikke" under Data import.

## Plan

1. **Tørkørsel:** Tæl de linjer, der berøres, og kontrollér, at ingen andre felter ændres.
2. **Slet kun "Age"-feltet** fra de gemte uploadrækker. Resten af hver linje bliver liggende uændret: telefon, produkt, sælger, status og godkendelse. Annulleringerne og lønfradragene påvirkes derfor ikke.
3. **Log sletningen** med antal, kunde og årsag i den eksisterende log over oprydning af persondata.
4. **Kontrol bagefter:** 0 linjer har "Age". Antal annulleringer, deres status og fradragsbeløb er de samme før og efter.

## Beslutning der er nødvendig

Eesy FM har også 230 linjer med "Age". Skal de slettes sammen med Eesy TM? Sig ja, ellers sletter jeg kun Eesy TM.

## Tekniske detaljer

- `UPDATE cancellation_queue SET uploaded_data = uploaded_data - 'Age'` for rækker, hvor `uploaded_data ? 'Age'`, afgrænset via `cancellation_imports.client_id` til den eller de valgte kunder.
- Der skrives en række i `gdpr_cleanup_log`. Ingen ændring af skema, kode, `status`, `deduction_date` eller beløb.
- Felterne nævnt i trin 4 måles som aggregater før og efter. Ingen kundeværdier læses.
