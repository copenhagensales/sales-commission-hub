-- ============================================
-- FASE 1: KRITISKE DATABASE INDEXES
-- ============================================

-- KRITISK: auth_user_id index (bruges af ALLE RLS checks)
CREATE INDEX IF NOT EXISTS idx_emd_auth_user_id 
ON employee_master_data (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Email lookups (bruges til login fallback)
CREATE INDEX IF NOT EXISTS idx_emd_private_email_lower 
ON employee_master_data (LOWER(private_email));

CREATE INDEX IF NOT EXISTS idx_emd_work_email_lower 
ON employee_master_data (LOWER(work_email));

-- job_title for manager scope lookup
CREATE INDEX IF NOT EXISTS idx_emd_job_title_lower 
ON employee_master_data (LOWER(job_title)) WHERE is_active = true;

-- job_positions name (for JOIN med employee_master_data)
CREATE INDEX IF NOT EXISTS idx_job_positions_name_lower 
ON job_positions (LOWER(name));

-- teams leader indexes
CREATE INDEX IF NOT EXISTS idx_teams_leader 
ON teams (team_leader_id);

CREATE INDEX IF NOT EXISTS idx_teams_assistant_leader 
ON teams (assistant_team_leader_id);

-- team_members employee lookup
CREATE INDEX IF NOT EXISTS idx_team_members_employee 
ON team_members (employee_id);

-- ============================================
-- FASE 2: CLEANUP - FJERN DUPLIKEREDE INDEXES
-- ============================================

-- Duplikater af eksisterende indexes
DROP INDEX IF EXISTS idx_sale_items_sale;
DROP INDEX IF EXISTS idx_sale_items_product;

-- ============================================
-- FASE 3: SERVER-SIDE UNREAD MESSAGE COUNT
-- ============================================

-- Effektiv function til at tælle ulæste beskeder
CREATE OR REPLACE FUNCTION get_unread_message_count(p_employee_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(unread_count), 0)::integer
  FROM (
    SELECT 
      (SELECT COUNT(*)::integer 
       FROM chat_messages m 
       WHERE m.conversation_id = cm.conversation_id 
         AND m.sender_id != p_employee_id
         AND m.deleted_at IS NULL
         AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
      ) as unread_count
    FROM chat_conversation_members cm
    WHERE cm.employee_id = p_employee_id
  ) sub
$$;