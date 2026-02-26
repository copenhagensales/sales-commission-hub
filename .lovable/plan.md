

## Fix: Kapacitetspanel viser 0 medarbejdere for alle kunder

### Problem
`getEmployeeCountForClient` (linje 155-159) matcher medarbejdere til kunder ved at tjekke:
```
e.team?.toLowerCase().includes(clientName.toLowerCase())
```

Men alle FM-medarbejdere er i teamet **"Fieldmarketing"** - ikke i "Eesy FM" eller "Yousee". Derfor returnerer funktionen altid 0, og kapaciteten bliver 0.

### Løsning
Da alle fieldmarketing-medarbejdere er i en fælles pulje og kan arbejde for alle FM-kunder, skal kapaciteten beregnes baseret på **alle aktive FM-medarbejdere** (minus dem uden vagter), ikke opdelt per kunde.

### Ændring i `src/components/vagt-flow/CapacityPanel.tsx`

**`getEmployeeCountForClient` (linje 155-159)**: Fjern den fejlagtige team-navn-matching. I stedet returneres det samlede antal aktive FM-medarbejdere (ekskl. dem uden vagter) for alle kunder, da de deler den samme medarbejderpulje.

Tilsvarende rettelse i:
- **`getAbsencesForClientDay` (linje 170-182)**: Fjern team-navn-filtreringen, da fravær gælder for hele FM-puljen uanset kunde.

Begge funktioner bruger samme fejlagtige `e.team?.toLowerCase().includes(clientName.toLowerCase())` pattern.

### Resultat
- Kapacitet beregnes korrekt: (antal aktive medarbejdere - fraværende) / 2 = antal lokationer
- Bookinger vises stadig per kunde (det virker allerede korrekt via `client_id`)
- "Ledige" tallet afspejler den reelle kapacitet
