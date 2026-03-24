

# Bloker upload uden gemt opsætning

## Problem
Brugeren skal ikke kunne uploade filer hvis kunden ikke har en gemt opsætning (`cancellation_upload_configs`). Mapping-stedet skal fjernes helt.

## Ændringer

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

1. **Step 2 (upload)**: Hvis `clientConfigs.length === 0`, vis en blokerings-besked i stedet for dropzone: "Denne kunde har ingen gemt opsætning. Kontakt en administrator for at oprette en." med et `AlertCircle`-ikon. Ingen fil-upload mulig.
2. **Fjern mapping-step helt**: Slet hele `step === "mapping"` blokken (linje ~802-950+). Fjern `"mapping"` fra `WizardStep` type. Fjern alle `setStep("mapping")` kald.
3. **Auto-match flow**: Når fil uploades og der **er** en default config, kør auto-match direkte og gå til preview. Ingen fallback til mapping.
4. **Ryd op**: Fjern ubrugte config-selector og manuelle kolonne-selects da de ikke længere er relevante.

## Resultat
- Kunde med gemt config → upload → auto-match → preview → send
- Kunde uden config → besked om at config mangler, upload blokeret

