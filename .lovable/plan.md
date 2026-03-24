

# Auto-apply config og skjul mapping-felter

## Problem
Når en kunde har en gemt opsætning, skal brugeren stadig manuelt vælge felter — selvom systemet allerede kender mappingen.

## Løsning
Når en default config findes for den valgte kunde, spring mapping-trinnet over og gå direkte til matching efter filupload. Vis kun en kort opsummering af den anvendte config.

| Fil | Ændring |
|-----|---------|
| `UploadCancellationsTab.tsx` | Efter filupload (`onDrop`): hvis der er en default config, anvend den og kør `handleMatch` automatisk — spring `mapping`-trinnet over. Behold mapping-trinnet som fallback kun hvis der **ikke** er en gemt config for kunden. Tilføj en "Rediger mapping" knap i preview/matching-stedet så brugeren kan gå tilbage ved behov. |

## Konkret flow

1. **Fil uploades** → `onDrop` sætter `parsedData` og `columns`
2. **Check**: Har kunden en default config?
   - **Ja**: `applyConfig(defaultConfig)` → kald `handleMatch()` direkte → gå til `preview`
   - **Nej**: Gå til `mapping` (nuværende flow)
3. I mapping-trinnet: skjul alle felterne bag en collapsible/accordion hvis config er loaded — vis kun upload-type, filter-info og en "Rediger" link

## Implementeringsdetaljer
- I `onDrop` callback: efter `setParsedData`/`setColumns`, check `clientConfigs` for default. Hvis fundet, sæt step til en ny intern "auto-matching" state og trigger `handleMatch`.
- Fordi `clientConfigs` kan loade asynkront: brug en `useEffect` der lytter på `parsedData + clientConfigs` — når begge er klar og config er default, auto-match.
- Tilføj en lille info-banner i preview: "Bruger opsætning: [config-name] for [client]" med en "Rediger mapping" knap.

