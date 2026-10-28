# Udfyld J, K, P og Q i Eesy TM-annulleringsarket

## Hvad der laves
Arket har 59 sælgerrækker (række 6–65). For hver sælger udfylder jeg kun kolonne J, K, P og Q med tal fra Stork. Alt andet bliver som det er, også formlerne.

- **J – MV Stork:** antal mobilevoice-produkter solgt (alle "Fri tale ..."-produkter)
- **K – 5G Stork:** antal 5G/MBB-produkter solgt (alle "5GI ..."-produkter, f.eks. "5GI MBB")
- **P – Gnmst. provi per MV:** sælgerens samlede provision på MV ÷ antal MV
- **Q – Gnmst. provi per 5G:** samme regnestykke for 5G/MBB

## Afgrænsning
- Kunde: Eesy TM
- Periode: salg fra 15/9 til 14/10 2026 (dansk tid), samme periode som arket
- Provision: den provision, Stork har givet hvert produkt, før annulleringer trækkes (arket regner selv annulleringerne)
- Produkter, der ikke er aktive mere, tæller med, hvis de er solgt i perioden

## Sådan matches sælgerne
Navnet i kolonne A matches med sælgerens medarbejderkort og dialer-navn i Stork. Hvis et navn ikke kan matches, eller matcher to personer, lader jeg cellerne være tomme og lister navnet til dig bagefter. Sælgere uden salg af en type får 0, og gennemsnittet bliver tomt i stedet for en fejl.

## Levering
- En ny fil: `TM_annulleringer_15-9_til_14-10_udfyldt.xlsx`. Din originale fil røres ikke.
- Jeg genberegner arket og tjekker, at ingen formler giver fejl.
- Der ændres intet i Stork.

## Tekniske detaljer
- Kilde: `sale_items.mapped_commission` og antal pr. produkt via `sales` → `client_campaigns` → `clients` (Eesy TM), attribution via `employee_agent_mapping`/agent-mail.
- Skrives med paper-xlsx i preserve mode; kun værdier i J6:K65 og P6:Q65.
