

## Udfyld placeholders i InternalProcesses.tsx

### 3 placeholders → konkret indhold

**1. Kundedata slettefrist (linje 117)**
- Erstat `[indsæt intern frist]` med den detaljerede tekst du angav: "90 dage som udgangspunkt, med mulighed for forlængelse ved erhvervskampagner med sene annulleringer/efterreguleringer, revurderes løbende."

**2. Sikkerhedshændelser kontakt (linje 198)**
- Erstat `[indsæt funktion eller mail]` med dynamisk visning af ejerens email (samme `OwnerEmail`-komponent som brugt i EmployeePrivacy).

**3. Review-frekvens (linje 216)**
- Erstat `[indsæt frekvens]` med "kvartalsvist" — matcher det ugentlige compliance-cron der allerede tjekker, og kvartalsvis review er standard for intern governance.

### Fil
| Fil | Handling |
|-----|---------|
| `src/pages/compliance/InternalProcesses.tsx` | Udfyld alle 3 placeholders, tilføj OwnerEmail-komponent med dynamisk ejer-email |

