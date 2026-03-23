
# Plan: Gør søgningen langsommere og mere kontrolleret på Salg-siden

## Problem
Søgningen kører stadig automatisk for hurtigt, fordi den bliver sendt kort tid efter hvert tastetryk. Det giver for mange forespørgsler og en urolig oplevelse.

## Løsning
Jeg vil ændre søgningen fra “auto-søg næsten med det samme” til en mere bevidst søgning, så brugeren selv styrer hvornår der søges.

## Hvad jeg vil bygge

### 1. Skift fra hurtig auto-søgning til “anvend søgning”
I `SalesFeed.tsx` vil jeg splitte søgningen i to states:
- `searchInput` = det brugeren skriver
- `appliedSearch` = det der faktisk bruges i databasen

Det betyder:
- der søges **ikke** ved hvert tastetryk
- søgning kører først når brugeren:
  - trykker Enter
  - klikker på en søgeknap

### 2. Tilføj tydelig søgehandling i UI
Søgefeltet får en mere tydelig handling:
- søgeknap ved inputfeltet
- Enter aktiverer søgning
- X nulstiller både input og aktiv søgning med det samme

### 3. Tilføj minimumslængde på søgning
For at undgå støj vil jeg kun aktivere søgning når der er nok tekst, fx:
- mindst 2-3 tegn
- undtagelse hvis det ligner telefon/OPP/id-format

Det reducerer unødige opslag markant.

### 4. Behold nuværende gode date-filter, men uden at søgning føles “live”
Datofilteret kan blive som det er nu, men søgeforespørgslen bindes kun til den anvendte søgning (`appliedSearch`) i stedet for det rå input.

## Filer
- `src/components/sales/SalesFeed.tsx`

## Resultat
Efter ændringen vil siden føles mere rolig:
- brugeren kan skrive færdigt først
- søgningen starter kun når det giver mening
- færre unødige kald
- mere præcis og kontrolleret søgeadfærd

## Teknisk note
Jeg vil fjerne afhængigheden af den nuværende 400ms debounce som primær mekanik og i stedet bruge en “submit search”-model. Query-key og databasekald skal kun reagere på den aktive søgning, ikke mens brugeren stadig skriver.
