

# Redesign Upload/Match til 4-trins wizard

## Problem
Hele mapping-flowet vises som ét stort trin med mange felter. Brugeren vil have en klar step-by-step wizard.

## Nyt flow (4 steps)

| Step | Navn | Indhold |
|------|------|---------|
| 1. `type` | **Vælg type** | Annullering eller Kurv difference. Kun to store knapper/cards. "Næste" knap. |
| 2. `upload` | **Upload fil** | Drag-and-drop zone. Når fil er uploadet, vises filnavn + antal rækker. Hvis kunden har en default config, auto-apply den. "Næste" starter matching automatisk. |
| 3. `preview` | **Forhåndsvisning** | Viser matchede salg i tabel + antal umatchede rækker. Samme tabel som nu. "Rediger mapping" link for edge cases. |
| 4. `done` | **Sendt** | Bekræftelse. "Upload ny fil" knap. |

## Stepper UI
En visuel step-indikator øverst (1 → 2 → 3 → 4) med aktiv/færdig/kommende states.

## Implementeringsdetaljer

**Fil: `UploadCancellationsTab.tsx`**

1. Ændr `step` type til `"type" | "upload" | "preview" | "done"`
2. Default step = `"type"` (i stedet for `"upload"`)
3. **Step 1 (type)**: Vis to kort/knapper for Annullering og Kurv difference. Klik sætter `uploadType` og går til step 2.
4. **Step 2 (upload)**: Dropzone som nu. Når fil parses og der er en default config → auto-match og gå til step 3. Hvis ingen config → gå til `mapping` (beholdes som fallback, men skjult i normal flow).
5. **Step 3 (preview)**: Nuværende preview-tabel med "Send til godkendelseskø" knap. Viser også umatchede rækker-tæller.
6. **Step 4 (done)**: Nuværende done-card.
7. Beholde `mapping` step som fallback for kunder uden gemt config, men det er ikke et af de 4 primære steps i stepper-UI'et.
8. Tilføj en stepper-komponent øverst der viser progression: Type → Upload → Forhåndsvisning → Sendt.
9. "Tilbage" knapper på hvert step.

