

# Rival-afstandsbar: Vis afstand til spilleren over og under dig

## Idé
Erstat den nuværende tekstlinje ("📊 Næste plads: 2.250 kr foran dig") med en visuel bar der viser begge rivaler:

```text
← 1.200 kr bag dig   ████████████████████   3.400 kr foran dig →
   (spilleren under)        (din position)      (spilleren over)
```

- **Venstre side**: Hvor meget spilleren bagved (under dig) mangler for at indhente dig — din buffer
- **Højre side**: Hvor meget du mangler for at overhale spilleren foran dig
- Baren viser din relative position mellem de to rivaler
- Tal formateres i dansk format med "kr"

## Teknisk

### Udvid `rivalInfo` useMemo
Beregn også afstanden til spilleren *under* dig (index + 1 i standings). Returnér begge gaps som tal.

### Erstat tekstblokken med en visuel komponent
En lille custom bar med:
- Venstre label: buffer til spilleren under (grøn tekst, Shield-ikon)
- Højre label: afstand til spilleren over (amber/rød tekst, pil-op ikon)
- Midter-markør der viser din position proportionelt mellem de to

### Fil der ændres
**`src/components/league/MyQualificationStatus.tsx`** — udvid rivalInfo-beregning + erstat rival-sektionen (linje 153-160) med den nye bar.

