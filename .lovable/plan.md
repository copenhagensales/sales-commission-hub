

## Plan: Erstat "Kvittering" med "Status" i instruktionsloggen

Da mailen ikke har en kvitteringsmekanisme (modtageren kan ikke "kvittere"), ændres kolonnen fra "Kvittering: Ja/Afventer" til "Status: Afsendt" som blot bekræfter at mailen er sendt.

### Ændringer

**`src/pages/compliance/AiGovernance.tsx`:**
- Omdøb tabelkolonnen "Kvittering" → "Status"
- Erstat den betingede Ja/Afventer-badge med en enkelt "Afsendt"-badge (grøn med checkmark) for alle rækker der er oprettet via email-metoden
- For manuelt registrerede: vis "Registreret"

Én fil, minimal ændring.

