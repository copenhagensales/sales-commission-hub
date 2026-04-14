

## Menu Admin — Drag-and-drop styring af AppSidebar

### Baggrund
AppSidebar.tsx er ~1950 linjer med hardcodet rækkefølge af ~15 sektioner (Mit Hjem, Spil, SOME, Personale, Ledelse, Vagtplan, Fieldmarketing, Rekruttering, Onboarding, Rapporter, Løn, Økonomi, Admin, AMO, Indstillinger) og ~60+ underpunkter. Rækkefølge og synlighed kan kun ændres via kodeændringer.

### Hvad bygges

En admin-side (`/admin/menu-editor`) hvor du kan:
- **Trække sektioner op/ned** for at ændre rækkefølgen i sidebaren
- **Trække menupunkter mellem sektioner** (f.eks. flytte "Fejlrapportering" ind under "Ledelse")
- **Skjule/vise** sektioner og enkeltpunkter med en toggle
- **Omdøbe** labels ved at klikke på teksten
- Se en **live preview** af den nye menustruktur

Permissions styrer stadig hvem der *kan* se et punkt — menu-editoren styrer kun *rækkefølge* og *synlighed* oveni permissions.

---

### Teknisk arkitektur

#### 1. Database: `sidebar_menu_config` tabel (migration)

```
id          uuid PK
item_key    text UNIQUE   -- f.eks. "section_mit_hjem", "item_messages", "item_my_profile"
parent_key  text NULL     -- NULL = top-level sektion, ellers sektionens item_key
sort_order  int
visible     boolean DEFAULT true
label_override text NULL  -- NULL = brug default label
icon_name   text NULL     -- Lucide icon navn (til fremtidig brug)
created_at  timestamptz
updated_at  timestamptz
```

Seed med nuværende struktur (alle ~75 rækker). RLS: kun brugere med owner/admin rolle kan læse/skrive.

#### 2. Hook: `useSidebarMenuConfig`
- Henter menu-konfigurationen fra databasen
- Fallback til hardcodet rækkefølge hvis tabellen er tom
- Caches med React Query (staleTime: 5 min)
- Eksporterer sorteret, hierarkisk struktur

#### 3. Admin-side: `src/pages/MenuEditor.tsx`
- Bruger `@dnd-kit/core` + `@dnd-kit/sortable` (allerede installeret i projektet)
- Venstre side: Sortérbar liste af sektioner, hver med sortérbare underpunkter
- Hver række: drag-handle ⠿ | ikon | label (klikbar for redigering) | synlighed-toggle
- "Gem ændringer"-knap der batch-opdaterer hele konfigurationen
- Preview-panel til højre der viser sidebaren som den vil se ud

#### 4. Refaktor AppSidebar.tsx
- Erstat hardcodet rækkefølge med config fra `useSidebarMenuConfig`
- Bevar al permissions-logik (den filtrerer stadig items)
- Config bestemmer kun `sort_order` og `visible` — permissions har altid forrang

### Filer der oprettes/ændres

| Fil | Handling |
|-----|----------|
| Migration (ny) | Opret `sidebar_menu_config` + seed + RLS |
| `src/hooks/useSidebarMenuConfig.ts` | Ny hook til menu config CRUD |
| `src/pages/MenuEditor.tsx` | Ny admin-side med drag-and-drop |
| `src/components/layout/AppSidebar.tsx` | Læs rækkefølge fra config |
| `src/routes/config.tsx` | Tilføj route til `/admin/menu-editor` |

### Begrænsninger
- Menupunkter med dynamisk logik (f.eks. Firmabil der kun vises for fieldmarketing-ansatte, Straksbetaling der vises baseret på salg) bevarer deres dynamiske visning — menu-editoren kan kun skjule dem yderligere, ikke tvinge dem synlige.
- Badges (ulæste beskeder, ventende kontrakter) følger stadig de eksisterende hooks.

