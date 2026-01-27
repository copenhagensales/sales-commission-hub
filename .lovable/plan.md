
# Plan: Medarbejder Stamkort i Popup-vindue (Kun visning)

## Overblik
Ændrer klik-adfærden i "Nye medarbejdere"-fanen, så medarbejderens stamkort åbnes i et popup-vindue i stedet for at navigere til en ny side. Popup'en viser alle stamdata i read-only tilstand - ingen redigeringsmuligheder.

## Funktionalitet
- Ved klik på en medarbejderræk åbnes en dialog med stamkort-oplysninger
- Alle felter vises kun som tekst (ingen edit-knapper, input-felter eller switches)
- Dialog'en kan lukkes med X-knappen eller ved at klikke udenfor
- Spejler strukturen fra det eksisterende stamkort (EmployeeDetail.tsx)

---

## Teknisk implementering

### Nye komponenter

#### 1. `src/components/employee/ReadOnlyRow.tsx`
Read-only versioner af de eksisterende redigérbare komponenter:

```text
┌─────────────────────────────────────────┐
│  Label           │  Værdi              │
└─────────────────────────────────────────┘
```

**Indhold:**
- `ReadOnlyRow` - Simpel label/value visning
- `ReadOnlyContactRow` - Telefon med klikbart link (tel:/mailto:)
- `ReadOnlyDateRow` - Formateret dato-visning
- `ReadOnlyTableSection` - Genbruger TableSection strukturen

Disse komponenter bruger samme styling som de eksisterende, men uden:
- Hover-effekter med edit-ikoner
- onClick-handlers
- Input-felter
- Pencil-ikoner

#### 2. `src/components/employee/EmployeeProfileDialog.tsx`
Hovedkomponent for popup-visningen:

```text
┌──────────────────────────────────────────────────────┐
│  [X]                                                 │
│  Anders Jensen                                       │
│  Salgskonsulent • Aktiv                             │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Identitet          │  │ Stilling           │     │
│  │ Fornavn: Anders    │  │ Jobtitel: Sælger   │     │
│  │ Efternavn: Jensen  │  │ Arbejdssted: KBH   │     │
│  │ CPR: ••••••••      │  │ Leder: Mikkel      │     │
│  └────────────────────┘  └────────────────────┘     │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Kontakt            │  │ Ansættelse         │     │
│  │ Tlf: 12345678      │  │ Start: 5. jan 2026 │     │
│  │ Email: a@test.dk   │  │ Timer: 37/uge      │     │
│  └────────────────────┘  └────────────────────┘     │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Adresse            │  │ Løn                │     │
│  │ Vesterbro 12       │  │ Type: Provision    │     │
│  │ 1620 København V   │  │ Ferie: Feriepenge  │     │
│  └────────────────────┘  └────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Props:**
- `open: boolean` - Om dialogen er åben
- `onOpenChange: (open: boolean) => void` - Callback for at lukke
- `employeeId: string | null` - ID på den valgte medarbejder

**Indhold:**
- Henter fuld medarbejderdata via useQuery
- Henter manager-navn via separat query
- Viser alle stamdata-sektioner i read-only format
- Responsive 2-kolonne layout (som EmployeeDetail)

### Ændringer i eksisterende filer

#### 3. `src/components/salary/NewEmployeesTab.tsx`
- Fjerner `useNavigate` import og navigation-logik
- Tilføjer state for `selectedEmployeeId` og `dialogOpen`
- Ændrer `handleRowClick` til at åbne dialog i stedet for at navigere
- Importerer og renderer `EmployeeProfileDialog`

---

## Read-Only komponent-mapping

| Original komponent | Read-only version | Forskel |
|-------------------|-------------------|---------|
| `EditableRow` | `ReadOnlyRow` | Ingen onClick, ingen Pencil-ikon |
| `ContactRow` | `ReadOnlyContactRow` | Beholder telefon/email links, fjerner edit |
| `DateRow` | `ReadOnlyDateRow` | Statisk dato-visning |
| `SelectRow` | `ReadOnlyRow` | Viser kun displayValue |
| `TableSection` | Genbruges direkte | Ingen ændring |

---

## Data der vises i dialogen

**Identitet:**
- Fornavn(e)
- Efternavn
- CPR-nr. (maskeret: ••••••••)

**Kontakt:**
- Telefon (klikbart)
- Privat email (klikbart)
- Arbejdsemail (klikbart)

**Adresse:**
- Vejnavn og nr.
- Postnummer
- By
- Land

**Stilling:**
- Jobtitel
- Arbejdssted
- Leder

**Ansættelse:**
- Startdato
- Slutdato
- Timer/uge
- Mødetid

**Løn:**
- Løntype
- Beløb (hvis relevant)

**Ferie & tillæg:**
- Ferietype
- Feriebonus % (hvis relevant)
- Parkering/md
- Henvisningsbonus
- Regulering/md

---

## Filstruktur

```
src/
├── components/
│   ├── employee/
│   │   ├── ReadOnlyRow.tsx           # NYT: Read-only komponenter
│   │   ├── EmployeeProfileDialog.tsx # NYT: Popup dialog
│   │   └── EmployeeDetailFields.tsx  # Eksisterende (uændret)
│   └── salary/
│       └── NewEmployeesTab.tsx       # ÆNDRET: Dialog i stedet for navigation
```

---

## Sekvensdiagram

```text
Bruger              NewEmployeesTab         EmployeeProfileDialog    Supabase
  │                      │                         │                    │
  │──(klik på række)────>│                         │                    │
  │                      │──(set employeeId)──────>│                    │
  │                      │                         │──(fetch employee)─>│
  │                      │                         │<──(data)───────────│
  │<──────────────(vis dialog)─────────────────────│                    │
  │                      │                         │                    │
  │──(klik X/udenfor)───>│                         │                    │
  │                      │──(close dialog)────────>│                    │
  │<──(tilbage til liste)│                         │                    │
```

---

## Dialog-styling

- `max-w-4xl` for at give plads til 2-kolonne layout
- `max-h-[90vh]` med `overflow-y-auto` for scroll på små skærme
- Bruger eksisterende dialog-komponent fra `@/components/ui/dialog`
- Matcher det mørke tema fra resten af applikationen
