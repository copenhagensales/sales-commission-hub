

# Plan: Udfyld resterende AMO-data

Baseret på dine svar vil jeg udfylde følgende data via direkte database-operationer:

## 1. Møder — tilføj standard-dagsorden og beslutninger
Opdater de 3 eksisterende møder med:
- **Dec 2024** (completed): Dagsorden om konstituering af AMO, valg af AMR, uddannelsesplan. Beslutninger: AMO godkendt, William Hoe valgt som AMR.
- **Mar 2025** (completed): Dagsorden om APV-gennemgang, Kemi-APV, trivsel. Beslutninger: APV godkendt, 4 handlingsplaner igangsat.
- **Jun 2025** (planned): Dagsorden om opfølgning på handlingsplaner, status på uddannelse, næste APV.

## 2. Uddannelse — marker som gennemført
Opdater begge training-records (Johannes + William) til `status: 'completed'` med `completed_date: '2025-03-19'` (deadline-dato).

## 3. Årlig drøftelse — udfyld indhold
Opdater den eksisterende discussion med:
- **Evaluering**: Første år med formaliseret AMO — grundlæggende struktur etableret.
- **Mål**: Kvartårlige møder, løbende APV-opfølgning, trivselsmålinger.
- **Samarbejdsmodel**: AMO-gruppen mødes kvartårligt, løbende dialog via email.
- **Mødefrekvens**: Kvartårligt (4 møder/år).

## 4. Luk William Seiding/Hoe task
Opdater tasken til `status: 'completed'` med en note om at det er afklaret (samme person).

## 5. Dokumentcenter — opret pladsholdere
Indsæt 5 dokumentposter (uden filer) for:
- APV Copenhagen Sales 2025
- Kemisk APV 2025
- Uddannelsesplan AMO 2025
- Samarbejdsaftale AMO
- AMR Valgprotokol dec 2024

## Metode
Alt udføres via SQL data-operationer (UPDATE/INSERT). Ingen kodeændringer nødvendige — data vises automatisk i UI'et.

