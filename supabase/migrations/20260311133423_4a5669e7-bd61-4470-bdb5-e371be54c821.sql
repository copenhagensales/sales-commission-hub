
-- Update commission/revenue for FM sale_items based on their campaign
-- "Eesy marked" campaign (0835d092) should use mapping 89e33c2f prices
-- "Eesy gaden" campaign (c527b6a1) should use mapping 6a5658f2 prices

-- Eesy uden første måned (Nuuday) - marked: 295/1000
UPDATE sale_items si SET mapped_commission = 295, mapped_revenue = 1000
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = 'a638c296-c7e4-48de-a0aa-d2a2a047e693';

-- Eesy uden første måned (IKKE Nuuday) - marked: 385/1000
UPDATE sale_items si SET mapped_commission = 385, mapped_revenue = 1000
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = '4ee2c0c6-7f47-4a2c-a9c5-9c917ab3aa95';

-- Eesy med første måned (Nuuday) - marked: 280/950
UPDATE sale_items si SET mapped_commission = 280, mapped_revenue = 950
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = '1dd6a683-42f4-43e5-96a5-adb6dc02da8a';

-- Eesy med første måned (IKKE Nuuday) - marked: 355/950
UPDATE sale_items si SET mapped_commission = 355, mapped_revenue = 950
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = '6fdc5b77-1278-404c-af94-eb46778c39d7';

-- Eesy 99 uden første måned (Nuuday) - marked: 295/1000
UPDATE sale_items si SET mapped_commission = 295, mapped_revenue = 1000
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = 'be72946a-8404-4620-acc7-78cdcb60e06b';

-- Eesy 99 uden første måned (IKKE Nuuday) - marked: 385/1000
UPDATE sale_items si SET mapped_commission = 385, mapped_revenue = 1000
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = '73198b7d-37d7-4959-9b75-47928b0cc82d';

-- Eesy 99 med første måned (Nuuday) - marked: 280/950
UPDATE sale_items si SET mapped_commission = 280, mapped_revenue = 950
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = '67fd55c3-03f2-45bc-97fa-4a9c653e8bd4';

-- Eesy 99 med første måned (IKKE Nuuday) - marked: 355/950
UPDATE sale_items si SET mapped_commission = 355, mapped_revenue = 950
FROM sales s
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND s.client_campaign_id = '0835d092-2504-43e4-b818-55d4dd7ddedb'
  AND si.product_id = 'e555195d-b956-4ac1-9fb0-cdc0fee142f8'
