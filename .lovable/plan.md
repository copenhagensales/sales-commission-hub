

# Fremhæv Kommende begivenheder med bedre UI/UX

## Ændring
Gør "Kommende begivenheder"-kortet visuelt mere fremtrædende og indbydende, så det fanger øjet med det samme.

## Konkrete forbedringer

### 1. Accent-border og farve
Tilføj en farvet venstre kant (border-l-4 border-primary) på kortet, så det visuelt skiller sig ud fra de andre kort på siden.

### 2. Bedre dato-visning
Giv dato-boksen en solid primary-baggrund med hvid tekst i stedet for plain tekst. Det skaber et visuelt "kalender-ikon"-look for hvert event:
- Rundet baggrund med primary-farve
- Hvid dag-tekst og lysere måned-tekst

### 3. Næste event fremhævet
Det første event i listen (det nærmeste) får en subtil gradient-baggrund eller en lidt stærkere baggrundsfarve, så man straks ser hvad der kommer først.

### 4. Tom-tilstand med ikon
Hvis der ikke er nogen events, vis et CalendarX-ikon og en mere indbydende tekst i stedet for bare grå tekst.

### 5. Countdown-badge
Vis en lille badge med "om X dage" på det næste event, så det føles mere aktuelt og tidskritisk.

## Tekniske detaljer

Fil: `src/pages/Home.tsx`

1. **Card**: Tilføj `border-l-4 border-primary` for accent-kant
2. **Dato-boks** (linje 650-657): Wrap i en `div` med `bg-primary rounded-lg p-1.5` og ændr tekst til `text-primary-foreground`
3. **Første event** (linje 649): Tilføj conditional styling `index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'`
4. **Countdown**: Beregn `differenceInDays(parseISO(event.event_date), new Date())` fra date-fns og vis som badge ved siden af titlen for det næste event
5. **Tom-tilstand** (linje 641-642): Erstat med CalendarX-ikon + mere venlig tekst
6. Import `differenceInDays` fra date-fns (allerede installeret)

