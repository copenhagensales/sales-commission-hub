# Tryg - Ret salg: tydeligere Afvis/Godkendt + grå tjekboks

## Hvad ændres
Kun handlingskolonnen på hver salgslinje (visuelt):

- **Afvis**: fra svag ghost-knap til udfyldt rød knap (`destructive`), hvid tekst, tydelig kontrast.
- **Godkendt**: udfyldt grøn knap (emerald-token via samme utility-stil som resten af appen), hvid tekst.
- **Tjekboks**: dæmpet/grå — grå ramme og grå baggrund, så den træder i baggrunden i forhold til knapperne.

Ingen ændring i funktion, data, sletning eller adgang. Knapperne er stadig uden onClick.

## Teknisk
Fil: `src/pages/reports/TrygEditSales.tsx` (linje 414-443)
- Afvis: `variant="destructive"` + `size="sm" h-8 gap-1.5`.
- Godkendt: behold `Button` men med udfyldt grøn baggrund (`bg-emerald-600 text-white hover:bg-emerald-700`, dark-variant tilsvarende).
- Checkbox: tilføj `className="border-muted-foreground/40 data-[state=unchecked]:bg-muted"` så den fremstår grå.
- Kolonnebredden `w-64` bevares; `whitespace-nowrap` bevares.
