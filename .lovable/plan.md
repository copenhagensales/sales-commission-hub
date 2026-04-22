

## Pilot: flyt sætning til "nummervalg"-blokken

### Ændring (kun `src/pages/TdcOpsummering.tsx`, Pilot-grenen ~linje 142-160)

Sætningen `"Vi har snakket om, at det som udgangspunkt er"` flyttes fra welcome call-afsnittet ned, så den står som indledning til nummervalgs-teksten.

**Før (linje 142):**
```
"Inden for 7 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning. Vi har snakket om, at det som udgangspunkt er"
```

**Efter:**
- Linje 142: `"Inden for 7 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning."`
- Indsæt sætningen `"Vi har snakket om, at det som udgangspunkt er"` som første linje i hver af de tre `numberChoice`-grene (existing / mixed / new), umiddelbart før selve valgs-teksten — uden tom linje imellem, så de to linjer fremstår som ét sammenhængende afsnit.

### Gælder
- Pilot-varianten, alle tre nummervalg (`existing`, `mixed`, `new`).

### Ikke berørt
- Standard, Kun 5g fri salg, øvrig logik, font/tema.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

