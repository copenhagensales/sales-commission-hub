# Ny tekst til "Ny Implementering"

Ændringerne gælder kun for fanen "Ny Implementering". Standard, Pilot og Kun 5G fri salg bliver ikke ændret.

## 1. Numre og simkort
For "Ny Implementering" fjernes:
- "Snarest muligt vil i blive kontaktet af min kollega …"
- "Vi har snakket om, at det som udgangspunkt er / (antal) eksisterende numre … / Hvilke numre i ønsker …" (alle tre varianter, uanset valg af numre)

De erstattes af:
- "Min kollega kommer til at kontakte jer for at byde jer velkommen, så vi kan få sat jeres nye løsning op. Før min kollega kan starte jeres løsning er der brug for vi får oplyst de numre der skal indgå i aftalen og deres tilhørende simkortsnumre. Vi har aftalt, at det som udgangspunkt er følgende numre der skal indgå i aftalen:"
- "[Eksisterende numre & evt nye numre. Hvis i ikke har nummer, sig til kunden de skal udfylde nummer også]" står med rødt som vejledning til sælgeren, ligesom de andre pladsholdere.
- "Jeg sender dig snarest muligt en mail. På denne mail fremgår de numre vi har aftalt, samt en guide til hvordan du skal finde simkortsnumrene. Det er meget vigtigt du kigger på denne mail, da det sikre en smidig process, hvis du kan finde dem klar til os inden min kollega ringer til dig"

Resten bliver som i Pilot: teksten om opsigelse og teksten om opstart ved udløb af binding.

## 2. Omstilling (kun ved standardomstilling)
Der kommer et nyt valg i formularen, som kun vises under "Ny Implementering" med standardomstilling: **"Har kunden menuvalg i dag?" (Ja/Nej)**.
- Den første linje bliver ved med at være "I forhold til jeres omstilling og hvordan den skal virke …".
- Ja: "Som aftalt, så har du med denne omstilling mulighed for at have ét nul-valg, hvis du i fremtiden for brug får flere menuvalg, er det muligt at tilkøbe."
- Nej: "Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe."
- Hvis der ikke er valgt noget, vises Nej-teksten, så resultatet er det samme som i dag.

## Engelsk version
De nye tekster får også en engelsk oversættelse. Jeg skriver et udkast, som I gerne må rette.

## Tekniske detaljer
- `generateSummary.ts`: tilføj `isImplementering` inde i `isPilot`-grenene og tilføj nye nøgler til oversættelserne. Tilføj en ny parameter `hasMenuToday?: boolean`.
- `TdcOpsummeringForm.tsx`: tilføj state og et Ja/Nej-valg, der kun vises ved `implementering` og standardomstilling.
- Kun præsentation. Ingen ændringer i databasen eller i data.
