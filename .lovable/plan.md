

## Fjern "Auto-fordel kampagner"-funktionen

### Hvad fjernes
1. **State**: `defaultClientId` og `handleDefaultClientChange` (inkl. localStorage)
2. **Mutation**: Hele `autoAssignCampaigns` useMutation-blokken (linje ~1760-1833)
3. **UI**: Standard kunde-dropdown (`Select`) og "Auto-fordel kampagner"-knappen (linje ~2593-2618)

### Fil
`src/pages/MgTest.tsx` — tre sletninger, ingen nye filer.

### Hvad bevares
- "Foreslå kunder"-knappen og `CampaignSuggestionDialog` (den intelligente forslags-engine) forbliver intakt
- Al anden kampagne-mapping funktionalitet uændret

