ALTER TABLE product_pricing_rules 
ADD COLUMN immediate_payment_commission_dkk DECIMAL DEFAULT NULL,
ADD COLUMN immediate_payment_revenue_dkk DECIMAL DEFAULT NULL;