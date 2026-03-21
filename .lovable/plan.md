

# Fix: Standard-år skal være 2026 + ASE-faktura synlighed

## Problem
1. **År er sat til 2025 som standard** — men de fleste posteringer (inkl. ASE faktura 955) er fra 2026
2. ASE faktura 955 har `dato: 2026-03-01` → med -1 måned-logik = **februar 2026** — den er der, men skjult bag forkert årsfilter

## Løsning

### Ændring i `src/pages/economic/EconomicRevenueMatch.tsx`
- Sæt `year` default til **2026** (eller `new Date().getFullYear()` for dynamisk)
- Linje 152: `const [year, setYear] = useState(2025)` → `useState(new Date().getFullYear())`

Det er en 1-linje fix. ASE faktura 955 (448.200 DKK) vil derefter vises korrekt i februar 2026.

