

## Flyt "Turneringsregler" op i hero-headeren som kompakt knap

### Ændring

**Fjern** den fuldbredde `LeagueRulesSheet` fra linje 324-325 i `CommissionLeague.tsx`.

**Placér** den i hero-headeren ved siden af "Sæson 1" titlen — som en lille ikon-knap (Info-ikon) uden undertekst.

**Tilpas `LeagueRulesSheet`** så den accepterer en optional `compact` prop:
- `compact={true}`: Render kun et lille `Info`-ikon (ingen tekst, ingen border-box), passer ind i header-rækken
- Default (uden prop): Behold nuværende fuldbredde-stil (bruges ikke længere, men beholdes for fleksibilitet)

**Konkret placering** i headeren — efter Fan-badge på linje 296:

```text
🏆 Sæson 1  [Fan]  (i)
Kvalifikationsrunde • 69 spillere
```

`(i)` er en lille cirkulær Info-knap der åbner samme dialog.

