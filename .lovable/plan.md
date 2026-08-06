# Eesy FM afvigelser (Leder) — tom side med begrænset adgang

Nyt menupunkt under Fieldmarketing, kun synligt og tilgængeligt for to specifikke brugere. Siden oprettes tom (kun overskrift), indhold prompter vi bagefter.

## Adgang

Fast allowlist på e-mail (case-insensitiv), gemt ét sted i koden:

- jepmunk@gmail.com
- wb@copenhagensales.dk

Adgangen håndhæves to steder:
- Menupunktet vises kun for disse mails.
- Ruten blokerer alle andre (redirect til /home), så direkte URL-adgang ikke virker.

Bemærk: en fast liste kræver en kodeændring, når nye personer skal have adgang. Vi kan senere flytte den til en permission-nøgle uden at røre siden.

## Sådan ser det ud

Under Fieldmarketing i sidemenuen, nederst efter "Ret salgsregistrering (Leder)":

```text
Fieldmarketing
  ...
  Ret salgsregistrering (Leder)
  Eesy FM afvigelser (Leder)      <- ny
```

Selve siden: overskrift "Eesy FM afvigelser (Leder)", kort undertekst, og en tom placeholder-boks.

## Teknisk

- Ny fil `src/config/eesyFmDeviationAccess.ts`: allowlist af mails + hjælpefunktion `hasEesyFmDeviationAccess(email)`.
- Ny hook-lignende brug af `useAuth()` til at slå brugerens mail op i allowlisten (ingen DB-kald).
- Ny side `src/pages/vagt-flow/EesyFmDeviations.tsx` i `VagtFlowLayout`, tom.
- `src/routes/pages.ts`: lazy-export `VagtEesyFmDeviations`.
- `src/routes/config.tsx`: rute `/vagt-flow/eesy-fm-deviations`, `access: "auth"`, med en lille guard-wrapper der redirecter brugere uden for allowlisten.
- `src/components/layout/AppSidebar.tsx`: nyt NavLink efter "Ret salgsregistrering (Leder)", betinget af allowlisten (mønster som de øvrige FM-punkter).

Ingen ændringer i pricing, løn, RLS eller DB-skema. Grøn zone (navigation + ny tom side).
