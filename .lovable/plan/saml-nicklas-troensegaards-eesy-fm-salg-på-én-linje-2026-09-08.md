# Saml Nicklas Troensegaards Eesy FM-salg på én linje

## Hvad jeg har fundet (bekræftet i data)

Der findes kun **én** medarbejder: Nicklas Troensegaard (`91bfe50a-…`, arbejdsmail `Nitr@copenhagensales.dk`). Der er altså ikke to brugere — de to linjer på boardet er samme person, fordi 27 af hans salg mangler mail på selve salget:

| Linje på boardet | Mail på salget | Salg | Provision |
| --- | --- | --- | --- |
| Nicklas T. (nr. 14) | `nitr@copenhagensales.dk` | 48 | 19.690 kr. |
| Nicklas T. (nr. 17) | tom | 27 | 9.115 kr. |
| **Samlet** | | **75** | **28.805 kr.** |

De 27 salg uden mail er tast-selv-salg på Eesy FM fra 17.–21. august. Efter 21. august får hans salg automatisk mailen på. Årsagen er, at automatikken kopierer arbejdsmailen fra medarbejderkortet ned på salget ved oprettelse — de 27 salg blev oprettet før hans arbejdsmail var udfyldt, og de blev derfor stående uden mail.

## Hvad jeg gør

Sætter mail og navn på de 27 salg, så de tilhører samme sælger som resten:

- Kun salg hvor sælgeren allerede er registreret som Nicklas Troensegaard (`fm_seller_id`) og mailen er tom.
- Mail sættes til `nitr@copenhagensales.dk` (samme skrivemåde som hans øvrige salg) og navn til "Nicklas Troensegaard".
- Ingen ændring i antal salg, produkter, priser, provision eller omsætning — beløbene flyttes blot ind under samme navn.

Resultat: Nicklas står som **én** linje med 75 salg og 28.805 kr. i provision i lønperioden på boards, dagsrapporter og løn.

## Til orientering (gør jeg ikke uden dit ja)

Der ligger yderligere 2 Eesy FM-salg (750 kr.) fra en anden sælger uden mail, som har samme problem. Sig til, hvis de også skal rettes.

## Teknisk

- Ren data-opdatering via `run_sql` på `sales.agent_email` / `sales.agent_name`, afgrænset til `source = 'fieldmarketing'`, `agent_email IS NULL` og `raw_payload->>'fm_seller_id' = '91bfe50a-e54f-4bb3-a3ff-4dbe5e31720c'` (27 rækker).
- `sale_items` (mapped_commission/revenue), pricing, `commission_transactions` og lønberegning røres ikke. Ingen migration, ingen kodeændring.
- Kontrol efter kørsel: verificér 0 resterende rækker for sælgeren uden mail, og at summen for `nitr@copenhagensales.dk` i perioden 15/8–14/9 er 75 salg / 28.805 kr.
