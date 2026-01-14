
-- Add indexes to optimize the get_aggregated_product_types function
CREATE INDEX IF NOT EXISTS idx_sale_items_product_aggregation 
ON sale_items (adversus_external_id, adversus_product_title, product_id, created_at DESC)
WHERE adversus_product_title IS NOT NULL;

-- Add index on product_id for the LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id);

-- Add index on sale_id for the LEFT JOIN to sales
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
