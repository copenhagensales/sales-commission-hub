

## Plan: Konsolidering af Permission-nøgler med Automatisk Validering

### Baggrund: Hvorfor problemet opstod

Systemet har **to separate kilder** til permission-nøgler:

1. **`src/hooks/useUnifiedPermissions.ts`** — Definerer labels til Permission Editor UI (`permissionKeyLabels`)
2. **`src/config/permissions.ts`** — Definerer nøgler brugt af sidebar og routes

Disse to filer blev udviklet uafhængigt og er aldrig blevet synkroniseret. Når en ny nøgle tilføjes i én fil (f.eks. `menu_email_templates_recruitment` i Permission Editor), men ikke opdateres i den anden (sidebar bruger stadig `menu_email_templates`), opstår der uoverensstemmelse.

**Der er ingen automatisk validering** som advarer, når nøglerne ikke matcher.

---

### Løsningsplan

#### Del 1: Konsolidering af Nøgler

**Mål:** Ét enkelt sted definerer alle gyldige permission-nøgler

1. Oprette ny fil `src/config/permissionKeys.ts` som den **eneste kilde** til alle nøgler:
   - Eksporterer et `PERMISSION_KEYS` objekt med alle gyldige nøgler
   - Grupperet efter sektion (rekruttering, ledelse, etc.)
   - Inkluderer label og beskrivelse

2. Opdatere `useUnifiedPermissions.ts`:
   - Importerer `PERMISSION_KEYS` fra den nye fil
   - Genererer `permissionKeyLabels` dynamisk fra denne kilde

3. Opdatere `config/permissions.ts`:
   - Bruger samme `PERMISSION_KEYS` til at definere kategorier
   - Fjerner duplikerede definitioner

4. Opdatere `usePositionPermissions.ts`:
   - Bruger nøgler fra `PERMISSION_KEYS` i stedet for hardkodede strenge

5. Opdatere sidebar (`AppSidebar.tsx`, `PreviewSidebar.tsx`):
   - Bruger nøgler fra `PERMISSION_KEYS`

6. Opdatere routes (`config.tsx`):
   - Bruger nøgler fra `PERMISSION_KEYS` for `positionPermission`

#### Del 2: Automatisk Validering ved Build-time

**Mål:** Forhindre fremtidige uoverensstemmelser

1. Oprette en TypeScript-type der automatisk validerer:
   - Alle nøgler i sidebar skal eksistere i `PERMISSION_KEYS`
   - Alle nøgler i routes skal eksistere i `PERMISSION_KEYS`
   - TypeScript-fejl hvis en ukendt nøgle bruges

2. Oprette test-script `scripts/validate-permissions.ts`:
   - Sammenligner nøgler i kode med database
   - Advarer om manglende eller overskydende nøgler
   - Kan køres som del af CI/CD

---

### Tekniske Detaljer

#### Ny fil: `src/config/permissionKeys.ts`

```typescript
// Enkelt source of truth for alle permission-nøgler
export const PERMISSION_KEYS = {
  // Rekruttering
  menu_recruitment_dashboard: { label: 'Rekruttering Dashboard', section: 'rekruttering' },
  menu_candidates: { label: 'Kandidater', section: 'rekruttering' },
  menu_email_templates: { label: 'E-mail skabeloner', section: 'rekruttering' },
  menu_sms_templates: { label: 'SMS skabeloner', section: 'rekruttering' },
  // ... alle andre nøgler
} as const;

// Type for alle gyldige nøgler
export type PermissionKey = keyof typeof PERMISSION_KEYS;

// Helper til at validere en nøgle
export function isValidPermissionKey(key: string): key is PermissionKey {
  return key in PERMISSION_KEYS;
}
```

#### Opdateret sidebar-struktur

```typescript
import { PERMISSION_KEYS, type PermissionKey } from '@/config/permissionKeys';

const RECRUITMENT_ITEMS: Record<PermissionKey, NavItem> = {
  menu_recruitment_dashboard: { name: "Dashboard", href: "/recruitment", icon: LayoutDashboard },
  menu_email_templates: { name: "Email skabeloner", href: "/recruitment/email-templates", icon: Mail },
  // TypeScript fejl hvis nøgle ikke eksisterer i PERMISSION_KEYS
};
```

#### Fix af email_templates specifikt

| Nuværende | Ændres til |
|-----------|------------|
| `menu_email_templates_recruitment` (Permission Editor) | `menu_email_templates` |
| `menu_email_templates` (Sidebar/Routes) | Beholdes |

Beslutning: Brug den simple `menu_email_templates` overalt. Fjern `_recruitment` suffikset i databasen.

---

### Implementeringsrækkefølge

1. **Opret `permissionKeys.ts`** med alle nuværende nøgler
2. **Opdater databasen** — rename `menu_email_templates_recruitment` til `menu_email_templates`
3. **Opdater `useUnifiedPermissions.ts`** — brug nye nøgler
4. **Opdater `config/permissions.ts`** — brug importerede nøgler
5. **Opdater sidebars** — tilføj type-sikkerhed
6. **Opdater routes** — tilføj type-sikkerhed
7. **Test synkronisering** — verificér at Permission Editor matcher sidebar

---

### Fordele

- **Én kilde til sandhed** — Alle nøgler defineres ét sted
- **Type-sikkerhed** — TypeScript advarer ved fejl under udvikling
- **Ingen duplikering** — Reducerer risiko for drift mellem filer
- **Lettere vedligeholdelse** — Tilføj ny nøgle ét sted, virker alle steder

