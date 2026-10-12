# Gør "Sæson 5"-titlen guldfarvet

Titlen bruger i dag en guld-farveovergang. Siden har et tema, der fjerner alle farveovergange, og derfor bliver teksten gennemsigtig og har samme farve som baggrunden. Titlen skal i stedet have en ensfarvet guldfarve.

## Ændring
- `src/index.css` (grøn zone): Tilføj et nyt guld-farvetoken (`--league-gold`) og en lille klasse `.league-title-gold` med guldfarve. Klassen skal gælde inden for Superliga-temaet, så temaet ikke overskriver farven.
- `src/pages/CommissionLeague.tsx` linje 480: Fjern overgangs- og gennemsigtighedsklasserne fra titlen og brug `league-title-gold` i stedet.
- Pokalikonet og resten af siden forbliver uændret. Data og beregninger berøres ikke.
