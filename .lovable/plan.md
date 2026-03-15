

## Opdatering af planen: Ekskludér stabsmedarbejdere fra pulsmåling-popup

### Nuværende situation

`useShouldShowPulseSurvey` filtrerer allerede på `roleData?.role === 'medarbejder'`, så teamledere, rekruttering, assistenter og ejere ser aldrig popup'en.

### Ekstra sikring i planen

I den nye `PulseSurveyPopup`-komponent tilføjer vi et ekstra tjek mod `is_staff_employee` fra `employee_master_data`, så selv hvis en stabsmedarbejder ved en fejl har rollen "medarbejder", vil de stadig blive ekskluderet.

Konkret: Når popup'en henter medarbejderdata for at checke dismissal/completion, tjekkes `is_staff_employee`. Hvis `true`, vises popup'en ikke.

Resten af planen (database-tabel, popup-komponent, hooks, MainLayout-integration) forbliver som godkendt — med denne tilføjelse bagt ind i popup-logikken.

### Opsummeret filter-kæde

```text
Aktiv survey? → Rolle = medarbejder? → is_staff_employee = false? → Ikke udfyldt? → Ikke udsat? → Vis popup
```

