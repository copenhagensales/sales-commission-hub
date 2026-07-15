## Problem
I `relatel-produkter-v4.xlsx` er kolonnerne **"Provision v. tilskud=0 (kr)"** og **"Omsætning v. tilskud=0 (kr)"** tomme for alle produkter, selvom der findes aktive regler med `conditions = {"Tilskud": "0%"}` (fx `Uden tilskud`, `Tilskud`, `Ny tilskud`).

## Rod-årsag
Filter-funktionen `has_subsidy_zero(r)` i `/tmp/build_relatel_v3.py` (linje 44-53) sammenligner værdien mod `('0', '0.0', 'false', 'False')`.

DB gemmer værdien som **`"0%"`** (string med procent-tegn) — ingen af de fire strenge matcher. Resultat: `subsidy_zero_rule` er altid `None`, og de to kolonner + `Har tilskud-diff.` er tomme.

## Fix
Opdatér `has_subsidy_zero`:
- Strip `%` og whitespace fra værdien før sammenligning.
- Match hvis den normaliserede værdi er `"0"`, `"0.0"`, `"false"` (case-insensitive).

Regenerér `/mnt/documents/relatel-produkter-v4.xlsx` (overskriv — samme filnavn, da den nuværende v4 er fejlbehæftet).

## Verifikation
- Åbn xlsx og bekræft at fx `5 GB - 1 Time BTL` nu viser Provision 250 / Omsætning 565 i tilskud=0-kolonnerne (matcher regel `Tilskud` i DB'en).
- Tæl hvor mange af de 96 produkter der har tilskud=0-regel udfyldt, og rapportér tallet.

## Ingen kode-ændringer
Engangs-rettelse af eksport-scriptet i `/tmp` + ny xlsx til `/mnt/documents/`.
