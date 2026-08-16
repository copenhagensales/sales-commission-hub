# Ny "Hold"-visning under Superligaen

En ny, supplerende visning på Superliga-siden. Den påvirker ikke den nuværende konkurrence, data eller beregninger — det er udelukkende en visningsomskifter.

## Sådan ser det ud

```text
+--------------------------------------------------------------+
|  [ Individuel ] [ Hold ]                SÆSON 4     nedtælling |
|  • Kvalifikationsrunde                Formand: ...            |
|  74 spillere tilmeldt                                         |
+--------------------------------------------------------------+

(Individuel = alt som i dag)
(Hold      = tom side under den øverste boks)
```

- Øverst til venstre i den blå/lilla topboks, lige over den grønne "Kvalifikationsrunde"-tekst, indsættes to små knapper: "Individuel" (aktiv som standard) og "Hold".
- Topboksen (grøn statustekst, antal tilmeldte, Sæson 4, formand, turneringsregler, sæsonvælger, nedtælling) vises uændret i begge visninger.
- Ved "Individuel": siden er præcis som i dag.
- Ved "Hold": alt under topboksen skjules og erstattes af et tomt område med en diskret tekst ("Holdkonkurrence kommer snart"), klar til indhold senere.
- Valget nulstilles ved sideskift (ren UI-state, ingen lagring).

## Teknisk

- Kun `src/pages/CommissionLeague.tsx` ændres (grøn zone: layout).
- Ny lokal state `leagueView: "individual" | "team"`.
- Knapperne placeres som første element i hero'ens venstre kolonne (`order-2 md:order-1`), stylet som små toggle-knapper i eksisterende design (aktiv = primær ring/baggrund).
- Alt indhold efter hero-blokken (Final Round Banner, MotivationBar, PrizeShowcase/HallOfFame, landing, kvalifikations- og sæson-boards, admin-kort) wrappes i `{leagueView === "individual" && ( ... )}`; sticky bar skjules også i Hold-visningen.
- Ingen datahentning, ingen hooks-ændringer, ingen DB-, RLS- eller pricing-ændringer.
