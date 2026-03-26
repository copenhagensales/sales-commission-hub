

## Tilføj hjælpetekst til standardpris-feltet

Tilføj "ex moms" som hjælpetekst under label'et for standardpris pr. nat i `HotelFormDialog`.

### Ændring

**Fil: `src/components/vagt-flow/HotelRegistry.tsx`** (linje 182-184)

Tilføj en lille `<p>` med muted tekst under Label:

```tsx
<div>
  <Label>Standardpris pr. nat (DKK)</Label>
  <p className="text-xs text-muted-foreground">Ex moms</p>
  <Input type="number" ... />
</div>
```

