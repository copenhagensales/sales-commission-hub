

# Igangværende uploads + blokering af nyt upload + tæller på sub-faner

## Overblik
Tre sammenhængende ændringer:
1. Uploads med pending/ubehandlede køelementer vises i Godkendelseskøen som "igangværende" — flyttes først til "Afsluttede uploads" (omdøbt fra "Tidligere uploads") når alle rækker er behandlet.
2. Sub-fane labels i Godkendelseskøen viser antal ventende rækker: `Annulleringer (17)`, `Kurv-rettelser (3)`, `Afventer (5)`, `Fejl i match (15)`.
3. Upload-fanen blokerer nyt upload hvis der allerede er en igangværende import for kunden.

---

## 1. Omdøb "Tidligere uploads" → "Afsluttede uploads"

**`Cancellations.tsx`** linje 53:
- Ændre label fra `'Tidligere uploads'` til `'Afsluttede uploads'`.

---

## 2. Filtrer CancellationHistoryTable til kun afsluttede

**`CancellationHistoryTable.tsx`**:
- Omdøb titel/description til "Afsluttede uploads".
- Kun vis imports hvor **alle** tilknyttede `cancellation_queue` items har status !== `'pending'` (dvs. alle er approved/rejected), ELLER imports uden nogen queue items overhovedet.
- Logik: efter fetch af imports, hent alle `cancellation_queue` items med `status = 'pending'` for disse import_ids. Filtrer imports der har pending items fra.

---

## 3. Vis igangværende upload i Godkendelseskøen

**`ApprovalQueueTab.tsx`**:
- Tilføj en query der henter `cancellation_imports` for `clientId` som har mindst ét `cancellation_queue` item med `status = 'pending'`.
- Vis øverst i komponenten et info-kort med filnavn, upload-dato, og link/indikator for den igangværende import.
- Vis en opsummering: "X rækker afventer behandling".

---

## 4. Tæller på alle sub-faner

**`ApprovalQueueTab.tsx`**:
- **Annulleringer** og **Kurv-rettelser**: allerede har `cancellationCount` og `basketCount` — disse vises allerede med `(N)`.
- **Afventer (UnmatchedTab)**: Tilføj en separat count-query der tæller pending sales ikke i køen for clientId. Alternativt: lave en letvægts-query i `ApprovalQueueTab` der henter count fra `UnmatchedTab`-logikken.
  - Simplest: hent count af sales med `validation_status = 'pending'` for klientens kampagner der IKKE er i `cancellation_queue`.
- **Fejl i match**: Tilføj count-query: `cancellation_imports` med `unmatched_rows IS NOT NULL` + `client_id = clientId` → sum af array-længder.
  - Hent via en separat query: select imports med unmatched_rows, tæl total rows.

Vis counts i TabsTrigger labels:
```
Annulleringer (17)    Kurv-rettelser (3)    Afventer (5)    Fejl i match (15)
```

---

## 5. Bloker nyt upload hvis igangværende

**`UploadCancellationsTab.tsx`**:
- Tilføj query: tjek om der findes en `cancellation_imports` for `clientId` som har mindst ét `cancellation_queue` item med `status = 'pending'`.
- Hvis ja: vis besked i upload-området ("Der er allerede en igangværende upload for denne kunde. Behandl den først i Godkendelseskøen.") og deaktiver dropzone.
- Query:
```typescript
const { data: activeImport } = useQuery({
  queryKey: ["active-import", clientId],
  queryFn: async () => {
    const { data } = await supabase
      .from("cancellation_imports")
      .select("id, file_name")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (!data?.length) return null;
    const { data: pending } = await supabase
      .from("cancellation_queue")
      .select("import_id")
      .in("import_id", data.map(d => d.id))
      .eq("status", "pending")
      .limit(1);
    if (pending?.length) {
      const imp = data.find(d => d.id === pending[0].import_id);
      return imp || null;
    }
    return null;
  },
});
```
- Når `activeImport` er truthy → vis blokering i stedet for dropzone.

---

## Filer der ændres
1. **`src/pages/salary/Cancellations.tsx`** — omdøb label
2. **`src/components/cancellations/CancellationHistoryTable.tsx`** — filtrer til kun afsluttede, omdøb titler
3. **`src/components/cancellations/ApprovalQueueTab.tsx`** — vis igangværende import-kort, tilføj counts for Afventer og Fejl i match faner
4. **`src/components/cancellations/UploadCancellationsTab.tsx`** — bloker nyt upload ved aktiv import

