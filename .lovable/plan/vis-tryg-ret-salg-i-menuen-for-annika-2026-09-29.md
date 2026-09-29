# Vis "Tryg - Ret salg" i menuen for Annika

## Årsag (bekræftet)
- Annika står på listen over personer, der må bruge siden, og selve siden åbner for hende.
- Men hele menugruppen "Rapporter" vises kun, hvis ens rolle har adgang til rapport-sektionen. Annika har rollen medarbejder, og den rolle har den adgang slået fra. Derfor ser hun slet ikke gruppen og dermed heller ikke fanen.

## Løsning (mindst mulig ændring)
Menugruppen "Rapporter" vises også for de personer, der må bruge "Tryg - Ret salg". Annika ser kun det ene punkt, fordi de andre rapporter stadig kræver deres egen adgang.

Vi ændrer ikke medarbejder-rollens rettigheder, da det ville ramme alle medarbejdere.

## Teknisk
- `src/components/layout/AppSidebar.tsx` linje 489-490: `showReportsMenu` = ikke skjult OG ( (`canView("menu_section_reports")` OG en af de eksisterende rapport-rettigheder) ELLER `showTrygEditSales` ).
- `showTrygEditSales` bygger allerede på `useTrygEditAccess` (ejer eller allowlist), så ingen nye rollenøgler og ingen DB-ændring.
- Kontrol: log ind som Annika, bekræft at kun "Tryg - Ret salg" vises under Rapporter.
