# Fiberleadprovision på Relatel-boardet

## Årsag
Da fibertælleren blev lavet til Relatel, blev det besluttet, at fiberleads ikke må påvirke boardets provision (`ClientDashboard.tsx`, `mergeFiber`: `commission: isRelatelFiber ? 0 : f.commission`). Relatel-toplisten henter desuden kun provision fra Relatel-kampagner, og leadet ligger på en TDC Erhverv-kampagne. Derfor står Sean med 0 kr. i dag. Det samme gælder hans uge og lønperiode: de 625 kr. er ikke med.

## Ændring (kun boardvisning)
- På Relatel-boardet lægges fiberleadprovisionen (den, der allerede tælles som fiber på boardet) til sælgerens provision i Top i dag, uge og lønperiode.
- Det gælder både sælgere, der kun har et fiberlead, og sælgere, der også har almindelige salg.
- Afviste/slettede leads og leads fra før sælgeren kom på Relatel tæller stadig ikke med, ligesom i dag.
- Fiberleads tæller stadig ikke som salg.

Seans tal bliver dermed 625 kr. i dag, og hans uge- og lønperiodetal stiger med 625 kr.

Ingen ændring af provision, løn, salg, dagsrapporter, TDC-boardet eller databasen.

## Kontrol
- Relatel-boardet: Sean viser 625 kr. i Top i dag, og uge/lønperiode er hævet med 625 kr.
- TDC-boardet er uændret.
