## Ændring

I `src/components/dashboard/RelatelProductsBoard.tsx` strammes `categorizeProduct` så **Switch** kun tæller produkter hvis navn matcher én af:

- `contact center`
- `professionel omstilling` (også `professional` for at fange engelske varianter? → **nej, fjernes** for at undgå støj)
- `unlimited`
- `omstilling til brugere`

Resten (datakort, mbb, fri tale, generiske "switch"-tekster der ikke er i listen ovenfor) tælles ikke under Switch.

### Teknisk

```ts
if (lower.includes("contact center")) return "switch";
if (lower.includes("professionel omstilling")) return "switch";
if (lower.includes("unlimited")) return "switch";
if (lower.includes("omstilling til brugere")) return "switch";
```

Mobile Voice (Fri Tale) og Mobilt Bredbånd (MBB) rør ikke.

### Spørgsmål før build

Skal `professional` (engelsk) også matche, eller kun den danske `professionel omstilling`? Default i planen: **kun dansk**.
