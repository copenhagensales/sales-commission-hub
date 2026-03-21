

# Ny fane: Salgsvalidering (fakturerbar + annulleringskontrol)

## Koncept
En ny fane på `/economic/revenue-match` (eller som separat side) hvor du hver måned uploader kundens liste med:
- **Fakturerbare salg** (telefonnumre der kan faktureres)
- **Annullerede salg** (telefonnumre der skal trækkes)

Systemet matcher automatisk mod jeres interne salgsdata og producerer tre kategorier:

### Kategori 1: Matchede annulleringer → sælger identificeret
Annulleret telefonnummer fundet i jeres salg → viser sælgernavn, salgsdato, produkt. Klar til at markere som "trækkes fra sælger".

### Kategori 2: Umatchede annulleringer → advarsel
Annulleret telefonnummer findes IKKE i jeres salg → markeres med advarsel. Kan skyldes at salget er registreret med andet nummer, eller at det ikke er jeres.

### Kategori 3: Uverificerede salg → potentiel fejl
Jeres registrerede salg hvor telefonnummeret IKKE findes i kundens fakturerbare liste → markeres som "ikke bekræftet". Kan afsløre fiktive/fejlregistrerede salg.

## Smartere features
- **Telefonnummer-normalisering**: Bruger eksisterende `normalizePhoneNumber()` så `+45 52 51 28 53`, `52512853` og `004552512853` alle matcher
- **Historik**: Gemmer hver upload med resultater, så man kan se udvikling over tid
- **Opsummeringsvisning**: Dashboard med "X annulleringer matchet, Y umatchede, Z uverificerede salg"
- **Batch-handling**: Godkend alle matchede annulleringer på én gang (sætter `validation_status = 'cancelled'`)
- **Excel-export**: Download resultat som Excel med alle tre kategorier

## Teknisk plan

### 1. Ny DB-tabel: `sales_validation_uploads`
Gemmer upload-historik:
- `id`, `created_at`, `client_id`, `period_month` (YYYY-MM), `file_name`
- `total_billable`, `total_cancelled`, `matched_cancellations`, `unmatched_cancellations`, `unverified_sales`
- `uploaded_by` (employee_id), `status`, `results_json` (detaljeret match-data)

### 2. Ny komponent: `SalesValidationTab.tsx`
**Upload-flow:**
1. Vælg kunde + periode (måned)
2. Upload Excel-fil
3. Map kolonner: telefonnummer-kolonne, status-kolonne (fakturerbar/annulleret), evt. firma-kolonne
4. Systemet normaliserer alle telefonnumre og matcher mod `sales`-tabellen for den valgte kunde+periode
5. Vis resultater i tre sektioner med farve-kodning

**Matching-logik:**
```text
For hver annullering i filen:
  → Normaliser telefonnummer
  → Søg i sales WHERE customer_phone normaliseret = nummer 
    AND client matches AND periode matches
  → Fund? → Kategori 1 (sælger identificeret)
  → Ikke fundet? → Kategori 2 (uplacerbar annullering)

For hvert internt salg i perioden:
  → Er telefonnummer i kundens fakturerbare liste? 
  → Nej? → Kategori 3 (uverificeret salg)
```

### 3. Tilføj fane i EconomicLayout
Ny nav-item: `{ path: "/economic/sales-validation", label: "Salgsvalidering", icon: ShieldCheck }`

### 4. Route + permissions
Tilføj route i `config.tsx` med samme permission som revenue-match.

## Filer der oprettes/ændres

| Fil | Handling |
|-----|----------|
| `src/pages/economic/SalesValidation.tsx` | **Ny** — hovedkomponent med upload, mapping, matching, resultatvisning |
| `src/pages/economic/EconomicLayout.tsx` | Tilføj nav-item |
| `src/routes/config.tsx` | Tilføj route |
| `src/routes/pages.ts` | Tilføj lazy import |
| Migration | Ny tabel `sales_validation_uploads` |

## Resultat
- Du uploader kundens månedlige fil
- Ser straks hvilke annulleringer der rammer en sælger
- Ser hvilke annulleringer der ikke kan placeres
- Ser hvilke af jeres salg der IKKE er bekræftet af kunden
- Kan batch-godkende annulleringer og eksportere resultater

