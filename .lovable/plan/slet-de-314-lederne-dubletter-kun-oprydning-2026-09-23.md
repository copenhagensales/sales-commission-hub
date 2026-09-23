# Slet de 314 Lederne-dubletter (kun oprydning)

## Hvad der slettes
De 314 manuelt indlæste Lederne-salg, hvor samme Adversus-emne allerede var hentet automatisk af API-synkroniseringen. API-rækkerne bevares uændret.

- Udvælgelse: salg på Lederne-produktet med kilde `manual_entry`, hvis emne-id (`raw_payload.subject_id`) også findes som `raw_payload.lead_id` på et salg med kilde `adversus_lederne`.
- Salgsdatoer: 18.–23. september 2026 — alle i den igangværende lønperiode, ingen i 15/8–14/9.
- Effekt: 27.420 kr. dobbelt provision og 62.800 kr. dobbelt omsætning forsvinder fra dagsrapporter, dashboards og løn. Berørte: chgo (81), flk (76), jeph (78), noto (79).
- Bekræftet: ingen af de 314 har provisionsposteringer eller rækker i annulleringskøen, så der røres ikke historik.

## Fremgang
1. Optæl før: manuelle Lederne-salg, API-salg og provision pr. sælger.
2. Slet `sale_items` og derefter `sales` for netop de 314 id'er (engangs-SQL, ingen skemaændring, ingen migration).
3. Optæl efter: forventet 3.187 manuelle, 383 API, og 27.420 kr. mindre provision.

## Ikke med i denne opgave
Årsagen bliver stående: bulk-importens dublettjek ser kun på manuelle salg og matcher på `subject_id`, mens API-salg har kilden `adversus_lederne`, intet telefonnummer og gemmer emne-id som `lead_id`. Uploader man den samme fil igen, opstår dubletterne på ny. Kodefixet tager vi når du siger til.
