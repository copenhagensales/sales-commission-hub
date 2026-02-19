
# Fix: Konflikt mellem Settings og Schedule Editor

## Problemet

To steder i systemet styrer sync-frekvens for integrationer:

1. **Schedule Editor** (System Stability-siden) -- styrer frekvens OG startminut, gemmer i `config.sync_schedule`
2. **Settings** (DialerIntegrations) -- styrer KUN frekvens, sender IKKE `custom_schedule` til edge function

Naar frekvens aendres i Settings, overskriver den Schedule Editors startminut-indstillinger, fordi `update-cron-schedule` edge function ikke faar `custom_schedule` med, og dermed falder tilbage til standard cron (startminut :00).

## Loesning

Fjern sync-frekvens styring fra Settings-siden og erstat med et link/reference til Schedule Editor paa System Stability-siden. Schedule Editor bliver den eneste kilde til sandheden for sync-tidsplaner.

### Tekniske aendringer

**Fil: `src/components/settings/DialerIntegrations.tsx` (linje ~1631-1680)**

Erstat sync-frekvens dropdown med en read-only visning + link:

```typescript
<TableCell>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">
      {integration.sync_frequency_minutes
        ? `Hvert ${integration.sync_frequency_minutes} min`
        : "Deaktiveret"}
    </span>
    <Badge variant={integration.is_active && integration.sync_frequency_minutes ? "default" : "secondary"} className="text-xs">
      {integration.is_active && integration.sync_frequency_minutes ? "Aktiv" : "Manual"}
    </Badge>
  </div>
  <a href="/system-stability" className="text-xs text-primary hover:underline">
    Aendr i Systemstabilitet
  </a>
</TableCell>
```

Dette:
- Fjerner muligheden for at overskrive Schedule Editor-indstillinger fra Settings
- Viser stadig den aktuelle frekvens som read-only information
- Giver et direkte link til Schedule Editor hvor aendringer skal foretages
- Eliminerer risikoen for at startminut nulstilles ved et uheld

## Filer der aendres

- `src/components/settings/DialerIntegrations.tsx` -- erstat dropdown med read-only + link

## Ingen database-aendringer
