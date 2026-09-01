# Dagens target skal tælle med i baseline

## Hvorfor der står +20,5 i dag

`src/lib/boardProgress.ts:61-62` tæller kun hverdage der er HELT overstået:

```
const dayBeforeToday = new Date(..., dato.getDate() - 1);
const arbejdsdageGaaet = dayBeforeToday < monthStart ? 0 : countHverdage(monthStart, dayBeforeToday);
```

1. september er månedens første hverdag, så `arbejdsdageGaaet = 0` → `forventet = 0` → `gab = 0 - 20,5 = -20,5` → counteren viser `+20,5`. Det var den oprindelige regel ("dagen i dag tæller ikke med"), men den giver ingen baseline på dagen.

## Ændring

Dagen i dag tæller med som en fuld arbejdsdag, så baseline er `mål / arbejdsdageTotal` pr. hverdag inkl. i dag:

```
arbejdsdageGaaet = hverdage fra 1. til og med i dag (ekskl. helligdage)
forventet        = mål * (arbejdsdageGaaet / arbejdsdageTotal)
```

Med 22 hverdage i september 2026 giver det dagspace ≈ 38,6. På dag 1 bliver forventet 38,6, og med 20,5 solgt viser counteren `−18,1 bagud på dagen`.

Er i dag weekend/helligdag, tælles kun de forudgående hverdage (uændret adfærd).

Samme funktion bruges til fælles-baren, "forventet"-markøren og sælgerfarverne, så alle tre følger den nye baseline automatisk. Tærsklerne `ON_TRACK_DAGE = 1` / `EFTER_DAGE = 2` er uændrede.

## Filer
- `src/lib/boardProgress.ts` (grøn zone, kun boards — ingen lønberegning)
