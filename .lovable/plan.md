# Plan: Udfyld provision pr. medarbejder (15/7–14/8 2026)

## Mål
Udfyld kolonnen "Provision" i den uploadede fil `Provision_alle_sælgere.xlsx` (96 medarbejdere) med den samlede provision i perioden 15/7–14/8 2026 — på tværs af alle klienter, cases og teams. Rækkefølgen af medarbejdere bevares 1:1 som i den uploadede fil.

## Datagrundlag
Samme metode som United- og Relatel-trækkene:
- Navne matches mod `employee_master_data` (fulde navn, med normalisering for dobbelte mellemrum, trailing bindestreg/mellemrum og kendte aliaser, fx "Chanell Gorell").
- Kobling til salg via `employee_agent_mapping` → `agents` (e-mail + external dialer-id) mod `sales.agent_email` / `sales.agent_external_id`.
- Provision = sum af `sale_items.mapped_commission` for salg med `sale_datetime` i 15/7 00:00 – 14/8 23:59:59, hvor `validation_status` ikke er `rejected`.
- Ingen filtrering på klient eller team — total sum på tværs af alt.

## Fremgangsmåde
1. Læs navnelisten i oprindelig rækkefølge.
2. Match hvert navn til medarbejder-id; log de navne der ikke kan matches entydigt.
3. Hent provision pr. medarbejder for perioden.
4. Skriv ny Excel-fil med kolonnerne Medarbejder, Provision (og en kolonne "Antal salg" + noteringsfelt for umatchede navne, så det er tydeligt hvad der er 0 og hvad der er ukendt).
5. Kontrollér filen for formelfejl og verificér at rækkefølge og antal rækker (96) er uændret.

## Leverance
- `Provision_alle_saelgere_15-07_14-08_2026.xlsx` i dokumentmappen.
- Kort opsummering: antal matchede medarbejdere, antal umatchede navne, samlet provision.

## Bemærkning
Umatchede navne udfyldes ikke med 0 — de markeres tydeligt, så en manglende match ikke forveksles med "ingen salg".
