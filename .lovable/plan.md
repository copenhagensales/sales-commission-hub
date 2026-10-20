# OPP 39955083 – Matias Heller Frederiksen

## Hvad jeg har fundet (bekræftet, intet ændret)

- I Stork findes **kun ét salg** med OPP 39955083: fredag 16/10 kl. 15:57, "Lukket salg VOK (Inkl. Mobilevoice salg)" x1, 850 kr. provision, 1.750 kr. omsætning, koblet til Matias og TDC Erhverv.
- Det salg opfylder alle filtre i Dagsrapporter og i "TDC Erhverv - Ret salg" og bør vises, når **16/10** vælges.
- Matias' salg registreret i dag (20/10) har andre OPP-numre: 29686300 (VOK), 45310531 (HAP) og 37788511 (HAP). Ingen af dem er fiber inkl. Mobilevoice med OPP 39955083.
- Der er altså **intet salg i dag med OPP 39955083** i Stork. Dagens salg på samme CVR er enten registreret med et andet OPP-nummer, eller er ikke kommet ind i Stork endnu.

## Næste skridt (read-only, ingen ændringer)

1. Afklar hvor "under salg" viser dagens salg: Salg-siden i Stork, eller i dialeren (Adversus).
2. Hvis det er i Adversus: tjek om dagens salg er hentet ind (synk-log for TDC Erhverv-kampagnen i dag), og hvorfor ikke.
3. Hvis det er i Stork: find salget ud fra tidspunkt og produkt og se hvilket OPP og hvilken dato det har.
4. Rapportér årsagen. Rettelser (fx genhentning eller rettelse af OPP) laves kun efter godkendelse.

## Teknisk

- Salgsrække `0acb6cd5…` (16/10), `client_campaign_id` = TDC Erhverv Products, `source` Lovablecph, OPP i `raw_payload.leadResultFields["OPP nr"]`.
- `useTdcErhvervSales` filtrerer på klient-id og valgt dag; Dagsrapporter på `agent_email` og `sale_datetime` (ekskl. fieldmarketing). Begge matcher salget på 16/10.
