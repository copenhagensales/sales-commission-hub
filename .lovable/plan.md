## Ændring
I `src/lib/tdcOpsummering/generateSummary.ts` erstattes den eksisterende sætning i pilot-grenen (linje 164) med ny længere tekst. Bruges allerede kun når `summaryVariant === "pilot"`, så afgrænsning til TDC Opsummering → Pilot er sikret. Vises før alle valgfrie sektioner — uændret placering.

### Konkret
- **Linje 48–49** (TRANSLATIONS-map): den gamle dansk→engelsk-mapping erstattes med ny dansk nøgle → ny engelsk oversættelse.
- **Linje 164**: `t("...gammel tekst...")` erstattes med `t("...ny tekst...")`. Teksten pushes som én `SummaryLine` med `\n\n` mellem de to afsnit, så den vises som én sammenhængende blok med afsnitsskift.

### Ny dansk tekst
> Snarest muligt vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning. Det vi skal bruge fra jer, er simkortnumrene på de numre der skal flyttes. Hvis I har mulighed for at finde dem frem inden velkomstkaldet er det en stor hjælp.
>
> Vi har kun mulighed for at opsige de numre vi flytter over. Hvis I har produkter ved siden af, som f.eks. internet eller produkter uden et nummer tilkoblet vil i selv skulle opsige disse.

### Ny engelsk oversættelse
> As soon as possible, you will be contacted by my colleague, who will welcome you and help with the number transfer. What we need from you are the SIM card numbers for the numbers being transferred. If you're able to find these before the welcome call, it's a great help.
>
> We are only able to cancel the numbers we transfer over. If you have other products on the side, such as internet or products without a number attached, you will need to cancel these yourselves.

### Ikke berørt
Standard- og 5g-fri-varianter, øvrige sektioner, komponenter og UI.