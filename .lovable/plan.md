
Brugeren spørger hvorfor Eesy TM-salg vises på dashboardet **før** emnet er gemt og lukket som "succes" i Adversus. Dette er et data-attribuerings/filtrerings-spørgsmål — jeg skal undersøge hvordan salg fra Adversus (Eesy TM) kommer ind, og hvilken status der bruges som filter på dashboardet.

Lad mig undersøge:
1. Hvordan Adversus-salg ingesteres (hvad triggrer oprettelse i `sales`-tabellen)
2. Hvilken `validation_status` / `success`-flag der sættes
3. Om dashboardet filtrerer på "kun success/closed" eller bare alle salg

Jeg starter med at læse de relevante filer.
