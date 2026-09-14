# Mere præcis kampagne i kvalitetskøen

I dag viser kolonnen "Kampagne" kun den brede kampagne på kunden, fx "Tryg Products" eller "Kanvas". Det siger ikke hvad salget faktisk handler om.

Der findes mere præcise oplysninger på hvert salg. Eksempler fra de seneste 7 dage:

| Vises i dag | Kan vises i stedet |
| --- | --- |
| Tryg Products | Partnersalg - FDM - TRYG |
| Tryg Products | Partnersalg - Kræftens Bekæmpelse - Tryg |
| Kanvas | Meeting -- AE_Kanvas |
| Eesy TM Products | Fri tale + 40 GB data (5G) |
| Hiper Bredbånd | Hiper Viderestilling |
| Finansforbundet Products | (FF) FTFa stud + Studerende medlem |

## Hvad ændres

Kolonnen bliver todelt i samme celle:

- Øverst: den præcise betegnelse — navnet på den konkrete kampagne i ringesystemet, hvis den findes.
- Nederst, i lille grå skrift: den brede kampagne (som i dag), så man stadig kan se hvilken kunde/aftale det hører til.

Hvis den præcise kampagne mangler på et salg, bruges produktet/produkterne på salget i stedet. Mangler begge, vises den brede kampagne alene, som i dag.

Fanerne øverst bliver ikke ændret — de grupperer stadig efter team, og filtreringen af køen er uændret.

## Det ændres ikke

Kontrollens tjekliste vælges fortsat ud fra den brede kampagne. Resultater, mails, provision, afregning og eksisterende data røres ikke. Ændringen er kun visning plus et par ekstra felter i det datasæt køen bygger på.

## Teknisk

- `public.quality_sales_scope` og `public.get_quality_queue` udvides med to nye felter: `dialer_campaign_label` (fra `adversus_campaign_mappings.adversus_campaign_name` matchet på `sales.dialer_campaign_id`) og `product_label` (sammensat af `sale_items` → `products.name`, distinkt, maks. 2 navne + "…").
- Ingen ændring af eksisterende felter eller signaturens rækkefølge for de nuværende kolonner; nye felter tilføjes til sidst, så typegenerering og øvrige kald ikke brydes.
- `useQualityControl.ts`: udvid `QualityQueueRow`-typen med de to felter.
- `QualityControl.tsx`: render primær linje = `dialer_campaign_label ?? product_label ?? campaign_name`, sekundær linje = `campaign_name` når den afviger fra den primære.
- Produktopslaget laves som `LEFT JOIN LATERAL` med aggregering, så et salg ikke duplikeres.
