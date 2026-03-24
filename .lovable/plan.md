

# Reorganiser Annulleringer-siden med to-niveau navigation

## Nuværende problem
Alle faner vises i én flad liste, og indhold vises selv uden valgt kunde.

## Nyt layout

### 1. Kunde-selector som prominent header
- Stor, tydelig kunde-selector øverst med valgt kundenavn vist tydeligt (evt. som badge/heading)
- Hvis ingen kunde er valgt: vis kun selector + besked "Vælg en kunde for at fortsætte" — ingen faner, intet indhold

### 2. To primære faner (niveau 1)
Når kunde er valgt, vis to hovedfaner:

**Manuel kontrol** — indeholder sub-tabs:
- Rediger kurv (ManualCancellationsTab)
- Dubletter (DuplicatesTab)

**Automatisk kontrol** — indeholder sub-tabs:
- Upload (UploadCancellationsTab)
- Godkendelseskø (ApprovalQueueTab)
- Godkendte (ApprovedTab)
- Tidligere uploads (CancellationHistoryTable)

### 3. Implementering

**Fil: `src/pages/salary/Cancellations.tsx`**

- Flyt kunde-selectoren op som en mere prominent del af headeren. Vis valgt kundenavn som heading-tekst efter valg.
- Guard: `if (!selectedClientId)` → vis kun selector + placeholder-besked, return early før tabs.
- Erstat den flade tab-liste med to-niveau tabs:
  - Ydre `Tabs` med "manual" og "automatic"
  - Indre `Tabs` i hver sektion med de respektive sub-faner
- Behold permission-checks (`canView`) for hver sub-fane som nu.

### Struktur (pseudo)
```text
┌─────────────────────────────────────┐
│ Annulleringer          [Kunde: ▼]   │
│ Valgt kunde: Eesy TM               │
├─────────────────────────────────────┤
│ [ Manuel kontrol ] [ Auto kontrol ] │  ← niveau 1
├─────────────────────────────────────┤
│ [ Upload | Godkendelse | Godkendte  │  ← niveau 2
│   | Tidligere uploads ]             │
├─────────────────────────────────────┤
│ (indhold)                           │
└─────────────────────────────────────┘
```

