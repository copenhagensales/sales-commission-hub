

# Flyt "Specialsalg / 5G Fri" op under Opsummeringstype

## Ændring
Flyt hele "Specialsalg"-blokken (linje 528-546) fra bunden af "Valgfrie sektioner"-kortet op i "Opsummeringstype"-kortet, lige under RadioGroup-toglen (efter linje 306).

**Fil: `src/pages/TdcOpsummering.tsx`**
1. Fjern `<Separator />` + Specialsalg-blokken (linje 528-546) fra sin nuværende position
2. Indsæt den i Opsummeringstype-kortets `<CardContent>`, efter RadioGroup (linje 306), med en `<Separator />` imellem

