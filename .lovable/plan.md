

## Kør rematch-pricing-rules for alle Relatel-produkter

### Hvad der sker
Den opdaterede `rematch-pricing-rules` Edge Function (med `leadResultFields`-fix) køres for alle Relatel-produkter, så Tilskud-baserede prisregler (priority 5) nu matcher korrekt i stedet for at falde tilbage til lavere priority 0-regler.

### Fremgangsmåde

1. **Dry-run først** for 2-3 Switch-produkter for at verificere at Tilskud-reglerne matcher korrekt
2. **Fuld kørsel (ikke dry-run)** for alle Relatel-produkter i grupper:
   - Switch Contact Center-produkter
   - MBB-produkter (1000GB, 2000GB varianter)
   - Fri Tale-produkter (alle varianter)
3. **Verificering** - tjek at provisioner er opdateret korrekt via database-forespørgsler

### Produktgrupper der rematches
- **Switch Contact Center** (alle varianter)
- **MBB 1000GB / 2000GB** (ATL, BTL, Router-varianter)
- **Fri Tale** (10GB til fri data, ATL/BTL varianter)

### Forventet resultat
- Salg med `Tilskud=0%` får højere provision (priority 5-regler)
- Salg med `Tilskud=100%` beholder fallback-provision (priority 0-regler)
- `is_immediate_payment` og andre manuelle overrides bevares

### Risiko
Lav - funktionen opdaterer kun `matched_pricing_rule_id`, `mapped_commission`, `mapped_revenue` og `display_name`. Manuelle overrides som `is_immediate_payment` røres ikke.

### Tekniske detaljer
- Edge Function kaldes via `supabase.functions.invoke("rematch-pricing-rules", { body: { product_id: "..." } })` for hvert produkt-ID
- Hvert kald processer alle `sale_items` for det pågældende produkt
- Dry-run returnerer statistik uden at ændre data

