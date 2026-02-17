

## Fix: "Hent sample-felter" fejler med 404

### Problem
Når du klikker "Hent sample-felter", returnerer API'et en 404-fejl. Årsagen er at `fetchSalesRaw`-metoden kalder det forkerte endpoint.

- `fetchSalesRaw` kalder: `/v1/orders` (eksisterer ikke)
- `fetchSales` kalder: `/sales` (det rigtige endpoint)

Adversus API'et har sit salgs-endpoint på `{baseUrl}/sales`, men `fetchSalesRaw` bruger `this.get()` som tilføjer `/v1` prefix og kalder `/orders` i stedet for `/sales`.

### Løsning
Ret `fetchSalesRaw` i Adversus-adapteren til at kalde det korrekte endpoint direkte (ligesom `fetchSalesSequential` gør), uden at bruge `this.get()`.

### Tekniske detaljer

**Fil: `supabase/functions/integration-engine/adapters/adversus.ts`** (linje 111-125)

Nuværende (fejlagtig) kode:
```typescript
async fetchSalesRaw(limit: number = 20): Promise<Record<string, unknown>[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const filterStr = encodeURIComponent(JSON.stringify({ 
      created: { $gt: startDate.toISOString() } 
    }));
    const data = await this.get(`/orders?filters=${filterStr}&pageSize=${limit}`);
    const orders = data.orders || [];
    return orders;
}
```

Rettet kode:
```typescript
async fetchSalesRaw(limit: number = 20): Promise<Record<string, unknown>[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const filterStr = encodeURIComponent(JSON.stringify({ 
      created: { $gt: startDate.toISOString() } 
    }));
    const url = `${this.baseUrl}/sales?pageSize=${limit}&page=1&filters=${filterStr}`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${this.authHeader}` },
    });
    if (!res.ok) throw new Error(`Adversus API Error ${res.status}`);
    const data = await res.json();
    const sales = data.sales || [];
    console.log(`[Adversus] fetchSalesRaw: Retrieved ${sales.length} raw sales (limit: ${limit})`);
    return sales;
}
```

Ændringer:
- Kalder `/sales` direkte i stedet for `/v1/orders`
- Bruger `data.sales` i stedet for `data.orders`
- Matcher det mønster som `fetchSalesSequential` allerede bruger succesfuldt

