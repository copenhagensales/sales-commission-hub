

## Flyt menupunkter mellem sektioner med drag-and-drop

### Problem
Linje 335 i `MenuEditor.tsx` blokerer eksplicit flytning mellem sektioner:
```typescript
if (activeItem.parent_key !== overItem.parent_key) return;
```
Man kan kun sortere inden for samme sektion — ikke trække et punkt fra én sektion til en anden.

### Løsning
Udvid drag-and-drop logikken til at understøtte cross-container flytning:

1. **Tilføj `onDragOver`-handler** — Når man trækker et item hen over en anden sektion eller et item i en anden sektion, opdater `parent_key` i realtid så man visuelt kan se hvor det lander.

2. **Opdater `handleDragEnd`** — Fjern begrænsningen `parent_key !== overItem.parent_key`. Når et item droppes på/i en sektion det ikke tilhørte, sæt dets `parent_key` til den nye sektions `item_key` og re-beregn `sort_order`.

3. **Droppable sektions-zoner** — Gør hver sektions børne-område til en droppable zone (via `useDroppable` fra `@dnd-kit/core`), så man kan trække et item direkte ind i en sektion — også når den er tom eller foldet ud.

4. **Visuel feedback** — Highlight den sektion man hoverer over med en farvet border, så det er tydeligt hvor punktet lander.

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/MenuEditor.tsx` | Tilføj `onDragOver`, fjern parent_key-guard, tilføj droppable sektionszoner, visuel drop-feedback |

