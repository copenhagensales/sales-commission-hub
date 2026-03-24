ALTER TABLE cancellation_upload_configs ADD COLUMN product_phone_mappings JSONB DEFAULT '[]';
ALTER TABLE cancellation_queue ADD COLUMN target_product_name TEXT;