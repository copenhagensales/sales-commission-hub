


# 4-trins wizard for Upload/Match

## Implementeret

Upload-fanen er redesignet til en 4-trins wizard:

1. **Vælg type** — Annullering eller Kurv difference (to store kort)
2. **Upload fil** — Drag-and-drop. Auto-matcher hvis gemt config findes.
3. **Forhåndsvisning** — Tabel med matchede salg + umatchede rækker-tæller. "Rediger mapping" link.
4. **Sendt** — Bekræftelse med "Upload ny fil" knap.

Stepper-indikator øverst viser progression. Mapping-step bevaret som fallback for kunder uden gemt opsætning.
