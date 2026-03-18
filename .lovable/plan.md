

## Pænere Header + Countdown UI

Baseret på screenshottet ser jeg to hovedproblemer: (1) headeren og countdown er visuelt adskilte men burde føles som én sammenhængende sektion, og (2) countdown-blokkene og progress-baren mangler polish.

### Forbedringer

**1. Header layout -- side-by-side på desktop**
- På desktop (`md+`): Sæson-info til venstre, countdown til højre i samme linje (fjern `border-t` separatoren)
- På mobil: Behold stacked layout
- Brug `flex-col md:flex-row md:items-center md:justify-between`

**2. Countdown visuelt løft**
- Giv time-blocks en subtle glasmorfisk effekt: `backdrop-blur-sm bg-white/5 border border-white/10`
- Brug `font-mono` på tallene for konsistent bredde
- Tilføj kolon-separatorer (`:`) mellem blokkene for et klassisk ur-look
- Gør progress-baren lidt tykkere (`h-2`) med en gradient-farve i stedet for plain primary

**3. Header polish**
- Fjern det motiverende citat fra headeren (det vises allerede i "Din Position"-kortet nedenunder -- dobbelt information)
- Gør "Landstræner" teksten mere subtle eller flyt den op ved siden af spillerantal
- Tættere spacing generelt (`space-y` reduktion)

**4. Progress bar gradient**
- Custom progress-bar indikator med `bg-gradient-to-r from-emerald-500 to-cyan-400` i stedet for plain `bg-primary`

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `CommissionLeague.tsx` | Omstrukturér header til side-by-side layout, fjern border-t separator, fjern motivations-citat |
| `QualificationCountdown.tsx` | Glasmorfiske time-blocks, kolon-separatorer, font-mono, gradient progress-bar |

