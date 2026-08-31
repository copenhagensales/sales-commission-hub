# Indhold til "Tryg - Ret salg"

Siden får samme layout og datafunktion som "TDC Erhverv - ret salg", men viser udelukkende salg på ét bestemt produkt.

## Hvad der er verificeret

- Produktet findes: `Meeting -- CPH sales Kanvas` (produkt-id `24664858-d4e3-4227-9d6f-727f9c29cae0`), aktivt og ikke skjult. Det har ingen kampagnetilknytning, men alle 5.975 salgslinjer ligger under klienten Tryg (seneste 31/8 2026 08:54).
- Salgene er Enreach-baserede (`raw_payload` har `data`/`closure`, ikke `leadResultFields`), så de har ingen OPP-numre. Kolonnen "OPP nr." fra TDC-siden udgår.
- Adgang er allerede på plads: `useTrygEditAccess` (ejere + Filip/Annika), rute og menupunkt eksisterer.

## Hvad der bygges

- Tabel med alle salg på produktet for den valgte dag, nyeste først:
  - Tid, Sælgernavn, Antal, Produktnavn, Handlinger
- Datovælger med én dag ad gangen, som på TDC-siden.
- Handling: **Slet** pr. salg med bekræftelsesdialog, der siger tydeligt at sletningen er permanent og fjerner provision og omsætning fra rapporter.
- Ingen redigering af produkt, antal eller sælger i denne runde.
- Tomme tilstande: "Henter salg...", "Ingen Kanvas-salg på den valgte dag", og eksisterende "Ingen adgang"-kort bevares.

## Teknisk

1. Ny hook `src/hooks/useTrygKanvasSales.ts`:
   - Konstant `TRYG_KANVAS_PRODUCT_ID = "24664858-d4e3-4227-9d6f-727f9c29cae0"`.
   - `useTrygKanvasSales(day, enabled)` — henter `sale_items` filtreret på produkt-id med join til `sales` (dagsinterval på `sale_datetime`), plus sælgernavn opslået via `employee_master_data.work_email` som i `useTdcErhvervSales`.
   - `useDeleteTrygKanvasSale()` — sletter salgsrækken(erne) i `sales` (samme mønster som `useDeleteTdcErhvervOpp`) og invaliderer `["tryg-kanvas-sales"]`, `["sales-aggregates"]`.
2. `src/pages/reports/TrygEditSales.tsx` — erstat placeholder-kortet med kort, datovælger, tabel og `AlertDialog`, bygget på TDC-sidens struktur. Adgangskortet og overskriften bevares uændret.

Ingen ændringer i pricing, provision, løn, RLS eller andre rapporter. Sletning bruger den eksisterende adgang på `sales`.
