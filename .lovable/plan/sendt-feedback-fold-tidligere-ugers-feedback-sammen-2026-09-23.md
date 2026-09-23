# Sendt feedback: fold tidligere ugers feedback sammen

## Hvorfor der står "mangler 1-1 session"

Det er ikke en fejl. Feedbacken på Jasper er sendt i **uge 38**, og i dag er det onsdag i **uge 39**. Kravet om én 1-1 session gælder pr. uge og nulstilles hver mandag, så uge 39 står tom indtil der holdes en session denne uge.

Problemet er visningen: den sendte feedback fra sidste uge ligger åben og fylder hele kortet, så det ser ud som om der lige er sendt feedback — mens advarslen ovenover siger det modsatte.

## Hvad der ændres

1. **Feedback fra denne uge** vises som i dag: åben, med hele teksten.
2. **Feedback fra tidligere uger** foldes sammen til én linje man kan klikke på, fx:
   `1-1 samtale · uge 38 (sidste uge) · Af Sebastian Viktor Bangsbo Petersen` med en pil.
   Klik åbner teksten. Uger længere tilbage står som "uge 36 (3 uger siden)".
3. Over listen står en kort linje der gør status tydelig, fx **"Ingen feedback sendt i uge 39 — seneste er fra uge 38"**, så man ikke skal gætte.
4. Advarslen øverst ("Ugens 1-1 session mangler i uge 39") strammes op, så ugenummeret ikke længere brydes ned på næste linje.

Samme opførsel i begge sektioner — opstart (dag 1-40) og hele holdet.

## Teknisk

- Kun `src/pages/onboarding/RampTeam.tsx`. Ingen ændring i database, RPC'er, mail, adgange, norm, risikoflag eller løn/provision.
- Ny lille komponent `FeedbackLogList({ member, d })` der erstatter de to næsten identiske blokke i `MemberCard` (linje 667-695) og i `FullTeamMemberCard` (samme mønster ved linje ~885). Den bruger `isoWeekOf(a.performed_at)` som i dag og sammenligner mod `member.iso_year`/`member.iso_week` for at afgøre om posten hører til den aktuelle uge.
- Sammenfoldning via lokal `useState<number | null>` for hvilken tidligere post der er åben (ingen ny afhængighed, ingen `<Accordion>` nødvendig). Poster fra aktuel uge er altid åbne.
- Ugeteksten beregnes af forskellen i `iso_year * 100 + iso_week` mod medlemmets aktuelle uge: 1 → "sidste uge", n → "n uger siden".
- Overskriftslinjen i advarslen får `text-wrap: balance` og `whitespace-normal` på samme måde som de øvrige tekster på kortet.
- Verifikation: typecheck plus browserkontrol af `/opstartshold` — Jaspers kort skal vise uge 38-feedbacken som én sammenfoldet linje, og advarslen skal stå på én pæn linje.
