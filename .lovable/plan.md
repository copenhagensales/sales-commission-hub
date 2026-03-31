

## Fix CS Top 20 TV-board — tredje kolonne afskåret

Billedet viser at "Top Lønperiode"-kolonnen er delvist afskåret på højre side. Layoutet skal strammes op så alle 3 kolonner passer på skærmen.

### Ændringer i `src/pages/CsTop20Dashboard.tsx`

1. **Reducer padding** på TV-mode wrapper: `p-2` → `p-1.5` og `gap-2` → `gap-1.5`
2. **Reducer commission-badge bredde**: Formater tal mere kompakt (fjern decimaler eller brug kortere format)
3. **Stram rækker op**: Reducer `px-2` → `px-1.5`, `gap-1.5` → `gap-1` i seller-rows
4. **Reducer navn-bredde**: Sørg for at `displayName` truncates korrekt med `max-w` constraint
5. **Reducer header-størrelse**: Gør card-header mere kompakt i TV-mode

Ingen backend-ændringer — kun CSS/layout justeringer i TV-mode branching.

