# Duplikér kontraktskabelon

## Hvad du får
En ny knap (kopi-ikon) på hvert skabelonkort ved siden af blyanten. Når du trykker, åbnes det normale skabelonvindue udfyldt med en kopi:
- Navn: "<originalnavn> (kopi)"
- Samme type, beskrivelse og indhold
- Du kan rette det, før du trykker Gem. Først ved Gem oprettes en ny, selvstændig skabelon (version 1).

Originalen og allerede sendte kontrakter røres ikke.

## Fortrolighed
Kopien starter som ikke-fortrolig (samme som "Ny skabelon" i dag). Du kan markere den fortrolig bagefter med låse-knappen.

## Teknisk
- Kun `src/pages/Contracts.tsx`: ny `handleDuplicateTemplate(template)` der sætter `editingTemplate=null` og fylder `templateForm`, åbner eksisterende dialog; genbruger `saveTemplateMutation` (insert-grenen). `Copy`-ikon fra lucide, `title="Duplikér"`.
- Ingen DB-, RLS-, migrations- eller rettighedsændringer; indsættelse går gennem eksisterende regler for skabeloner.
