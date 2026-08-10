# Verifikation: går Balder og Flora ind på den rigtige medarbejder?

Ja — verificeret i data og kode. Ingen ændringer nødvendige.

## Evidens

**Balder** (`employee_master_data`): `first_name = "Balder Møller Nørgaard"`, `last_name = "-"`, aktiv, `work_email = bamn@copenhagensales.dk`.
Normaliseringen i bulk-importen fjerner ikke-alfanumeriske tegn og kollapser mellemrum (`manual-sales/index.ts:288-293`), så "Balder Møller Nørgaard -" bliver "balder møller nørgaard" og matcher filnavnet.

**Flora**: to rækker med samme arbejdsmail `flk@copenhagensales.dk` — aktiv "Flora Klug" og inaktiv "Flora Frederikke Mwikali Lauritsen Klug". Alias-logikken (`:296-306`) accepterer det historiske navn, men mapper altid til den **aktive** mail. Salget får derfor `agent_email = flk@copenhagensales.dk`.

**Ingen risiko for forkert person:** kontrol af alle rækker med `work_email` viser 0 tilfælde hvor samme normaliserede navn peger på to forskellige mails. Der er altså ingen navne-kollision der kan sende salget til en anden medarbejder.

**Attribution virker allerede på disse mails:** `sales` indeholder 602 salg på `bamn@` og 707 på `flk@`, dvs. begge mails er de identiteter tavle, dagsrapport og løn i forvejen bruger.

## Hvad der sker ved upload

1. Kontrol-fasen (dry-run) markerer rækkerne som "klar" — kun disse sendes videre.
2. Ved "Registrer salg" oprettes salget med `agent_email` = medarbejderens aktive arbejdsmail (`:378`), produktet `Lederne` under kampagnen Tryg Products.
3. Salget indgår derefter i Trygs dagsrapport, dashboard og sælgerens løn på lige fod med øvrige manuelle salg.

## Anbefaling (ikke del af denne opgave)

Navnedata bør ryddes op på sigt: 13 rækker har hele navnet i `first_name` og "-"/blank i `last_name`. Matchet er robust nu, men data er stadig forkert. Sig til hvis det skal planlægges separat.
