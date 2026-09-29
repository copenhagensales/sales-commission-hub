# Dagsrapporter: kunde-afgrænset adgang (Rasmus Emil Hansen, TDC Erhverv)

## Sådan virker det i dag (bekræftet i koden)
- Dagsrapporter har kun tre adgangsniveauer: "alt", "team" og "egen" (`src/pages/reports/DailyReports.tsx:131`, `255-260`).
- Med "team" kan man kun vælge de teams, man er leder eller assistent for (`220-241`), og teamet vælges automatisk (`262-268`). Derfor kan Rasmus ikke vælge "Alle".
- Datahentningen viser kun medarbejdere fra ens egne teams (`546-551`). Salg på TDC Erhverv lavet af medarbejdere på andre teams er derfor ikke med.
- Der findes ingen mulighed for at give adgang til bestemte kunder. At give ham "alt" ville vise alle kunder, og det må han ikke se.

## Forslag
Vi laver en ny, generel indstilling "Kundeadgang til dagsrapporter" pr. medarbejder, så løsningen ikke er særbygget til én person:
1. **Ny tabel** med medarbejder og kunde, altså hvilke kunder personen må se alt salg på. Det kræver en migration med adgangsregler: kun ejere kan redigere, og brugeren selv kan læse sine egne rækker.
2. **Filtrene** for brugere med kundeadgang:
   - Teams kan sættes til "Alle".
   - Kunder er låst til de tilladte kunder, og andre kunder vises ikke.
   - Rapporten viser alt salg på de tilladte kunder, uanset sælgerens team.
3. **Sikkerhed i databasen:** Vi tjekker, at databasens adgangsregler for salg faktisk tillader ham at læse TDC-salg fra andre teams, og at de stadig blokerer for andre kunder. Er det ikke tilfældet, afgrænses det via en sikret databasefunktion. Filteret i skærmbilledet alene er ikke nok.
4. **Opsætning:** Vi giver Rasmus kundeadgang til TDC Erhverv.
5. **Verificering:** Vi logger ind som Rasmus i preview og tjekker:
   - Teams = Alle og Kunder = TDC Erhverv viser alt TDC-salg.
   - Andre kunder kan ikke vælges og vises ikke.
   - Andre brugeres visning er uændret.

## Zone
RØD zone (adgang/rettigheder). Kræver eksplicit godkendelse af denne plan. Ingen ændring af løn, priser eller salgsdata.

## Åbent
- Hvem skal kunne tildele kundeadgang? Planen antager kun ejere.
- Hvis Rasmus også skal se sit eget team på andre kunder, bevares hans nuværende teamadgang ved siden af kundeadgangen. Planen antager, at begge gælder.
