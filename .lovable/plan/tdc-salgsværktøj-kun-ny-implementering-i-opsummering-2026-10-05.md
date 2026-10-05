# TDC Salgsværktøj: kun "Ny Implementering" i Opsummering

## Hvad ændres
- På fanen **2. Opsummering** i TDC Salgsværktøjet (både den interne side og det åbne link) bruges altid "Ny Implementering".
- Knapperne Standard / Pilot / Kun 5g fri salg / Ny Implementering skjules helt her, fordi der kun er ét valg.
- Siden **TDC Opsummering** (intern og offentlig) er uændret og har stadig alle fire typer.

## Teknisk
- `TdcOpsummeringForm` får en ny valgfri prop `onlyImplementering`.
  - Er den sat, starter typen som `implementering`, og kortet med typevalg vises ikke.
  - Uden prop'en virker formularen præcis som i dag.
- `TdcSalgTool` sender `onlyImplementering` med til formularen.
- Ingen andre filer, ingen data og ingen tekster ændres.

## Test
- På TDC Salgsværktøjet skal der ikke være nogen typeknapper, og teksten skal være Ny Implementering-teksten.
- På TDC Opsummering skal de fire knapper være der som før.
