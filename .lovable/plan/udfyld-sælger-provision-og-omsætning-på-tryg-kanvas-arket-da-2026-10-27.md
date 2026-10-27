# Udfyld sælger, provision og omsætning på Tryg Kanvas-arket (data_8.xlsx)

Ren læsning i Stork. Ingen ændringer i app, database eller løndata. Den uploadede fil røres ikke; resultatet gemmes som ny fil.

## Arket
- Fanen "Export", 243 rækker: Privat Mødebook Kanvas, bookingmåned 09, med totalrækker pr. årsag.
- 175 rækker har et telefonnummer i kolonne D. Kun de udfyldes; totalrækker forbliver uændrede.

## Fremgangsmåde
1. Telefonnumre normaliseres på begge sider (kun cifre, uden +45/0045), sammenlignes på 8 cifre.
2. Match mod Storks Tryg-salg (kundetelefon, med fallback til telefonnummeret i salgets rådata).
3. Ny kolonne **Sælger** indsættes mellem E (Bookede møder) og F (Salgshitrate). Navn tages fra medarbejderdata via sælgerens agent-kobling (samme kæde som øvrige rapporter), med fulde navn som i Stork.
4. To nye kolonner **Provision** og **Omsætning** til højre: sum af Storks beregnede provision og omsætning for salget. Afviste salg tælles ikke.
5. Har et nummer flere Tryg-salg, laves én række pr. salg lige under den oprindelige (samme øvrige værdier), så intet skjules.
6. Intet match: "Ikke fundet i Stork" i Sælger, tom provision/omsætning (ikke 0), rækken markeres gul. Findes nummeret kun på en anden kunde, noteres det.
7. Totalrække nederst for provision og omsætning med formler.

## Leverance
- `/mnt/documents/data_8_udfyldt.xlsx`
- I chatten: antal fundne/ikke-fundne numre, ekstra rækker og samlede beløb (uden navne eller numre).
