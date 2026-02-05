

# Opsætning af Frontend Test Konfiguration

## Problem
Projektet har unit tests i `src/lib/calculations/` men mangler den nødvendige infrastruktur til at køre dem:

- ❌ Ingen `vitest.config.ts` konfigurationsfil
- ❌ Ingen `test` script i `package.json`
- ❌ Ingen `src/test/setup.ts` setup fil
- ❌ `tsconfig.app.json` mangler `vitest/globals` types

## Løsning

### Step 1: Opret vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### Step 2: Opret src/test/setup.ts
```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
```

### Step 3: Tilføj test script til package.json
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### Step 4: Opdater tsconfig.app.json
Tilføj `"vitest/globals"` til `types` array i `compilerOptions`.

### Step 5: Tilføj test dependencies (devDependencies)
```json
"@testing-library/jest-dom": "^6.6.0",
"@testing-library/react": "^16.0.0",
"jsdom": "^20.0.3"
```

---

## Eksisterende Tests der vil blive kørt

| Fil | Antal Tests | Beskrivelse |
|-----|-------------|-------------|
| `hours.test.ts` | ~25 | Break-logik, shift-beregninger, timestamp parsing |
| `vacation-pay.test.ts` | ~11 | Feriepenge rates og beregninger |

---

## Forventet Resultat
Efter implementering kan tests køres med:
```bash
npm run test
```

Output:
```
✓ src/lib/calculations/hours.test.ts (25 tests)
✓ src/lib/calculations/vacation-pay.test.ts (11 tests)

Test Files  2 passed
Tests       36 passed
```

