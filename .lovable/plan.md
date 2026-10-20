# Ny fane: Fiber registrering (tom placeholder)

## Hvad bygges
- Nyt menupunkt "Fiber registrering" under Mit Hjem, placeret lige efter "TDC Salgsværktøj (test)".
- Ny side `/fiber-registrering` med overskrift "Fiber registrering" og teksten "Kommer snart". Ingen data, ingen formularer.

## Hvem kan se den
- Samme adgang som de tre eksisterende TDC-punkter (TDC Opsummering, Idriftsættelsesmail, Salgsværktøj), dvs. rettigheden `menu_tdc_opsummering`, som i dag er dét, der giver TDC Erhverv-medarbejderne adgang.
- Både menupunkt og side beskyttes af samme rettighed (siden kan ikke åbnes via direkte link uden adgang).
- Ingen ny rettighedsnøgle, ingen ændring af roller eller rettighedsfiler (rød zone undgås). Ønskes en separat rettighed senere, tages det som egen ordre.

## Teknisk
- `src/pages/FiberRegistrering.tsx` (ny, placeholder med `MainLayout`).
- `src/routes/pages.ts`: lazy-import.
- `src/routes/config.tsx`: route med `access: "role"`, `positionPermission: "menu_tdc_opsummering"`.
- `src/components/layout/AppSidebar.tsx`: NavLink bag `p.canViewTdcOpsummering`, og `/fiber-registrering` tilføjes til Mit Hjem-stierne (linje 104) så sektionen holdes åben.
- Ingen database-ændringer.
