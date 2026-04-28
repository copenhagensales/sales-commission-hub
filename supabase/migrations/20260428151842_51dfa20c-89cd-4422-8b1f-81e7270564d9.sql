-- Sale_items snapshot (>= 2026-03-15, 9 Eesy TM parents)
INSERT INTO public.pricing_backup_2026_04_28 (backup_type, entity_id, payload)
SELECT 
  'sale_item',
  si.id,
  jsonb_build_object(
    'sale_id', si.sale_id,
    'product_id', si.product_id,
    'mapped_commission', si.mapped_commission,
    'mapped_revenue', si.mapped_revenue,
    'matched_pricing_rule_id', si.matched_pricing_rule_id,
    'sale_datetime', s.sale_datetime,
    'quantity', si.quantity,
    'is_immediate_payment', si.is_immediate_payment
  )
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.product_id IN (
  '72c4a439-22c0-4db1-836b-a578d56fe81e',
  '5e20993c-be45-4913-b2a0-7a7edb2282a2',
  'd1bc3454-8acb-4efc-b273-6fcb30df51c1',
  '2810fbad-c253-44c3-a2d0-2fbaeb6d0435',
  'f18da6d2-e11b-49a5-94de-916b60941819',
  'b95e648d-09f4-459a-89c0-69e0cd4452fb',
  'c44aa333-470c-4109-aa78-36eee5d22d5e',
  '21a7f7aa-a2f9-47cc-be0d-4a2614a3334a',
  'bd58176b-307d-4000-855e-9235f9dd582b'
)
AND s.sale_datetime >= '2026-03-15T00:00:00+00:00';

-- Pricing rules snapshot (17 berørte regler)
INSERT INTO public.pricing_backup_2026_04_28 (backup_type, entity_id, payload)
SELECT 'pricing_rule', id, to_jsonb(ppr.*)
FROM public.product_pricing_rules ppr
WHERE id IN (
  '53b388a2-f3fe-4018-a8bc-0fb63e1572bd',
  '00cb4332-a07c-4ff0-97ac-1953da186868',
  '20cfb615-f757-4dfe-8be7-e8007f720852',
  '3e7647ad-33bb-4539-bde5-09456e6acdfb',
  '78148b51-87ad-4e99-94c7-58fa20639c1a',
  '44f61139-dfd5-4331-b90b-bd8c5326c5a0',
  'faedd53c-4ad1-4746-aba3-5336a860a06a',
  '3b96c587-9a1d-46b7-9d6c-63e0146c8844',
  'dd4b204c-08b0-4872-beb0-0d2f6b66a9cd',
  'acffad24-6352-446d-aec0-3185951a20cb',
  '8a4a949c-55be-41f4-9920-83db5aae071b',
  '8ce731fc-e190-42ec-a7e4-a4d4617bf199',
  '6efcc25f-10ba-4585-9c85-2cb8704f18dd',
  '65cb01ad-6718-4de9-96d5-a7b55da21a6f',
  '4f8c192c-cd80-415e-a1b6-baed3a53ba93',
  '61bf48f9-4b91-402d-bc6f-b91be0157d57',
  'd7e48d67-4368-4762-be9e-3b8e00b9dbcd'
);

-- Product snapshot ("Fri tale + 110")
INSERT INTO public.pricing_backup_2026_04_28 (backup_type, entity_id, payload)
SELECT 'product', id, to_jsonb(p.*)
FROM public.products p
WHERE id = '5e20993c-be45-4913-b2a0-7a7edb2282a2';

-- Cancellation queue snapshot (>= 2026-03-15, via sale_id-link til de 9 produkter)
INSERT INTO public.pricing_backup_2026_04_28 (backup_type, entity_id, payload)
SELECT 'cancellation', cq.id, to_jsonb(cq.*)
FROM public.cancellation_queue cq
WHERE cq.deduction_date >= '2026-03-15'
  AND EXISTS (
    SELECT 1 FROM public.sale_items si2
    WHERE si2.sale_id = cq.sale_id
    AND si2.product_id IN (
      '72c4a439-22c0-4db1-836b-a578d56fe81e',
      '5e20993c-be45-4913-b2a0-7a7edb2282a2',
      'd1bc3454-8acb-4efc-b273-6fcb30df51c1',
      '2810fbad-c253-44c3-a2d0-2fbaeb6d0435',
      'f18da6d2-e11b-49a5-94de-916b60941819',
      'b95e648d-09f4-459a-89c0-69e0cd4452fb',
      'c44aa333-470c-4109-aa78-36eee5d22d5e',
      '21a7f7aa-a2f9-47cc-be0d-4a2614a3334a',
      'bd58176b-307d-4000-855e-9235f9dd582b'
    )
  );