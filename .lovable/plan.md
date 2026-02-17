
## Synkroniser Annulleringer-rettigheder med sidebar og tilfoej tab-permissions

### Problem
1. `menu_cancellations` er stadig kategoriseret under "Loen" (`menu_section_salary`) i `permissionKeys.ts`, men sidebaren viser den under "Rapporter". Permission Editor viser derfor Annulleringer under den forkerte sektion.
2. Annulleringssiden har 3 faner (Rediger kurv, Upload/match, Dubletter) uden individuelle rettighedsnoegler - der mangler granular kontrol.
3. Brugeren oensker at sikre at permissionKeys.ts altid afspejler sidebarens struktur.

### Loesning

#### 1. Flyt `menu_cancellations` til Rapporter-sektionen
**Fil:** `src/config/permissionKeys.ts`

Aendr linje 183 fra:
```text
menu_cancellations: { label: 'Annulleringer', section: 'salary', parent: 'menu_section_salary' },
```
til:
```text
menu_cancellations: { label: 'Annulleringer', section: 'reports', parent: 'menu_section_reports' },
```

Dette flytter Annulleringer fra "Loen"-sektionen til "Rapporter"-sektionen i Permission Editor, saa den matcher sidebarens placering.

#### 2. Tilfoej tab-permissions for Annulleringssiden
**Fil:** `src/config/permissionKeys.ts`

Tilfoej tre nye fane-noegler under `menu_cancellations` i reports-sektionen:
```text
tab_cancellations_manual: { label: 'Fane: Rediger kurv', section: 'reports', parent: 'menu_cancellations' },
tab_cancellations_upload: { label: 'Fane: Upload/match', section: 'reports', parent: 'menu_cancellations' },
tab_cancellations_duplicates: { label: 'Fane: Dubletter', section: 'reports', parent: 'menu_cancellations' },
```

#### 3. Implementer tab-permissions i Cancellations-komponenten
**Fil:** `src/pages/salary/Cancellations.tsx`

Tilfoej `useUnifiedPermissions` hook og betinget visning af tabs baseret paa rettighederne:
- Vis kun "Rediger kurv" tab hvis bruger har `tab_cancellations_manual` rettighed
- Vis kun "Upload/match" tab hvis bruger har `tab_cancellations_upload` rettighed
- Vis kun "Dubletter" tab hvis bruger har `tab_cancellations_duplicates` rettighed
- Ejer-rollen faar automatisk adgang til alt (haandteres allerede i `canView`)

### Hvorfor dette sikrer automatisk synkronisering

Systemet er allerede designet til automatisk synkronisering via denne arkitektur:

1. **permissionKeys.ts** er den enkelte kilde til sandhed (Single Source of Truth)
2. **Permission Editor** genererer sin UI automatisk fra `PERMISSION_KEYS` - saa naar vi aendrer parent/section her, opdateres editoren automatisk
3. **Auto-seeding** opretter automatisk database-raekker for nye noegler naar en rolle vaelges i editoren

Det eneste der kraeves ved fremtidige sidebar-aendringer er at opdatere `permissionKeys.ts` tilsvarende - resten haandteres automatisk.

### Filer der aendres
1. `src/config/permissionKeys.ts` - Flyt cancellations til reports + tilfoej 3 tab-noegler
2. `src/pages/salary/Cancellations.tsx` - Tilfoej betinget tab-visning baseret paa rettigheder
