# Eesy FM afvigelser — landingpage

Fylder den tomme side ud med en overskrift og en tab-række i samme stil som annulleringssiden.

## Sådan ser det ud

```text
Afstem automatisk salg
[ Upload | Oversigt | Rådata ]

<tomt indhold pr. fane — bygges bagefter>
```

- Overskrift: "Afstem automatisk salg" med kort undertekst.
- Tab-række: "Upload", "Oversigt", "Rådata" — samme visuelle stil som rækken på det vedhæftede billede (shadcn `Tabs`/`TabsList`).
- Hver fane får indtil videre en tom placeholder-boks med teksten "Indhold tilføjes her".
- Adgangen er uændret: kun de to godkendte mails kan se og åbne siden.

## Teknisk

- Kun `src/pages/vagt-flow/EesyFmDeviations.tsx` ændres.
- Tilføj `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` fra `@/components/ui/tabs`; default-fane `upload`.
- Ingen datahentning, ingen DB-, RLS- eller pricing-ændringer. Grøn zone.
