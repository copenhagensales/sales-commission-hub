

## Min Vagtplan - Personlig booking-oversigt for medarbejdere

### Formaal
Oprette en ny side "Min vagtplan" under Fieldmarketing-sektionen, hvor medarbejdere kan se deres egne kommende (og tidligere) vagtbookinger med lokation, makker, bil og diaet - uden at kunne se andres vagter.

### Overblik over aendringer

**Ny side**: `src/pages/vagt-flow/MyBookingSchedule.tsx`
- Henter den indloggede medarbejders `employee_id` via `useAuth` + opslag i `employee_master_data`
- Ugentlig visning med uge-navigation (som BookingsContent)
- For hver uge: henter `booking_assignment` hvor `employee_id` matcher, joinet med `booking` og `location`
- For samme bookinger: henter `booking_vehicle` og `booking_diet` data
- For makkere: henter andre `booking_assignment` paa samme booking+dato (kun fornavn vises)
- Visuelt layout: Liste af dage (Man-Son) med kort der viser:
  - Lokationsnavn og by
  - Kunde/kampagne
  - Arbejdstid (start_time / end_time fra assignment)
  - Makker(e) - kun fornavn
  - Bil-tag (gul badge med bilnavn)
  - Diaet-tag (orange badge)
- Tomme dage viser "Ingen vagt"

**Nyt menupunkt**: Tilfoej `menu_fm_my_schedule` til sidebaren under Fieldmarketing
- Permission key: `menu_fm_my_schedule`
- Label: "Min vagtplan"
- Ikon: `Calendar` (eller `UserCheck`)
- Placeres oeverst i VAGT_FLOW_ITEMS

**Foreslaaede forbedringer**:
1. **Ugenummer og maaned-header** - tydeligt vise hvilken uge/periode man kigger paa
2. **"I dag"-markering** - fremhaev dagens vagt med en anden farve
3. **Naeste vagt-sektion oevrst** - vis den naeste kommende vagt prominent oeverst paa siden
4. **Telefonnummer paa makker** - mulighed for at kontakte sin makker (valgfrit, kan tilfojes senere)

### Teknisk plan

#### 1. Permission key (`src/config/permissionKeys.ts`)
Tilfoej under Fieldmarketing-sektionen:
```
menu_fm_my_schedule: { label: 'Min FM vagtplan', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' }
```

#### 2. Sidebar menupunkt (`src/components/layout/PreviewSidebar.tsx`)
Tilfoej til `VAGT_FLOW_ITEMS`:
```
menu_fm_my_schedule: { name: "Min vagtplan", href: "/vagt-flow/my-schedule", icon: UserCheck }
```

#### 3. Route (`src/routes/config.tsx`)
Tilfoej ny route:
```
{ path: "/vagt-flow/my-schedule", component: MyBookingSchedule, access: "role", positionPermission: "menu_fm_my_schedule" }
```

#### 4. Ny side (`src/pages/vagt-flow/MyBookingSchedule.tsx`)
Hovedkomponenten med foelgende data-flow:

```text
1. Hent employee_id fra auth bruger
2. Query booking_assignment WHERE employee_id = min_id
   JOIN booking (lokation, kunde, kampagne, uge, aar)
   JOIN location (navn, by)
3. Query booking_vehicle for relevante bookinger
4. Query booking_diet for relevante bookinger  
5. Query andre booking_assignment paa samme booking+dato (makkere)
6. Vis ugentlig oversigt med dag-kort
```

**Dag-kort layout**:
```text
+------------------------------------------+
| MAN 24/2                          [i dag] |
| Kvickly Brondby - Coop butik             |
| 08:00 - 16:00                            |
| Makker: Melissa                          |
| [Car] Ford Transit   [Utensils] Diaet    |
+------------------------------------------+
```

#### 5. Data-sikkerhed
- Queryen filtrerer altid paa medarbejderens eget `employee_id` - ingen andres fulde vagtdata vises
- Makkeres navne vises kun som fornavn (privacy)
- Ingen redigering - rent read-only view

### Filer der oprettes/aendres
| Fil | Handling |
|---|---|
| `src/pages/vagt-flow/MyBookingSchedule.tsx` | Ny fil |
| `src/config/permissionKeys.ts` | Tilfoej `menu_fm_my_schedule` |
| `src/components/layout/PreviewSidebar.tsx` | Tilfoej menupunkt |
| `src/routes/config.tsx` | Tilfoej route |

