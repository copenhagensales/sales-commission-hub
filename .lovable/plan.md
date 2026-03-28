

## Compliance-link i bunden af sidebar (ved log ud)

### Ændring
I stedet for at tilføje Compliance som en sektion i hovednavigationen, placeres et enkelt "Compliance" link i footer-området af sidebar — lige over "Log ud"-knappen. Dette gælder for **AppSidebar** (hovedsystemet).

### Placering

I `src/components/layout/AppSidebar.tsx` (linje ~1905), tilføj et `NavLink` til `/compliance` med `Shield`-ikonet lige **før** logout-knappen:

```text
[... eksisterende nav ...]

── Footer-sektion (border-t) ──
  🛡 Compliance          ← NY — link til /compliance
  🚪 Log ud
  👤 Brugernavn
```

### Hvad der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/layout/AppSidebar.tsx` | Tilføj `NavLink` til `/compliance` med `Shield`-ikon i footer, før logout |
| `src/components/layout/PreviewSidebar.tsx` | Samme: tilføj Compliance-link i bunden før logout |

Linket vises for alle brugere (alle kan se oversigten + Side 1). Undersiderne styres af permissions som planlagt.

Resten af planen (4 sider, permissions, routes) forbliver uændret.

