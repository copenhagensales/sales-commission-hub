DO $$
DECLARE
  sw uuid := '2a7318af-bb43-4db2-bc39-597c9cc14aaa';
  gg uuid := 'bbac6432-8704-4289-9bf3-0be19849f766';
BEGIN
  -- 1. Snapshot history BEFORE-state for all rules that will change
  INSERT INTO pricing_rule_history (
    pricing_rule_id, name, commission_dkk, revenue_dkk, conditions, campaign_mapping_ids,
    effective_from, effective_to, priority, is_active, allows_immediate_payment,
    immediate_payment_commission_dkk, immediate_payment_revenue_dkk, change_type, campaign_match_mode
  )
  SELECT id, name, commission_dkk, revenue_dkk, conditions, campaign_mapping_ids,
         effective_from, effective_to, priority, is_active, allows_immediate_payment,
         immediate_payment_commission_dkk, immediate_payment_revenue_dkk,
         'switch_mirror_google_before', campaign_match_mode
  FROM product_pricing_rules
  WHERE is_active = true
    AND (
      (sw = ANY(campaign_mapping_ids) AND NOT (gg = ANY(campaign_mapping_ids)))
      OR
      (gg = ANY(campaign_mapping_ids) AND NOT (sw = ANY(campaign_mapping_ids)))
    );

  -- 2. Remove Switch from rules where Google is NOT present
  UPDATE product_pricing_rules
  SET campaign_mapping_ids = array_remove(campaign_mapping_ids, sw),
      updated_at = now()
  WHERE is_active = true
    AND sw = ANY(campaign_mapping_ids)
    AND NOT (gg = ANY(campaign_mapping_ids));

  -- 3. Add Switch to rules where Google IS present
  UPDATE product_pricing_rules
  SET campaign_mapping_ids = array_append(campaign_mapping_ids, sw),
      updated_at = now()
  WHERE is_active = true
    AND gg = ANY(campaign_mapping_ids)
    AND NOT (sw = ANY(campaign_mapping_ids));

  -- 4. Snapshot AFTER-state for audit
  INSERT INTO pricing_rule_history (
    pricing_rule_id, name, commission_dkk, revenue_dkk, conditions, campaign_mapping_ids,
    effective_from, effective_to, priority, is_active, allows_immediate_payment,
    immediate_payment_commission_dkk, immediate_payment_revenue_dkk, change_type, campaign_match_mode
  )
  SELECT id, name, commission_dkk, revenue_dkk, conditions, campaign_mapping_ids,
         effective_from, effective_to, priority, is_active, allows_immediate_payment,
         immediate_payment_commission_dkk, immediate_payment_revenue_dkk,
         'switch_mirror_google_after', campaign_match_mode
  FROM product_pricing_rules
  WHERE is_active = true
    AND (sw = ANY(campaign_mapping_ids) OR gg = ANY(campaign_mapping_ids));
END $$;