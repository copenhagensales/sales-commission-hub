# Hilsenen på loginsiden: rigtigt dansk og med et smil

## Hvad der er galt
Overskriften sættes sammen af en hilsen efter klokken + fast tekst "til dig". Om natten bliver det "God nat til dig", og det er ikke dansk talesprog - "godnat" siger man, når man går, ikke når man byder nogen velkommen. "God middag" og "God formiddag" bruges heller ikke naturligt.

## Ny formulering
Overskriften bliver hilsenen alene, uden "til dig", og teksten under skifter med tidspunktet, så der er lidt personlighed i den. Forslag:

- Før kl. 5: "Du er tidligt op" - "Storken sover stadig, men dine tal er klar."
- Kl. 5-10: "Godmorgen" - "Kaffen først, salget lige efter."
- Kl. 10-12: "Godmorgen" - "Dagen er ung, og tallene venter."
- Kl. 12-14: "Goddag" - "Frokosten er fortjent. Log ind og se dagen."
- Kl. 14-18: "Goddag" - "Sidste træk på dagen. Log ind og se, hvor du står."
- Kl. 18-22: "Godaften" - "Fyraften for de fleste, men aldrig for tallene."
- Efter kl. 22: "Du er sent på den" - "Storken er gået i seng. Dine tal er ikke."

Tonen er let og kollegial, ikke fjollet, og ingen af linjerne kommenterer på præstation.

## Teknisk
Kun `src/pages/Auth.tsx`: `greeting` udvides til at give både overskrift og underlinje, "{greeting} til dig" bliver til "{greeting}", og den faste "Log ind med din arbejdsmail for at fortsætte." erstattes af den tidsafhængige linje. Login, rettigheder og data røres ikke.
