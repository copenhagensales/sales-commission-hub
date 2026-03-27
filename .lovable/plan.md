

## Interaktivt Rettighedskort — Klik for at ændre rettigheder direkte

### Hvad vi bygger
Gør rettighedskortet interaktivt, så man kan klikke på en permissions-dot for at ændre adgangsniveauet direkte. Ændringer skrives til samme `role_page_permissions` tabel og invaliderer samme query-cache som "Rediger"-fanen, så begge views er synkroniserede.

### Design

Når man klikker på en dot (rolle+permission), åbnes en lille popover/dropdown med 4 valg:
- Fuld adgang (can_view + can_edit + visibility=all)
- Kan redigere (can_view + can_edit + visibility=team/self)
- Kun læse (can_view, !can_edit)
- Ingen adgang (!can_view, !can_edit)

Ændringen gemmes øjeblikkeligt til databasen (samme mønster som PermissionEditor `togglePermission`). Begge faner opdateres automatisk via `queryClient.invalidateQueries(['page-permissions'])`.

### Teknisk plan

**Én fil ændres:** `src/components/employees/permissions/PermissionMap.tsx`

Ændringer:
1. Importer `useMutation`, `useQueryClient` fra tanstack, `supabase` client, `Popover`/`PopoverContent`/`PopoverTrigger` fra UI, og `toast` fra sonner
2. Erstat passive `<span>` dots med `<PopoverTrigger>` der åbner en lille menu med de 4 adgangsniveauer
3. Ved klik på et niveau: kør `supabase.from('role_page_permissions').update({ can_view, can_edit, visibility }).eq('id', perm.id)` og invalider `['page-permissions']`
4. Vis toast ved succes/fejl
5. Filtrer kun når en enkelt rolle er valgt ELLER vis popover for hver dot uanset

Mutation-logik kopieres fra PermissionEditors eksisterende `togglePermission` og `updateRowVisibility` — samme tabel, samme felter, samme invalidation.

### Synkronisering
Begge tabs bruger `usePagePermissions()` som er cached med `queryKey: ['page-permissions']`. Når kortet opdaterer og kalder `queryClient.invalidateQueries(['page-permissions'])`, opdateres editoren automatisk og omvendt. Ingen ekstra synkronisering nødvendig.

### Risiko
**Lav** — bruger præcis samme Supabase-opdateringsmønster som PermissionEditor. Ingen ny tabeladgang, ingen nye RLS-krav. Rent additiv UI-ændring.

