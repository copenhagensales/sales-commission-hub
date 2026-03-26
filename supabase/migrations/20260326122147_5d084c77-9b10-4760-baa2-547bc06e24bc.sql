-- Drop old unique constraint and add new one allowing same value on multiple products
ALTER TABLE cancellation_product_mappings 
  DROP CONSTRAINT cancellation_product_mappings_client_id_excel_product_name_key;

ALTER TABLE cancellation_product_mappings 
  ADD CONSTRAINT cancellation_product_mappings_client_product_excel_key 
  UNIQUE (client_id, excel_product_name, product_id);