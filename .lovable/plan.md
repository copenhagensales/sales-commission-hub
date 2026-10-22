# Excel: provision pr. medarbejder 15/9–14/10 2026 (Eesy FM, YouSee, ASE)

## Fund
Kunderne i Stork i perioden (dansk tid):

| Kunde | Salg | Provision |
| --- | --- | --- |
| Eesy FM | 2.421 | 944.990 kr |
| Yousee | 482 | 202.175 kr |
| ASE FM | 92 | 38.250 kr |

Eesy TM (650.870 kr) tages ikke med, da du skrev Eesy FM. ASE findes kun som "ASE FM".

## Leverance
Excel-fil `provision_eesyfm_yousee_ase_15-09_14-10_2026.xlsx` i Filer:
- **Ark 1 "Pr. medarbejder":** Medarbejder, Eesy FM, Yousee, ASE FM, I alt (kr), sorteret alfabetisk, totalrække nederst.
- **Ark 2 "Om udtrækket":** periode, kunder og forbehold.

Forbehold: tallene er registreret provision på salgene. Annulleringer og modregninger er ikke trukket fra, og tallene er ikke den endelige løn.

## Teknisk
Ren læsning: `sales` → `client_campaigns` → `clients`, summen af `sale_items.mapped_commission`, medarbejder via `agent_email` = arbejdsmail på medarbejderkortet, med `employee_agent_mapping` som reserve. Salg uden kobling til en medarbejder vises samlet som "Ikke koblet". Ingen ændringer i app, database eller løndata.
