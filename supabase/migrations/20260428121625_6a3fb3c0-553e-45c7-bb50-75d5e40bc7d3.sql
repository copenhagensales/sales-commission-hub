
BEGIN;

-- STEG 1: Backfill client_campaign_id på alle 9 parents
UPDATE products
SET client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'
WHERE id IN (
  '72c4a439-22c0-4db1-836b-a578d56fe81e',
  '2810fbad-c253-44c3-a2d0-2fbaeb6d0435',
  'f18da6d2-e11b-49a5-94de-916b60941819',
  'b95e648d-09f4-459a-89c0-69e0cd4452fb',
  'c44aa333-470c-4109-aa78-36eee5d22d5e',
  'd1bc3454-8acb-4efc-b273-6fcb30df51c1'
);

-- STEG 2: Opdater fallback-priser
UPDATE products SET commission_dkk = 250, revenue_dkk = 550
WHERE id = 'b95e648d-09f4-459a-89c0-69e0cd4452fb';

UPDATE products SET commission_dkk = 300, revenue_dkk = 625
WHERE id = 'c44aa333-470c-4109-aa78-36eee5d22d5e';

-- STEG 3: Deaktivér alle eksisterende rules på de 9 parents
UPDATE product_pricing_rules
SET is_active = false, updated_at = now()
WHERE product_id IN (
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
AND is_active = true;

-- STEG 4: Opret 18 rene rules
WITH std_mappings AS (
  SELECT ARRAY[
    'f3d53aef-ba92-4e6e-85e0-e2a7ec07076f',
    '3bde2b74-d94d-45cf-9d8b-a3b905342e40',
    '0dc3030a-c8b0-4e57-be7f-6239d6b82bad',
    '37d7657e-fb5a-4d45-afca-3b09b38cc108',
    'f91932e8-e36b-447b-91fa-5a1cd55c653e',
    '16dd20c3-cb13-45c2-8cbb-fd1d005cae0b',
    'fe693fe7-4a08-41be-836d-d1cad8cff36b',
    '52e906e9-0084-42d1-b23a-47595fc32000',
    'f28e6b6a-8559-4016-bbb1-41e93b4920bc',
    'bdb6783f-6cb3-479e-b8ca-673d06e4656f',
    '5a3262b1-ad94-444e-b652-b79a105e5a30',
    '3888496b-f9d4-43b8-ac26-073a40589f7a',
    '9c729e61-fdf2-4311-aeeb-e1c5681f82e7',
    '60da0076-85a5-4bf3-94d7-3f29fdbb1cde',
    '50ae88b4-54f6-4327-8a26-55418c292b8d',
    'af84780b-afc4-4ea9-b5e0-4f849ca84127',
    '86467ec6-21b5-478e-b4c5-979b7e1882fc',
    '56fda884-0b01-45bb-b59f-b123bf4b74f0',
    'b225b16a-1209-46f2-a710-d8af3ebd2f1c',
    'd811a2a8-9ba3-4ffd-ac6d-c6dd562db15f',
    '531bba90-2f5b-4f42-9c7e-8646f5c837a5',
    '711cf499-fdda-49fc-ad53-53d120a62992',
    'b61efb52-67a9-43f2-9579-b90f10df4cbf',
    '4b1abe3d-434a-4deb-9c79-dfa34860d0a2',
    'f2e5805c-ec75-4df6-91ab-2e61eca97ae8',
    'd1650c50-8d23-4953-9ed3-76b1461e6be4',
    '3198ca73-9d51-47b2-8bd0-1574c185eb68',
    'f884bd68-e6e7-4dd7-b4c2-931c35c45edd',
    '12e1bc41-22f6-4312-8d50-8221ad6ad986',
    '251e189b-5867-4575-b0ad-6e3b30c93c88',
    'c5d45329-f05c-4ef0-9313-2ede030f40e3',
    '342e78cc-8824-4ee3-b4c4-0752d39fbd8b',
    'dd1bb992-5f8b-4928-bc65-867348b88127',
    'f1d4b4fc-b033-48c3-bb2e-e4138ea02556',
    'cccc28bb-8576-45e5-b219-f177d81a90e3',
    '2b5a5dbf-6238-4ac4-8c0b-2f1b4edac2f3',
    '1abb56a7-dbf1-46c8-9d0f-1774a7f3a061',
    '72df5403-4309-41a8-831d-cb408b6d8c26',
    '1cba3673-2432-49b2-99f1-ef06c480b7b0'
  ]::uuid[] AS ids
),
special_mappings AS (
  SELECT ARRAY[
    '159413c4-345c-4fc2-9812-6daaa7bbdf9d',
    '20f9af1f-46a6-4cb0-9b49-d22db248c0c7'
  ]::uuid[] AS ids
),
products_to_seed AS (
  SELECT * FROM (VALUES
    ('72c4a439-22c0-4db1-836b-a578d56fe81e'::uuid, 300, 650, 225, 650),
    ('5e20993c-be45-4913-b2a0-7a7edb2282a2'::uuid, 375, 700, 260, 700),
    ('d1bc3454-8acb-4efc-b273-6fcb30df51c1'::uuid, 375, 750, 275, 750),
    ('2810fbad-c253-44c3-a2d0-2fbaeb6d0435'::uuid, 375, 750, 275, 750),
    ('f18da6d2-e11b-49a5-94de-916b60941819'::uuid, 250, 550, 190, 550),
    ('b95e648d-09f4-459a-89c0-69e0cd4452fb'::uuid, 250, 550, 190, 550),
    ('c44aa333-470c-4109-aa78-36eee5d22d5e'::uuid, 300, 625, 225, 625),
    ('21a7f7aa-a2f9-47cc-be0d-4a2614a3334a'::uuid, 375, 750, 275, 750),
    ('bd58176b-307d-4000-855e-9235f9dd582b'::uuid, 350, 700, 260, 700)
  ) AS t(product_id, std_comm, std_rev, spec_comm, spec_rev)
)
INSERT INTO product_pricing_rules
  (product_id, name, commission_dkk, revenue_dkk, priority, is_active,
   effective_from, campaign_mapping_ids, campaign_match_mode, conditions)
SELECT
  p.product_id, 'Standard 2026', p.std_comm, p.std_rev, 0, true,
  '2026-01-01'::date, (SELECT ids FROM std_mappings), 'include', '{}'::jsonb
FROM products_to_seed p
UNION ALL
SELECT
  p.product_id, 'Specialkampagne 2026', p.spec_comm, p.spec_rev, 10, true,
  '2026-01-01'::date, (SELECT ids FROM special_mappings), 'include', '{}'::jsonb
FROM products_to_seed p;

COMMIT;
