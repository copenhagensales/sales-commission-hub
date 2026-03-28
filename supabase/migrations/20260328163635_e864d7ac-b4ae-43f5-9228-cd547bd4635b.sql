ALTER TABLE cancellation_upload_configs
  ADD COLUMN type_detection_column TEXT DEFAULT NULL,
  ADD COLUMN type_detection_values JSONB DEFAULT NULL;