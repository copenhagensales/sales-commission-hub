export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      absence_request_v2: {
        Row: {
          comment: string | null
          created_at: string | null
          employee_id: string
          end_date: string
          end_time: string | null
          id: string
          is_full_day: boolean | null
          postponed_until: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["absence_request_status"] | null
          type: Database["public"]["Enums"]["absence_type_v2"]
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          employee_id: string
          end_date: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          postponed_until?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["absence_request_status"] | null
          type: Database["public"]["Enums"]["absence_type_v2"]
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          postponed_until?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["absence_request_status"] | null
          type?: Database["public"]["Enums"]["absence_type_v2"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_request_v2_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_request_v2_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_request_v2_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_request_v2_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_request_v2_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_request_v2_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      adversus_campaign_mappings: {
        Row: {
          adversus_campaign_id: string
          adversus_campaign_name: string | null
          client_campaign_id: string | null
          created_at: string | null
          id: string
          reference_extraction_config: Json | null
          updated_at: string | null
        }
        Insert: {
          adversus_campaign_id: string
          adversus_campaign_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          id?: string
          reference_extraction_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          adversus_campaign_id?: string
          adversus_campaign_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          id?: string
          reference_extraction_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adversus_campaign_mappings_client_campaign_id_fkey"
            columns: ["client_campaign_id"]
            isOneToOne: false
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      adversus_events: {
        Row: {
          created_at: string | null
          event_type: string
          external_id: string
          id: string
          payload: Json
          processed: boolean | null
          received_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string
          external_id: string
          id?: string
          payload: Json
          processed?: boolean | null
          received_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          external_id?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          received_at?: string | null
        }
        Relationships: []
      }
      adversus_product_mappings: {
        Row: {
          adversus_external_id: string | null
          adversus_product_title: string | null
          created_at: string | null
          id: string
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          adversus_external_id?: string | null
          adversus_product_title?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adversus_external_id?: string | null
          adversus_product_title?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adversus_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_presence: {
        Row: {
          can_receive_calls: boolean | null
          created_at: string
          employee_id: string
          id: string
          identity: string
          is_online: boolean
          last_seen_at: string
          updated_at: string
        }
        Insert: {
          can_receive_calls?: boolean | null
          created_at?: string
          employee_id: string
          id?: string
          identity: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
        }
        Update: {
          can_receive_calls?: boolean | null
          created_at?: string
          employee_id?: string
          id?: string
          identity?: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_presence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_presence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_presence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          base_salary_monthly: number | null
          created_at: string | null
          email: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          external_adversus_id: string | null
          external_dialer_id: string | null
          id: string
          is_active: boolean | null
          name: string
          source: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          base_salary_monthly?: number | null
          created_at?: string | null
          email: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          external_adversus_id?: string | null
          external_dialer_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          base_salary_monthly?: number | null
          created_at?: string | null
          email?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          external_adversus_id?: string | null
          external_dialer_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_governance_roles: {
        Row: {
          appointed_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          responsible_person: string
          role_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          responsible_person: string
          role_name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          responsible_person?: string
          role_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_instruction_log: {
        Row: {
          acknowledged: boolean | null
          created_at: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          id: string
          instruction_date: string | null
          method: string
          notes: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string | null
          employee_email?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          instruction_date?: string | null
          method?: string
          notes?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string | null
          employee_email?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          instruction_date?: string | null
          method?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_instruction_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_instruction_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_instruction_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_use_case_registry: {
        Row: {
          approved_date: string | null
          created_at: string | null
          data_types: string | null
          has_personal_data: boolean | null
          human_control_requirement: string | null
          id: string
          name: string
          next_review_date: string | null
          notes: string | null
          owner: string
          risk_level: string | null
          system: string
          updated_at: string | null
          user_group: string | null
        }
        Insert: {
          approved_date?: string | null
          created_at?: string | null
          data_types?: string | null
          has_personal_data?: boolean | null
          human_control_requirement?: string | null
          id?: string
          name: string
          next_review_date?: string | null
          notes?: string | null
          owner: string
          risk_level?: string | null
          system: string
          updated_at?: string | null
          user_group?: string | null
        }
        Update: {
          approved_date?: string | null
          created_at?: string | null
          data_types?: string | null
          has_personal_data?: boolean | null
          human_control_requirement?: string | null
          id?: string
          name?: string
          next_review_date?: string | null
          notes?: string | null
          owner?: string
          risk_level?: string | null
          system?: string
          updated_at?: string | null
          user_group?: string | null
        }
        Relationships: []
      }
      amo_amr_elections: {
        Row: {
          created_at: string
          elected_date: string
          election_document_url: string | null
          election_period_months: number
          id: string
          member_id: string
          next_election_due: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          elected_date: string
          election_document_url?: string | null
          election_period_months?: number
          id?: string
          member_id: string
          next_election_due: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          elected_date?: string
          election_document_url?: string | null
          election_period_months?: number
          id?: string
          member_id?: string
          next_election_due?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amo_amr_elections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amo_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_annual_discussions: {
        Row: {
          approved_by: string | null
          collab_model: string | null
          created_at: string
          discussion_date: string
          follow_up_tasks: Json | null
          goals: string | null
          id: string
          meeting_cadence: string | null
          minutes_url: string | null
          next_due_date: string | null
          participants: string[] | null
          previous_year_eval: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          collab_model?: string | null
          created_at?: string
          discussion_date: string
          follow_up_tasks?: Json | null
          goals?: string | null
          id?: string
          meeting_cadence?: string | null
          minutes_url?: string | null
          next_due_date?: string | null
          participants?: string[] | null
          previous_year_eval?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          collab_model?: string | null
          created_at?: string
          discussion_date?: string
          follow_up_tasks?: Json | null
          goals?: string | null
          id?: string
          meeting_cadence?: string | null
          minutes_url?: string | null
          next_due_date?: string | null
          participants?: string[] | null
          previous_year_eval?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      amo_apv: {
        Row: {
          action_plan: string | null
          completed_date: string | null
          created_at: string
          deadline: string | null
          evidence_documents: string[] | null
          findings: string | null
          follow_up_status: string | null
          id: string
          next_due_date: string | null
          physical_env: string | null
          psychological_env: string | null
          reason: Database["public"]["Enums"]["amo_apv_reason"]
          responsible_owner: string | null
          risk_level: string | null
          sickness_review: string | null
          start_date: string | null
          title: string
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          action_plan?: string | null
          completed_date?: string | null
          created_at?: string
          deadline?: string | null
          evidence_documents?: string[] | null
          findings?: string | null
          follow_up_status?: string | null
          id?: string
          next_due_date?: string | null
          physical_env?: string | null
          psychological_env?: string | null
          reason?: Database["public"]["Enums"]["amo_apv_reason"]
          responsible_owner?: string | null
          risk_level?: string | null
          sickness_review?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          action_plan?: string | null
          completed_date?: string | null
          created_at?: string
          deadline?: string | null
          evidence_documents?: string[] | null
          findings?: string | null
          follow_up_status?: string | null
          id?: string
          next_due_date?: string | null
          physical_env?: string | null
          psychological_env?: string | null
          reason?: Database["public"]["Enums"]["amo_apv_reason"]
          responsible_owner?: string | null
          risk_level?: string | null
          sickness_review?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amo_apv_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "amo_workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      amo_compliance_rules: {
        Row: {
          active: boolean
          check_logic_key: string | null
          created_at: string
          description: string | null
          id: string
          interval_months: number | null
          rule_name: string
          rule_type: Database["public"]["Enums"]["amo_rule_type"]
        }
        Insert: {
          active?: boolean
          check_logic_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interval_months?: number | null
          rule_name: string
          rule_type?: Database["public"]["Enums"]["amo_rule_type"]
        }
        Update: {
          active?: boolean
          check_logic_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interval_months?: number | null
          rule_name?: string
          rule_type?: Database["public"]["Enums"]["amo_rule_type"]
        }
        Relationships: []
      }
      amo_documents: {
        Row: {
          category: string | null
          comments: string | null
          created_at: string
          document_date: string | null
          doko_reference: string | null
          expiry_date: string | null
          external_reference: string | null
          file_url: string | null
          id: string
          owner: string | null
          related_member_id: string | null
          related_module: string | null
          related_workplace_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          upload_date: string
          version: number
        }
        Insert: {
          category?: string | null
          comments?: string | null
          created_at?: string
          document_date?: string | null
          doko_reference?: string | null
          expiry_date?: string | null
          external_reference?: string | null
          file_url?: string | null
          id?: string
          owner?: string | null
          related_member_id?: string | null
          related_module?: string | null
          related_workplace_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          upload_date?: string
          version?: number
        }
        Update: {
          category?: string | null
          comments?: string | null
          created_at?: string
          document_date?: string | null
          doko_reference?: string | null
          expiry_date?: string | null
          external_reference?: string | null
          file_url?: string | null
          id?: string
          owner?: string | null
          related_member_id?: string | null
          related_module?: string | null
          related_workplace_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          upload_date?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "amo_documents_related_member_id_fkey"
            columns: ["related_member_id"]
            isOneToOne: false
            referencedRelation: "amo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amo_documents_related_workplace_id_fkey"
            columns: ["related_workplace_id"]
            isOneToOne: false
            referencedRelation: "amo_workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_kemi_apv: {
        Row: {
          created_at: string
          exposure_risk: string | null
          hazard_flag: boolean
          id: string
          instructions: string | null
          next_review_due: string | null
          product_name: string
          product_type: string | null
          protective_measures: string | null
          related_apv_id: string | null
          responsible_owner: string | null
          review_date: string | null
          sds_url: string | null
          storage_notes: string | null
          supplier: string | null
          updated_at: string
          work_process: string | null
        }
        Insert: {
          created_at?: string
          exposure_risk?: string | null
          hazard_flag?: boolean
          id?: string
          instructions?: string | null
          next_review_due?: string | null
          product_name: string
          product_type?: string | null
          protective_measures?: string | null
          related_apv_id?: string | null
          responsible_owner?: string | null
          review_date?: string | null
          sds_url?: string | null
          storage_notes?: string | null
          supplier?: string | null
          updated_at?: string
          work_process?: string | null
        }
        Update: {
          created_at?: string
          exposure_risk?: string | null
          hazard_flag?: boolean
          id?: string
          instructions?: string | null
          next_review_due?: string | null
          product_name?: string
          product_type?: string | null
          protective_measures?: string | null
          related_apv_id?: string | null
          responsible_owner?: string | null
          review_date?: string | null
          sds_url?: string | null
          storage_notes?: string | null
          supplier?: string | null
          updated_at?: string
          work_process?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amo_kemi_apv_related_apv_id_fkey"
            columns: ["related_apv_id"]
            isOneToOne: false
            referencedRelation: "amo_apv"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_meetings: {
        Row: {
          action_items: Json | null
          actual_date: string | null
          agenda: string | null
          attendees: string[] | null
          created_at: string
          decisions: string | null
          id: string
          meeting_type: Database["public"]["Enums"]["amo_meeting_type"]
          minutes_url: string | null
          next_meeting_date: string | null
          planned_date: string
          related_documents: string[] | null
          status: Database["public"]["Enums"]["amo_meeting_status"]
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          actual_date?: string | null
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          decisions?: string | null
          id?: string
          meeting_type?: Database["public"]["Enums"]["amo_meeting_type"]
          minutes_url?: string | null
          next_meeting_date?: string | null
          planned_date: string
          related_documents?: string[] | null
          status?: Database["public"]["Enums"]["amo_meeting_status"]
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          actual_date?: string | null
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          decisions?: string | null
          id?: string
          meeting_type?: Database["public"]["Enums"]["amo_meeting_type"]
          minutes_url?: string | null
          next_meeting_date?: string | null
          planned_date?: string
          related_documents?: string[] | null
          status?: Database["public"]["Enums"]["amo_meeting_status"]
          updated_at?: string
        }
        Relationships: []
      }
      amo_members: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          employee_id: string | null
          end_date: string | null
          full_name: string
          id: string
          notes: string | null
          prior_valid_training: boolean
          role_type: Database["public"]["Enums"]["amo_role_type"]
          start_date: string | null
          training_required: boolean
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          end_date?: string | null
          full_name: string
          id?: string
          notes?: string | null
          prior_valid_training?: boolean
          role_type: Database["public"]["Enums"]["amo_role_type"]
          start_date?: string | null
          training_required?: boolean
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          end_date?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          prior_valid_training?: boolean
          role_type?: Database["public"]["Enums"]["amo_role_type"]
          start_date?: string | null
          training_required?: boolean
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amo_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amo_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amo_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amo_members_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "amo_workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          evidence_required: boolean
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["amo_task_priority"]
          related_module: string | null
          related_record_id: string | null
          reminder_schedule: Json | null
          status: Database["public"]["Enums"]["amo_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidence_required?: boolean
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["amo_task_priority"]
          related_module?: string | null
          related_record_id?: string | null
          reminder_schedule?: Json | null
          status?: Database["public"]["Enums"]["amo_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidence_required?: boolean
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["amo_task_priority"]
          related_module?: string | null
          related_record_id?: string | null
          reminder_schedule?: Json | null
          status?: Database["public"]["Enums"]["amo_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amo_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "amo_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_training_courses: {
        Row: {
          certificate_url: string | null
          completed_date: string | null
          created_at: string
          deadline_date: string | null
          id: string
          member_id: string | null
          membership_start: string | null
          notes: string | null
          offered_date: string | null
          provider: string | null
          requirement_applies: boolean
          status: string
          training_type: Database["public"]["Enums"]["amo_training_type"]
          updated_at: string
        }
        Insert: {
          certificate_url?: string | null
          completed_date?: string | null
          created_at?: string
          deadline_date?: string | null
          id?: string
          member_id?: string | null
          membership_start?: string | null
          notes?: string | null
          offered_date?: string | null
          provider?: string | null
          requirement_applies?: boolean
          status?: string
          training_type: Database["public"]["Enums"]["amo_training_type"]
          updated_at?: string
        }
        Update: {
          certificate_url?: string | null
          completed_date?: string | null
          created_at?: string
          deadline_date?: string | null
          id?: string
          member_id?: string | null
          membership_start?: string | null
          notes?: string | null
          offered_date?: string | null
          provider?: string | null
          requirement_applies?: boolean
          status?: string
          training_type?: Database["public"]["Enums"]["amo_training_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amo_training_courses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "amo_members"
            referencedColumns: ["id"]
          },
        ]
      }
      amo_workplaces: {
        Row: {
          address: string | null
          created_at: string
          employee_count: number
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          employee_count?: number
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          employee_count?: number
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          created_at: string | null
          enabled_sources: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          secrets: Json | null
          sync_frequency_minutes: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled_sources?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          secrets?: Json | null
          sync_frequency_minutes?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled_sources?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          secrets?: Json | null
          sync_frequency_minutes?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          application_date: string
          candidate_id: string
          created_at: string
          deadline: string | null
          id: string
          next_step: string | null
          notes: string | null
          role: string
          source: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          application_date?: string
          candidate_id: string
          created_at?: string
          deadline?: string | null
          id?: string
          next_step?: string | null
          notes?: string | null
          role: string
          source?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          application_date?: string
          candidate_id?: string
          created_at?: string
          deadline?: string | null
          id?: string
          next_step?: string | null
          notes?: string | null
          role?: string
          source?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_manual_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          id: string
          note: string | null
          updated_at: string | null
          updated_by: string | null
          year_month: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string | null
          updated_by?: string | null
          year_month: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string | null
          updated_by?: string | null
          year_month?: string
        }
        Relationships: []
      }
      booking: {
        Row: {
          booked_days: number[] | null
          brand_id: string | null
          campaign_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string | null
          daily_rate_override: number | null
          end_date: string
          expected_staff_count: number | null
          id: string
          location_id: string
          placement_id: string | null
          start_date: string
          status: string
          total_price: number | null
          updated_at: string | null
          week_number: number
          year: number
        }
        Insert: {
          booked_days?: number[] | null
          brand_id?: string | null
          campaign_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          daily_rate_override?: number | null
          end_date: string
          expected_staff_count?: number | null
          id?: string
          location_id: string
          placement_id?: string | null
          start_date: string
          status?: string
          total_price?: number | null
          updated_at?: string | null
          week_number: number
          year: number
        }
        Update: {
          booked_days?: number[] | null
          brand_id?: string | null
          campaign_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          daily_rate_override?: number | null
          end_date?: string
          expected_staff_count?: number | null
          id?: string
          location_id?: string
          placement_id?: string | null
          start_date?: string
          status?: string
          total_price?: number | null
          updated_at?: string | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "location_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_assignment: {
        Row: {
          booking_id: string
          created_at: string | null
          date: string
          employee_id: string
          end_time: string
          id: string
          leads_reported: number | null
          note: string | null
          on_my_way_at: string | null
          sales_reported: number | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          date: string
          employee_id: string
          end_time: string
          id?: string
          leads_reported?: number | null
          note?: string | null
          on_my_way_at?: string | null
          sales_reported?: number | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          date?: string
          employee_id?: string
          end_time?: string
          id?: string
          leads_reported?: number | null
          note?: string | null
          on_my_way_at?: string | null
          sales_reported?: number | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_assignment_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignment_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignment_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignment_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_diet: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          created_by: string | null
          date: string
          employee_id: string
          id: string
          salary_type_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          salary_type_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          salary_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_diet_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_diet_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_diet_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_diet_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_diet_salary_type_id_fkey"
            columns: ["salary_type_id"]
            isOneToOne: false
            referencedRelation: "salary_types"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_flow_criteria: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_flow_enrollments: {
        Row: {
          application_id: string | null
          approval_status: string
          cancelled_at: string | null
          cancelled_reason: string | null
          candidate_id: string
          completed_at: string | null
          created_at: string
          criteria_met: Json | null
          current_day: number
          enrolled_at: string
          id: string
          segmentation_signals: Json | null
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          approval_status?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          criteria_met?: Json | null
          current_day?: number
          enrolled_at?: string
          id?: string
          segmentation_signals?: Json | null
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          approval_status?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          criteria_met?: Json | null
          current_day?: number
          enrolled_at?: string
          id?: string
          segmentation_signals?: Json | null
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_flow_enrollments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_flow_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_flow_steps: {
        Row: {
          channel: string
          content: string
          created_at: string
          day: number
          id: string
          is_active: boolean
          offset_hours: number | null
          phase: string
          sort_order: number
          subject: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          day: number
          id?: string
          is_active?: boolean
          offset_hours?: number | null
          phase?: string
          sort_order?: number
          subject?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          day?: number
          id?: string
          is_active?: boolean
          offset_hours?: number | null
          phase?: string
          sort_order?: number
          subject?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_flow_touchpoints: {
        Row: {
          channel: string
          created_at: string
          day: number
          enrollment_id: string
          error_message: string | null
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          template_key: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          day: number
          enrollment_id: string
          error_message?: string | null
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          day?: number
          enrollment_id?: string
          error_message?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_flow_touchpoints_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "booking_flow_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_hotel: {
        Row: {
          booked_days: number[] | null
          booking_id: string
          check_in: string
          check_in_time: string | null
          check_out: string
          check_out_time: string | null
          confirmation_number: string | null
          created_at: string
          hotel_id: string
          id: string
          notes: string | null
          price_per_night: number | null
          rooms: number
          status: string
        }
        Insert: {
          booked_days?: number[] | null
          booking_id: string
          check_in: string
          check_in_time?: string | null
          check_out: string
          check_out_time?: string | null
          confirmation_number?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          notes?: string | null
          price_per_night?: number | null
          rooms?: number
          status?: string
        }
        Update: {
          booked_days?: number[] | null
          booking_id?: string
          check_in?: string
          check_in_time?: string | null
          check_out?: string
          check_out_time?: string | null
          confirmation_number?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          notes?: string | null
          price_per_night?: number | null
          rooms?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_hotel_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_hotel_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotel"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notification_recipients: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          notify_on_booking: boolean | null
          notify_on_cancel: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          notify_on_booking?: boolean | null
          notify_on_cancel?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          notify_on_booking?: boolean | null
          notify_on_cancel?: boolean | null
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          available_weekdays: number[] | null
          blocked_dates: string[] | null
          day_time_windows: Json | null
          id: string
          lookahead_days: number
          slot_duration_minutes: number
          time_windows: Json | null
          updated_at: string
          work_end_hour: number
          work_start_hour: number
        }
        Insert: {
          available_weekdays?: number[] | null
          blocked_dates?: string[] | null
          day_time_windows?: Json | null
          id?: string
          lookahead_days?: number
          slot_duration_minutes?: number
          time_windows?: Json | null
          updated_at?: string
          work_end_hour?: number
          work_start_hour?: number
        }
        Update: {
          available_weekdays?: number[] | null
          blocked_dates?: string[] | null
          day_time_windows?: Json | null
          id?: string
          lookahead_days?: number
          slot_duration_minutes?: number
          time_windows?: Json | null
          updated_at?: string
          work_end_hour?: number
          work_start_hour?: number
        }
        Relationships: []
      }
      booking_startup_bonus: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          created_by: string | null
          date: string
          employee_id: string
          id: string
          salary_type_id: string
        }
        Insert: {
          amount?: number
          booking_id: string
          created_at?: string | null
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          salary_type_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          salary_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_startup_bonus_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_startup_bonus_salary_type_id_fkey"
            columns: ["salary_type_id"]
            isOneToOne: false
            referencedRelation: "salary_types"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_vehicle: {
        Row: {
          booking_id: string
          created_at: string | null
          date: string
          id: string
          vehicle_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          date: string
          id?: string
          vehicle_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          date?: string
          id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_vehicle_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_vehicle_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      brand: {
        Row: {
          color_hex: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color_hex: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color_hex?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      call_records: {
        Row: {
          candidate_id: string | null
          connected_at: string | null
          direction: string
          duration_seconds: number | null
          employee_id: string | null
          ended_at: string | null
          from_number: string | null
          id: string
          notes: string | null
          recording_url: string | null
          started_at: string
          status: string | null
          to_number: string | null
          twilio_call_sid: string | null
        }
        Insert: {
          candidate_id?: string | null
          connected_at?: string | null
          direction: string
          duration_seconds?: number | null
          employee_id?: string | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string | null
          to_number?: string | null
          twilio_call_sid?: string | null
        }
        Update: {
          candidate_id?: string | null
          connected_at?: string | null
          direction?: string
          duration_seconds?: number | null
          employee_id?: string | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string | null
          to_number?: string | null
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_retention_policies: {
        Row: {
          cleanup_mode: string
          client_campaign_id: string
          created_at: string
          dialer_retention_days: number | null
          id: string
          is_active: boolean
          no_data_held: boolean
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          cleanup_mode?: string
          client_campaign_id: string
          created_at?: string
          dialer_retention_days?: number | null
          id?: string
          is_active?: boolean
          no_data_held?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          cleanup_mode?: string
          client_campaign_id?: string
          created_at?: string
          dialer_retention_days?: number | null
          id?: string
          is_active?: boolean
          no_data_held?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_retention_policies_client_campaign_id_fkey"
            columns: ["client_campaign_id"]
            isOneToOne: true
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_imports: {
        Row: {
          client_id: string
          config_id: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          rows_matched: number | null
          rows_processed: number | null
          status: string
          unmatched_rows: Json | null
          upload_type: string | null
          uploaded_by: string
        }
        Insert: {
          client_id: string
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          rows_matched?: number | null
          rows_processed?: number | null
          status?: string
          unmatched_rows?: Json | null
          upload_type?: string | null
          uploaded_by: string
        }
        Update: {
          client_id?: string
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          rows_matched?: number | null
          rows_processed?: number | null
          status?: string
          unmatched_rows?: Json | null
          upload_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_imports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_imports_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "cancellation_upload_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_product_conditions: {
        Row: {
          client_id: string
          column_name: string
          created_at: string | null
          id: string
          operator: string
          product_id: string
          values: string[]
        }
        Insert: {
          client_id: string
          column_name: string
          created_at?: string | null
          id?: string
          operator?: string
          product_id: string
          values?: string[]
        }
        Update: {
          client_id?: string
          column_name?: string
          created_at?: string | null
          id?: string
          operator?: string
          product_id?: string
          values?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_product_conditions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_product_conditions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_product_mappings: {
        Row: {
          client_id: string
          created_at: string | null
          excel_product_name: string
          id: string
          product_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          excel_product_name: string
          id?: string
          product_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          excel_product_name?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_product_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_queue: {
        Row: {
          client_id: string | null
          created_at: string
          deduction_date: string | null
          id: string
          import_id: string
          opp_group: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sale_id: string
          status: string
          target_product_name: string | null
          upload_type: string
          uploaded_data: Json | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deduction_date?: string | null
          id?: string
          import_id: string
          opp_group?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_id: string
          status?: string
          target_product_name?: string | null
          upload_type?: string
          uploaded_data?: Json | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deduction_date?: string | null
          id?: string
          import_id?: string
          opp_group?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_id?: string
          status?: string
          target_product_name?: string | null
          upload_type?: string
          uploaded_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_queue_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "cancellation_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_queue_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_seller_mappings: {
        Row: {
          client_id: string
          created_at: string | null
          employee_id: string
          excel_seller_name: string
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          employee_id: string
          excel_seller_name: string
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          employee_id?: string
          excel_seller_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_seller_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_seller_mappings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_seller_mappings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_seller_mappings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_upload_configs: {
        Row: {
          client_id: string
          commission_column: string | null
          company_column: string | null
          created_at: string
          date_column: string | null
          fallback_product_mappings: Json | null
          filter_column: string | null
          filter_value: string | null
          id: string
          is_default: boolean | null
          member_number_column: string | null
          name: string
          opp_column: string | null
          phone_column: string | null
          phone_excluded_products: Json | null
          product_columns: string[] | null
          product_match_mode: string
          product_phone_mappings: Json | null
          revenue_column: string | null
          seller_column: string | null
          skip_empty_row_filter: boolean
          type_detection_column: string | null
          type_detection_values: Json | null
        }
        Insert: {
          client_id: string
          commission_column?: string | null
          company_column?: string | null
          created_at?: string
          date_column?: string | null
          fallback_product_mappings?: Json | null
          filter_column?: string | null
          filter_value?: string | null
          id?: string
          is_default?: boolean | null
          member_number_column?: string | null
          name: string
          opp_column?: string | null
          phone_column?: string | null
          phone_excluded_products?: Json | null
          product_columns?: string[] | null
          product_match_mode?: string
          product_phone_mappings?: Json | null
          revenue_column?: string | null
          seller_column?: string | null
          skip_empty_row_filter?: boolean
          type_detection_column?: string | null
          type_detection_values?: Json | null
        }
        Update: {
          client_id?: string
          commission_column?: string | null
          company_column?: string | null
          created_at?: string
          date_column?: string | null
          fallback_product_mappings?: Json | null
          filter_column?: string | null
          filter_value?: string | null
          id?: string
          is_default?: boolean | null
          member_number_column?: string | null
          name?: string
          opp_column?: string | null
          phone_column?: string | null
          phone_excluded_products?: Json | null
          product_columns?: string[] | null
          product_match_mode?: string
          product_phone_mappings?: Json | null
          revenue_column?: string | null
          seller_column?: string | null
          skip_empty_row_filter?: boolean
          type_detection_column?: string | null
          type_detection_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_upload_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_sources: {
        Row: {
          created_at: string | null
          id: string
          label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          application_count: number
          applied_position: string | null
          assigned_to: string | null
          available_from: string | null
          cohort_assignment_status: string | null
          created_at: string
          email: string | null
          fbclid: string | null
          first_name: string
          heard_about_us: string | null
          id: string
          interview_date: string | null
          is_returning_applicant: boolean
          last_name: string
          notes: string | null
          phone: string | null
          postponed_until: string | null
          rating: number | null
          resume_url: string | null
          source: string | null
          status: string
          team_id: string | null
          tier: string | null
          updated_at: string
          winback_contact_date: string | null
        }
        Insert: {
          application_count?: number
          applied_position?: string | null
          assigned_to?: string | null
          available_from?: string | null
          cohort_assignment_status?: string | null
          created_at?: string
          email?: string | null
          fbclid?: string | null
          first_name: string
          heard_about_us?: string | null
          id?: string
          interview_date?: string | null
          is_returning_applicant?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          postponed_until?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          status?: string
          team_id?: string | null
          tier?: string | null
          updated_at?: string
          winback_contact_date?: string | null
        }
        Update: {
          application_count?: number
          applied_position?: string | null
          assigned_to?: string | null
          available_from?: string | null
          cohort_assignment_status?: string | null
          created_at?: string
          email?: string | null
          fbclid?: string | null
          first_name?: string
          heard_about_us?: string | null
          id?: string
          interview_date?: string | null
          is_returning_applicant?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          postponed_until?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          status?: string
          team_id?: string | null
          tier?: string | null
          updated_at?: string
          winback_contact_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      car_quiz_completions: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          passed_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          passed_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          passed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_quiz_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_quiz_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_quiz_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      car_quiz_submissions: {
        Row: {
          answers: Json
          created_at: string
          employee_id: string
          gps_accepted: boolean
          id: string
          ip_address: string | null
          passed: boolean
          submitted_at: string
          summary_accepted: boolean
          user_agent: string | null
        }
        Insert: {
          answers: Json
          created_at?: string
          employee_id: string
          gps_accepted?: boolean
          id?: string
          ip_address?: string | null
          passed?: boolean
          submitted_at?: string
          summary_accepted?: boolean
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          employee_id?: string
          gps_accepted?: boolean
          id?: string
          ip_address?: string | null
          passed?: boolean
          submitted_at?: string
          summary_accepted?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_quiz_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_quiz_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_quiz_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      career_wishes: {
        Row: {
          created_at: string
          desired_team: string | null
          employee_id: string
          id: string
          leadership_interest: Database["public"]["Enums"]["leadership_interest"]
          leadership_motivation: string | null
          leadership_role_type:
            | Database["public"]["Enums"]["leadership_role_type"]
            | null
          other_comments: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          team_change_motivation: string | null
          updated_at: string
          wants_team_change: Database["public"]["Enums"]["team_change_wish"]
        }
        Insert: {
          created_at?: string
          desired_team?: string | null
          employee_id: string
          id?: string
          leadership_interest: Database["public"]["Enums"]["leadership_interest"]
          leadership_motivation?: string | null
          leadership_role_type?:
            | Database["public"]["Enums"]["leadership_role_type"]
            | null
          other_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          team_change_motivation?: string | null
          updated_at?: string
          wants_team_change: Database["public"]["Enums"]["team_change_wish"]
        }
        Update: {
          created_at?: string
          desired_team?: string | null
          employee_id?: string
          id?: string
          leadership_interest?: Database["public"]["Enums"]["leadership_interest"]
          leadership_motivation?: string | null
          leadership_role_type?:
            | Database["public"]["Enums"]["leadership_role_type"]
            | null
          other_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          team_change_motivation?: string | null
          updated_at?: string
          wants_team_change?: Database["public"]["Enums"]["team_change_wish"]
        }
        Relationships: [
          {
            foreignKeyName: "career_wishes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_wishes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_wishes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversation_members: {
        Row: {
          conversation_id: string
          employee_id: string
          id: string
          joined_at: string
          last_read_at: string | null
        }
        Insert: {
          conversation_id: string
          employee_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
        }
        Update: {
          conversation_id?: string
          employee_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversation_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversation_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversation_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          employee_id: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          employee_id: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          employee_id?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_read_receipts: {
        Row: {
          employee_id: string
          id: string
          message_id: string
          read_at: string
        }
        Insert: {
          employee_id: string
          id?: string
          message_id: string
          read_at?: string
        }
        Update: {
          employee_id?: string
          id?: string
          message_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_read_receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_read_receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_read_receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      client_adjustment_percents: {
        Row: {
          cancellation_percent: number
          client_id: string
          created_at: string
          deduction_percent: number
          id: string
          sick_pay_percent: number | null
          updated_at: string
        }
        Insert: {
          cancellation_percent?: number
          client_id: string
          created_at?: string
          deduction_percent?: number
          id?: string
          sick_pay_percent?: number | null
          updated_at?: string
        }
        Update: {
          cancellation_percent?: number
          client_id?: string
          created_at?: string
          deduction_percent?: number
          id?: string
          sick_pay_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_adjustment_percents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_campaigns: {
        Row: {
          client_id: string
          created_at: string | null
          external_adversus_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          external_adversus_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          external_adversus_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_monthly_goals: {
        Row: {
          client_id: string
          created_at: string
          id: string
          month: number
          sales_target: number
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          month: number
          sales_target?: number
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          month?: number
          sales_target?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_monthly_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      closing_shifts: {
        Row: {
          created_at: string
          email: string | null
          employee_name: string | null
          id: string
          phone: string | null
          send_time: string | null
          tasks: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_name?: string | null
          id?: string
          phone?: string | null
          send_time?: string | null
          tasks?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_name?: string | null
          id?: string
          phone?: string | null
          send_time?: string | null
          tasks?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      coaching_feedback: {
        Row: {
          call_id: string | null
          coach_id: string
          created_at: string
          drill_id: string | null
          employee_id: string
          evidence: string | null
          id: string
          is_done: boolean
          next_rep: string
          objection_key: string | null
          reps: number | null
          say_this: string | null
          score: number
          strength: string
          success_criteria: string | null
          template_id: string | null
          type_key: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          call_id?: string | null
          coach_id: string
          created_at?: string
          drill_id?: string | null
          employee_id: string
          evidence?: string | null
          id?: string
          is_done?: boolean
          next_rep: string
          objection_key?: string | null
          reps?: number | null
          say_this?: string | null
          score: number
          strength: string
          success_criteria?: string | null
          template_id?: string | null
          type_key: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          call_id?: string | null
          coach_id?: string
          created_at?: string
          drill_id?: string | null
          employee_id?: string
          evidence?: string | null
          id?: string
          is_done?: boolean
          next_rep?: string
          objection_key?: string | null
          reps?: number | null
          say_this?: string | null
          score?: number
          strength?: string
          success_criteria?: string | null
          template_id?: string | null
          type_key?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_feedback_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "dialer_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "onboarding_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_objection_key_fkey"
            columns: ["objection_key"]
            isOneToOne: false
            referencedRelation: "coaching_objections"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "coaching_feedback_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "coaching_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_feedback_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "coaching_feedback_types"
            referencedColumns: ["key"]
          },
        ]
      }
      coaching_feedback_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label_da: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label_da: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label_da?: string
          sort_order?: number
        }
        Relationships: []
      }
      coaching_objections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label_da: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label_da: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label_da?: string
          sort_order?: number
        }
        Relationships: []
      }
      coaching_templates: {
        Row: {
          created_at: string
          default_score: number | null
          drill_id: string | null
          id: string
          is_active: boolean
          next_rep_default: string
          objection_key: string | null
          reps_default: number
          say_this_default: string | null
          strength_default: string
          success_criteria_default: string | null
          tags: string[] | null
          title: string
          type_key: string
          updated_at: string
          variant: string
          video_url_default: string | null
        }
        Insert: {
          created_at?: string
          default_score?: number | null
          drill_id?: string | null
          id?: string
          is_active?: boolean
          next_rep_default: string
          objection_key?: string | null
          reps_default?: number
          say_this_default?: string | null
          strength_default: string
          success_criteria_default?: string | null
          tags?: string[] | null
          title: string
          type_key: string
          updated_at?: string
          variant?: string
          video_url_default?: string | null
        }
        Update: {
          created_at?: string
          default_score?: number | null
          drill_id?: string | null
          id?: string
          is_active?: boolean
          next_rep_default?: string
          objection_key?: string | null
          reps_default?: number
          say_this_default?: string | null
          strength_default?: string
          success_criteria_default?: string | null
          tags?: string[] | null
          title?: string
          type_key?: string
          updated_at?: string
          variant?: string
          video_url_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_templates_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "onboarding_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_templates_objection_key_fkey"
            columns: ["objection_key"]
            isOneToOne: false
            referencedRelation: "coaching_objections"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "coaching_templates_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "coaching_feedback_types"
            referencedColumns: ["key"]
          },
        ]
      }
      code_of_conduct_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          created_at: string
          employee_id: string
          id: string
          ip_address: string | null
          passed: boolean
          submitted_at: string
          user_agent: string | null
          wrong_question_numbers: number[]
        }
        Insert: {
          answers: Json
          attempt_number?: number
          created_at?: string
          employee_id: string
          id?: string
          ip_address?: string | null
          passed?: boolean
          submitted_at?: string
          user_agent?: string | null
          wrong_question_numbers?: number[]
        }
        Update: {
          answers?: Json
          attempt_number?: number
          created_at?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          passed?: boolean
          submitted_at?: string
          user_agent?: string | null
          wrong_question_numbers?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "code_of_conduct_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_of_conduct_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_of_conduct_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      code_of_conduct_completions: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          passed_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          passed_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          passed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_of_conduct_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_of_conduct_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_of_conduct_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_members: {
        Row: {
          agent_email: string | null
          candidate_id: string | null
          cohort_id: string
          created_at: string
          daily_bonus_client_id: string | null
          employee_id: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_email?: string | null
          candidate_id?: string | null
          cohort_id: string
          created_at?: string
          daily_bonus_client_id?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_email?: string | null
          candidate_id?: string | null
          cohort_id?: string
          created_at?: string
          daily_bonus_client_id?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "onboarding_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_daily_bonus_client_id_fkey"
            columns: ["daily_bonus_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          agent_name: string
          amount: number
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          sale_id: string | null
          source: string | null
          source_reference: string | null
          transaction_type: string
        }
        Insert: {
          agent_name: string
          amount: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          sale_id?: string | null
          source?: string | null
          source_reference?: string | null
          transaction_type: string
        }
        Update: {
          agent_name?: string
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          sale_id?: string | null
          source?: string | null
          source_reference?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_log: {
        Row: {
          booking_id: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string | null
          created_by_employee_id: string
          id: string
          location_id: string | null
          note: string
        }
        Insert: {
          booking_id?: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string | null
          created_by_employee_id: string
          id?: string
          location_id?: string | null
          note: string
        }
        Update: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string | null
          created_by_employee_id?: string
          id?: string
          location_id?: string | null
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          application_id: string | null
          content: string | null
          context_type: string | null
          created_at: string
          direction: string
          id: string
          outcome: string | null
          phone_number: string | null
          read: boolean
          sender_employee_id: string | null
          target_employee_id: string | null
          twilio_sid: string | null
          type: string
        }
        Insert: {
          application_id?: string | null
          content?: string | null
          context_type?: string | null
          created_at?: string
          direction: string
          id?: string
          outcome?: string | null
          phone_number?: string | null
          read?: boolean
          sender_employee_id?: string | null
          target_employee_id?: string | null
          twilio_sid?: string | null
          type: string
        }
        Update: {
          application_id?: string | null
          content?: string | null
          context_type?: string | null
          created_at?: string
          direction?: string
          id?: string
          outcome?: string | null
          phone_number?: string | null
          read?: boolean
          sender_employee_id?: string | null
          target_employee_id?: string | null
          twilio_sid?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sender_employee_id_fkey"
            columns: ["sender_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sender_employee_id_fkey"
            columns: ["sender_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sender_employee_id_fkey"
            columns: ["sender_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      company_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          location: string | null
          requires_registration: boolean
          show_popup: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          location?: string | null
          requires_registration?: boolean
          show_popup?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string | null
          requires_registration?: boolean
          show_popup?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_notification_recipients: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notification_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          consent_type: string
          consented_at: string | null
          employee_id: string
          id: string
          ip_address: string | null
        }
        Insert: {
          consent_type: string
          consented_at?: string | null
          employee_id: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          consent_type?: string
          consented_at?: string | null
          employee_id?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          platform: Database["public"]["Enums"]["content_platform"]
          sort_order: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string | null
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          platform: Database["public"]["Enums"]["content_platform"]
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string | null
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          platform?: Database["public"]["Enums"]["content_platform"]
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string | null
          week_start_date?: string
        }
        Relationships: []
      }
      contract_access_log: {
        Row: {
          access_type: string
          contract_id: string
          created_at: string
          employee_id: string
          id: string
          user_id: string
        }
        Insert: {
          access_type?: string
          contract_id: string
          created_at?: string
          employee_id: string
          id?: string
          user_id: string
        }
        Update: {
          access_type?: string
          contract_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_access_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          acceptance_text: string | null
          contract_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          signed_at: string | null
          signer_email: string | null
          signer_employee_id: string | null
          signer_name: string
          signer_type: string
          user_agent: string | null
        }
        Insert: {
          acceptance_text?: string | null
          contract_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_employee_id?: string | null
          signer_name: string
          signer_type: string
          user_agent?: string | null
        }
        Update: {
          acceptance_text?: string | null
          contract_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_employee_id?: string | null
          signer_name?: string
          signer_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_employee_id_fkey"
            columns: ["signer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_employee_id_fkey"
            columns: ["signer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_employee_id_fkey"
            columns: ["signer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_confidential: boolean
          name: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_confidential?: boolean
          name: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_confidential?: boolean
          name?: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          content: string
          created_at: string | null
          employee_id: string
          expires_at: string | null
          id: string
          is_confidential: boolean | null
          last_reminder_at: string | null
          notes: string | null
          reminder_count: number | null
          sent_at: string | null
          sent_by: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          template_id: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          employee_id: string
          expires_at?: string | null
          id?: string
          is_confidential?: boolean | null
          last_reminder_at?: string | null
          notes?: string | null
          reminder_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          template_id?: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          employee_id?: string
          expires_at?: string | null
          id?: string
          is_confidential?: boolean | null
          last_reminder_at?: string | null
          notes?: string | null
          reminder_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          template_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_inquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          fbclid: string | null
          id: string
          is_read: boolean
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          fbclid?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          fbclid?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      daily_bonus_payouts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          time_stamp_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          time_stamp_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          time_stamp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_bonus_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bonus_payouts_time_stamp_id_fkey"
            columns: ["time_stamp_id"]
            isOneToOne: false
            referencedRelation: "time_stamps"
            referencedColumns: ["id"]
          },
        ]
      }
      danish_holiday: {
        Row: {
          date: string
          id: string
          name: string
          year: number
        }
        Insert: {
          date: string
          id?: string
          name: string
          year: number
        }
        Update: {
          date?: string
          id?: string
          name?: string
          year?: number
        }
        Relationships: []
      }
      dashboard_kpis: {
        Row: {
          base_metric: string | null
          created_at: string
          created_by: string | null
          critical_threshold: number | null
          dashboard_slugs: string[] | null
          data_source: string | null
          decimal_places: number | null
          description: string | null
          display_order: number | null
          formula: string | null
          id: string
          is_active: boolean | null
          kpi_type: string
          multiplier: number | null
          name: string
          symbol: string | null
          symbol_position: string | null
          target_value: number | null
          unit: string | null
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          base_metric?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          dashboard_slugs?: string[] | null
          data_source?: string | null
          decimal_places?: number | null
          description?: string | null
          display_order?: number | null
          formula?: string | null
          id?: string
          is_active?: boolean | null
          kpi_type?: string
          multiplier?: number | null
          name: string
          symbol?: string | null
          symbol_position?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          base_metric?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          dashboard_slugs?: string[] | null
          data_source?: string | null
          decimal_places?: number | null
          description?: string | null
          display_order?: number | null
          formula?: string | null
          id?: string
          is_active?: boolean | null
          kpi_type?: string
          multiplier?: number | null
          name?: string
          symbol?: string | null
          symbol_position?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: []
      }
      data_field_definitions: {
        Row: {
          category: string
          created_at: string
          data_type: string
          description: string | null
          dialer_retention_days: number | null
          display_name: string
          field_key: string
          id: string
          is_hidden: boolean
          is_pii: boolean
          is_required: boolean
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          data_type?: string
          description?: string | null
          dialer_retention_days?: number | null
          display_name: string
          field_key: string
          id?: string
          is_hidden?: boolean
          is_pii?: boolean
          is_required?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          data_type?: string
          description?: string | null
          dialer_retention_days?: number | null
          display_name?: string
          field_key?: string
          id?: string
          is_hidden?: boolean
          is_pii?: boolean
          is_required?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          cleanup_mode: string
          created_at: string
          data_type: string
          display_name: string
          id: string
          is_active: boolean
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          cleanup_mode?: string
          created_at?: string
          data_type: string
          display_name: string
          id?: string
          is_active?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          cleanup_mode?: string
          created_at?: string
          data_type?: string
          display_name?: string
          id?: string
          is_active?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      deactivation_reminder_config: {
        Row: {
          created_at: string
          email_body: string
          email_subject: string
          id: string
          is_active: boolean
          recipients: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_body?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          recipients?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_body?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          recipients?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deactivation_reminder_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deactivation_reminders_sent: {
        Row: {
          created_at: string
          employee_id: string
          followup_sent_at: string | null
          id: string
          initial_sent_at: string
          recipients: string[]
          team_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          followup_sent_at?: string | null
          id?: string
          initial_sent_at?: string
          recipients: string[]
          team_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          followup_sent_at?: string | null
          id?: string
          initial_sent_at?: string
          recipients?: string[]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deactivation_reminders_sent_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deactivation_reminders_sent_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deactivation_reminders_sent_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deactivation_reminders_sent_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_calls: {
        Row: {
          agent_external_id: string
          agent_id: string | null
          campaign_external_id: string
          created_at: string
          dialer_name: string
          duration_seconds: number
          end_time: string
          external_id: string
          id: string
          integration_id: string | null
          integration_type: string
          lead_external_id: string
          metadata: Json | null
          recording_url: string | null
          start_time: string
          status: string
          total_duration_seconds: number
          updated_at: string
        }
        Insert: {
          agent_external_id: string
          agent_id?: string | null
          campaign_external_id: string
          created_at?: string
          dialer_name: string
          duration_seconds?: number
          end_time: string
          external_id: string
          id?: string
          integration_id?: string | null
          integration_type: string
          lead_external_id: string
          metadata?: Json | null
          recording_url?: string | null
          start_time: string
          status: string
          total_duration_seconds?: number
          updated_at?: string
        }
        Update: {
          agent_external_id?: string
          agent_id?: string | null
          campaign_external_id?: string
          created_at?: string
          dialer_name?: string
          duration_seconds?: number
          end_time?: string
          external_id?: string
          id?: string
          integration_id?: string | null
          integration_type?: string
          lead_external_id?: string
          metadata?: Json | null
          recording_url?: string | null
          start_time?: string
          status?: string
          total_duration_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_calls_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_integrations: {
        Row: {
          api_url: string | null
          calls_org_codes: string[] | null
          config: Json | null
          created_at: string | null
          encrypted_credentials: string
          id: string
          is_active: boolean | null
          last_status: string | null
          last_sync_at: string | null
          name: string
          provider: string
          sync_frequency_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          api_url?: string | null
          calls_org_codes?: string[] | null
          config?: Json | null
          created_at?: string | null
          encrypted_credentials: string
          id?: string
          is_active?: boolean | null
          last_status?: string | null
          last_sync_at?: string | null
          name: string
          provider: string
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          api_url?: string | null
          calls_org_codes?: string[] | null
          config?: Json | null
          created_at?: string | null
          encrypted_credentials?: string
          id?: string
          is_active?: boolean | null
          last_status?: string | null
          last_sync_at?: string | null
          name?: string
          provider?: string
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dialer_sessions: {
        Row: {
          agent_external_id: string | null
          campaign_external_id: string | null
          cdr_disposition: string | null
          cdr_duration_seconds: number | null
          created_at: string | null
          end_time: string | null
          external_id: string
          has_cdr: boolean | null
          id: string
          integration_id: string
          lead_external_id: string | null
          metadata: Json | null
          session_seconds: number | null
          source: string
          start_time: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_external_id?: string | null
          campaign_external_id?: string | null
          cdr_disposition?: string | null
          cdr_duration_seconds?: number | null
          created_at?: string | null
          end_time?: string | null
          external_id: string
          has_cdr?: boolean | null
          id?: string
          integration_id: string
          lead_external_id?: string | null
          metadata?: Json | null
          session_seconds?: number | null
          source?: string
          start_time?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          agent_external_id?: string | null
          campaign_external_id?: string | null
          cdr_disposition?: string | null
          cdr_duration_seconds?: number | null
          created_at?: string | null
          end_time?: string | null
          external_id?: string
          has_cdr?: boolean | null
          id?: string
          integration_id?: string
          lead_external_id?: string | null
          metadata?: Json | null
          session_seconds?: number | null
          source?: string
          start_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dialer_sessions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_sync_state: {
        Row: {
          cursor: string | null
          dataset: string
          integration_id: string
          last_error: string | null
          last_error_at: string | null
          last_success_at: string | null
          updated_at: string
        }
        Insert: {
          cursor?: string | null
          dataset: string
          integration_id: string
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Update: {
          cursor?: string | null
          dataset?: string
          integration_id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_sync_state_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_baseline_exclusions: {
        Row: {
          created_at: string | null
          id: string
          kategori_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kategori_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kategori_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_baseline_exclusions_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "economic_kategorier"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_budget_lines: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          kategori_id: string
          month: number
          note: string | null
          team_id: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          kategori_id: string
          month: number
          note?: string | null
          team_id?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          kategori_id?: string
          month?: number
          note?: string | null
          team_id?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "economic_budget_lines_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "economic_kategorier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_budget_lines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_client_mapping: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          match_pattern: string
          note: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          match_pattern: string
          note?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          match_pattern?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_client_mapping_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_fordelingsregler: {
        Row: {
          active_from: string | null
          active_to: string | null
          affected_count: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          kategori_id: string
          match_field: string
          match_operator: string
          match_value: string
          note: string | null
          priority: number
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          active_from?: string | null
          active_to?: string | null
          affected_count?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kategori_id: string
          match_field: string
          match_operator: string
          match_value: string
          note?: string | null
          priority?: number
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active_from?: string | null
          active_to?: string | null
          affected_count?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kategori_id?: string
          match_field?: string
          match_operator?: string
          match_value?: string
          note?: string | null
          priority?: number
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_fordelingsregler_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "economic_kategorier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_fordelingsregler_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_imports: {
        Row: {
          checksum: string | null
          created_at: string | null
          created_by: string | null
          detected_end_date: string | null
          detected_start_date: string | null
          error_message: string | null
          file_name: string | null
          file_size_bytes: number | null
          files_found: string[] | null
          id: string
          processing_time_ms: number | null
          rows_faktura: number | null
          rows_fakturalinjer: number | null
          rows_konto: number | null
          rows_postering: number | null
          status: string | null
          storage_path: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          detected_end_date?: string | null
          detected_start_date?: string | null
          error_message?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          files_found?: string[] | null
          id?: string
          processing_time_ms?: number | null
          rows_faktura?: number | null
          rows_fakturalinjer?: number | null
          rows_konto?: number | null
          rows_postering?: number | null
          status?: string | null
          storage_path: string
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          detected_end_date?: string | null
          detected_start_date?: string | null
          error_message?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          files_found?: string[] | null
          id?: string
          processing_time_ms?: number | null
          rows_faktura?: number | null
          rows_fakturalinjer?: number | null
          rows_konto?: number | null
          rows_postering?: number | null
          status?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      economic_kategorier: {
        Row: {
          beskrivelse: string | null
          created_at: string | null
          default_team_id: string | null
          id: string
          is_active: boolean | null
          is_expense: boolean | null
          navn: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          beskrivelse?: string | null
          created_at?: string | null
          default_team_id?: string | null
          id?: string
          is_active?: boolean | null
          is_expense?: boolean | null
          navn: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          beskrivelse?: string | null
          created_at?: string | null
          default_team_id?: string | null
          id?: string
          is_active?: boolean | null
          is_expense?: boolean | null
          navn?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_kategorier_default_team_id_fkey"
            columns: ["default_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_konto_mapping: {
        Row: {
          active_from: string | null
          active_to: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_auto_suggested: boolean | null
          kategori_id: string
          konto_nr: number
          needs_review: boolean | null
          note: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          active_from?: string | null
          active_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_auto_suggested?: boolean | null
          kategori_id: string
          konto_nr: number
          needs_review?: boolean | null
          note?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active_from?: string | null
          active_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_auto_suggested?: boolean | null
          kategori_id?: string
          konto_nr?: number
          needs_review?: boolean | null
          note?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_konto_mapping_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "economic_kategorier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_konto_mapping_konto_nr_fkey"
            columns: ["konto_nr"]
            isOneToOne: false
            referencedRelation: "economic_kontoplan"
            referencedColumns: ["konto_nr"]
          },
          {
            foreignKeyName: "economic_konto_mapping_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_kontoplan: {
        Row: {
          adgang: number | null
          debet_kredit: string | null
          import_id: string | null
          konto_nr: number
          modkonto: number | null
          momskode: string | null
          navn: string
          noegletalskode: string | null
          note: string | null
          overfoer_primo_til: number | null
          raw_json: Json | null
          sum_fra: number | null
          type: number | null
          updated_at: string | null
        }
        Insert: {
          adgang?: number | null
          debet_kredit?: string | null
          import_id?: string | null
          konto_nr: number
          modkonto?: number | null
          momskode?: string | null
          navn: string
          noegletalskode?: string | null
          note?: string | null
          overfoer_primo_til?: number | null
          raw_json?: Json | null
          sum_fra?: number | null
          type?: number | null
          updated_at?: string | null
        }
        Update: {
          adgang?: number | null
          debet_kredit?: string | null
          import_id?: string | null
          konto_nr?: number
          modkonto?: number | null
          momskode?: string | null
          navn?: string
          noegletalskode?: string | null
          note?: string | null
          overfoer_primo_til?: number | null
          raw_json?: Json | null
          sum_fra?: number | null
          type?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_kontoplan_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "economic_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_posteringer: {
        Row: {
          aktivitets_nr: number | null
          antal: number | null
          antal2: number | null
          beloeb: number | null
          beloeb_dkk: number | null
          bilags_nr: number | null
          dato: string
          enhed1_nr: number | null
          enhed2_nr: number | null
          faktura_nr: number | null
          forfalds_dato: string | null
          import_id: string | null
          konto_nr: number | null
          kunde_nr: number | null
          leverandoer_faktura_nr: string | null
          leverandoer_nr: number | null
          loebe_nr: number
          momskode: string | null
          posterings_type: string | null
          projekt_nr: number | null
          raw_json: Json | null
          tekst: string | null
          updated_at: string | null
          valuta: string | null
        }
        Insert: {
          aktivitets_nr?: number | null
          antal?: number | null
          antal2?: number | null
          beloeb?: number | null
          beloeb_dkk?: number | null
          bilags_nr?: number | null
          dato: string
          enhed1_nr?: number | null
          enhed2_nr?: number | null
          faktura_nr?: number | null
          forfalds_dato?: string | null
          import_id?: string | null
          konto_nr?: number | null
          kunde_nr?: number | null
          leverandoer_faktura_nr?: string | null
          leverandoer_nr?: number | null
          loebe_nr: number
          momskode?: string | null
          posterings_type?: string | null
          projekt_nr?: number | null
          raw_json?: Json | null
          tekst?: string | null
          updated_at?: string | null
          valuta?: string | null
        }
        Update: {
          aktivitets_nr?: number | null
          antal?: number | null
          antal2?: number | null
          beloeb?: number | null
          beloeb_dkk?: number | null
          bilags_nr?: number | null
          dato?: string
          enhed1_nr?: number | null
          enhed2_nr?: number | null
          faktura_nr?: number | null
          forfalds_dato?: string | null
          import_id?: string | null
          konto_nr?: number | null
          kunde_nr?: number | null
          leverandoer_faktura_nr?: string | null
          leverandoer_nr?: number | null
          loebe_nr?: number
          momskode?: string | null
          posterings_type?: string | null
          projekt_nr?: number | null
          raw_json?: Json | null
          tekst?: string | null
          updated_at?: string | null
          valuta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_posteringer_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "economic_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_posteringer_konto_nr_fkey"
            columns: ["konto_nr"]
            isOneToOne: false
            referencedRelation: "economic_kontoplan"
            referencedColumns: ["konto_nr"]
          },
        ]
      }
      email_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee: {
        Row: {
          availability_notes: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["vagt_flow_role"]
          team: string | null
          updated_at: string | null
        }
        Insert: {
          availability_notes?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["vagt_flow_role"]
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          availability_notes?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["vagt_flow_role"]
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_absence: {
        Row: {
          approved_at: string | null
          approved_by_employee_id: string | null
          created_at: string | null
          employee_id: string
          end_date: string
          end_time: string | null
          id: string
          is_full_day: boolean | null
          note: string | null
          reason: Database["public"]["Enums"]["vagt_absence_reason"]
          rejection_reason: string | null
          start_date: string
          start_time: string | null
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_employee_id?: string | null
          created_at?: string | null
          employee_id: string
          end_date: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          note?: string | null
          reason: Database["public"]["Enums"]["vagt_absence_reason"]
          rejection_reason?: string | null
          start_date: string
          start_time?: string | null
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_employee_id?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          note?: string | null
          reason?: Database["public"]["Enums"]["vagt_absence_reason"]
          rejection_reason?: string | null
          start_date?: string
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_absence_approved_by_employee_id_fkey"
            columns: ["approved_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_agent_mapping: {
        Row: {
          agent_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_agent_mapping_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agent_mapping_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agent_mapping_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agent_mapping_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_client_assignments: {
        Row: {
          client_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_client_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_client_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_client_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_dashboards: {
        Row: {
          created_at: string
          design_id: string | null
          employee_id: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          design_id?: string | null
          employee_id: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          design_id?: string | null
          employee_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_dashboards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_dashboards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_dashboards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_identity: {
        Row: {
          created_at: string | null
          id: string
          master_employee_id: string
          source: string
          source_email: string | null
          source_employee_id: string
          source_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          master_employee_id: string
          source: string
          source_email?: string | null
          source_employee_id: string
          source_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          master_employee_id?: string
          source?: string
          source_email?: string | null
          source_employee_id?: string
          source_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_identity_master_employee_id_fkey"
            columns: ["master_employee_id"]
            isOneToOne: false
            referencedRelation: "master_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_invitations: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string
          employee_id: string | null
          expires_at: string
          id: string
          onboarding_completed_at: string | null
          password_set_at: string | null
          status: string
          token: string
          used_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          status?: string
          token: string
          used_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          onboarding_completed_at?: string | null
          password_set_at?: string | null
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_master_data: {
        Row: {
          account_locked: boolean | null
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          auth_user_id: string | null
          avatar_url: string | null
          bank_account_number: string | null
          bank_reg_number: string | null
          contract_id: string | null
          contract_version: string | null
          cpr_number: string | null
          created_at: string | null
          daily_bonus_client_id: string | null
          default_landing_page: string | null
          department: string | null
          employment_end_date: string | null
          employment_start_date: string | null
          expected_monthly_shifts: number | null
          failed_login_count: number | null
          first_name: string
          freelance_company_address: string | null
          freelance_company_name: string | null
          freelance_cvr: string | null
          has_parking: boolean | null
          id: string
          invitation_status: string | null
          is_active: boolean | null
          is_freelance_consultant: boolean | null
          is_staff_employee: boolean
          job_title: string | null
          last_name: string
          last_team_id: string | null
          locked_at: string | null
          manager_id: string | null
          mfa_enabled: boolean | null
          must_change_password: boolean | null
          onboarding_data_complete: boolean | null
          parking_monthly_cost: number | null
          parking_spot_id: string | null
          position_id: string | null
          private_email: string | null
          private_phone: string | null
          referral_bonus: number | null
          referral_code: string | null
          salary_amount: number | null
          salary_deduction: number | null
          salary_deduction_note: string | null
          salary_type: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time: string | null
          system_role_id: string | null
          team_id: string | null
          updated_at: string | null
          vacation_bonus_percent: number | null
          vacation_type: Database["public"]["Enums"]["vacation_type"] | null
          weekly_hours: number | null
          work_email: string | null
          work_location: string | null
          working_hours_model: string | null
        }
        Insert: {
          account_locked?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_reg_number?: string | null
          contract_id?: string | null
          contract_version?: string | null
          cpr_number?: string | null
          created_at?: string | null
          daily_bonus_client_id?: string | null
          default_landing_page?: string | null
          department?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          expected_monthly_shifts?: number | null
          failed_login_count?: number | null
          first_name: string
          freelance_company_address?: string | null
          freelance_company_name?: string | null
          freelance_cvr?: string | null
          has_parking?: boolean | null
          id?: string
          invitation_status?: string | null
          is_active?: boolean | null
          is_freelance_consultant?: boolean | null
          is_staff_employee?: boolean
          job_title?: string | null
          last_name: string
          last_team_id?: string | null
          locked_at?: string | null
          manager_id?: string | null
          mfa_enabled?: boolean | null
          must_change_password?: boolean | null
          onboarding_data_complete?: boolean | null
          parking_monthly_cost?: number | null
          parking_spot_id?: string | null
          position_id?: string | null
          private_email?: string | null
          private_phone?: string | null
          referral_bonus?: number | null
          referral_code?: string | null
          salary_amount?: number | null
          salary_deduction?: number | null
          salary_deduction_note?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time?: string | null
          system_role_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          vacation_bonus_percent?: number | null
          vacation_type?: Database["public"]["Enums"]["vacation_type"] | null
          weekly_hours?: number | null
          work_email?: string | null
          work_location?: string | null
          working_hours_model?: string | null
        }
        Update: {
          account_locked?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_reg_number?: string | null
          contract_id?: string | null
          contract_version?: string | null
          cpr_number?: string | null
          created_at?: string | null
          daily_bonus_client_id?: string | null
          default_landing_page?: string | null
          department?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          expected_monthly_shifts?: number | null
          failed_login_count?: number | null
          first_name?: string
          freelance_company_address?: string | null
          freelance_company_name?: string | null
          freelance_cvr?: string | null
          has_parking?: boolean | null
          id?: string
          invitation_status?: string | null
          is_active?: boolean | null
          is_freelance_consultant?: boolean | null
          is_staff_employee?: boolean
          job_title?: string | null
          last_name?: string
          last_team_id?: string | null
          locked_at?: string | null
          manager_id?: string | null
          mfa_enabled?: boolean | null
          must_change_password?: boolean | null
          onboarding_data_complete?: boolean | null
          parking_monthly_cost?: number | null
          parking_spot_id?: string | null
          position_id?: string | null
          private_email?: string | null
          private_phone?: string | null
          referral_bonus?: number | null
          referral_code?: string | null
          salary_amount?: number | null
          salary_deduction?: number | null
          salary_deduction_note?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time?: string | null
          system_role_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          vacation_bonus_percent?: number | null
          vacation_type?: Database["public"]["Enums"]["vacation_type"] | null
          weekly_hours?: number | null
          work_email?: string | null
          work_location?: string | null
          working_hours_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_master_data_daily_bonus_client_id_fkey"
            columns: ["daily_bonus_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_last_team_id_fkey"
            columns: ["last_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_system_role_id_fkey"
            columns: ["system_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding_progress: {
        Row: {
          checkout_blockers: string[] | null
          checkout_completed: boolean | null
          checkout_confidence: number | null
          completed_at: string | null
          created_at: string
          drill_completed: boolean | null
          employee_id: string
          id: string
          onboarding_day_id: string
          quiz_completed: boolean | null
          quiz_score: number | null
          updated_at: string
          videos_completed: Json | null
        }
        Insert: {
          checkout_blockers?: string[] | null
          checkout_completed?: boolean | null
          checkout_confidence?: number | null
          completed_at?: string | null
          created_at?: string
          drill_completed?: boolean | null
          employee_id: string
          id?: string
          onboarding_day_id: string
          quiz_completed?: boolean | null
          quiz_score?: number | null
          updated_at?: string
          videos_completed?: Json | null
        }
        Update: {
          checkout_blockers?: string[] | null
          checkout_completed?: boolean | null
          checkout_confidence?: number | null
          completed_at?: string | null
          created_at?: string
          drill_completed?: boolean | null
          employee_id?: string
          id?: string
          onboarding_day_id?: string
          quiz_completed?: boolean | null
          quiz_score?: number | null
          updated_at?: string
          videos_completed?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_onboarding_progress_onboarding_day_id_fkey"
            columns: ["onboarding_day_id"]
            isOneToOne: false
            referencedRelation: "onboarding_days"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_referrals: {
        Row: {
          bonus_amount: number | null
          bonus_eligible_date: string | null
          bonus_paid_date: string | null
          candidate_email: string
          candidate_first_name: string
          candidate_last_name: string
          candidate_phone: string | null
          converted_to_candidate_id: string | null
          created_at: string
          hired_date: string | null
          hired_employee_id: string | null
          id: string
          message: string | null
          notes: string | null
          referral_code: string
          referrer_employee_id: string
          referrer_name_provided: string
          status: string
          updated_at: string
        }
        Insert: {
          bonus_amount?: number | null
          bonus_eligible_date?: string | null
          bonus_paid_date?: string | null
          candidate_email: string
          candidate_first_name: string
          candidate_last_name: string
          candidate_phone?: string | null
          converted_to_candidate_id?: string | null
          created_at?: string
          hired_date?: string | null
          hired_employee_id?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          referral_code: string
          referrer_employee_id: string
          referrer_name_provided: string
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_amount?: number | null
          bonus_eligible_date?: string | null
          bonus_paid_date?: string | null
          candidate_email?: string
          candidate_first_name?: string
          candidate_last_name?: string
          candidate_phone?: string | null
          converted_to_candidate_id?: string | null
          created_at?: string
          hired_date?: string | null
          hired_employee_id?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          referral_code?: string
          referrer_employee_id?: string
          referrer_name_provided?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_referrals_converted_to_candidate_id_fkey"
            columns: ["converted_to_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_hired_employee_id_fkey"
            columns: ["hired_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_hired_employee_id_fkey"
            columns: ["hired_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_hired_employee_id_fkey"
            columns: ["hired_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_referrer_employee_id_fkey"
            columns: ["referrer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_referrer_employee_id_fkey"
            columns: ["referrer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_referrals_referrer_employee_id_fkey"
            columns: ["referrer_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_schemes: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          salary_scheme_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          salary_scheme_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          salary_scheme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_schemes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_schemes_salary_scheme_id_fkey"
            columns: ["salary_scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sales_achievements: {
        Row: {
          achievement_type: string
          created_at: string
          employee_id: string
          id: string
          metadata: Json | null
          unlocked_at: string
        }
        Insert: {
          achievement_type: string
          created_at?: string
          employee_id: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string
        }
        Update: {
          achievement_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sales_achievements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_achievements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_achievements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sales_goals: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          period_end: string
          period_start: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          period_end: string
          period_start: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          period_end?: string
          period_start?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sales_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sales_levels: {
        Row: {
          created_at: string
          current_level: number
          employee_id: string
          id: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          employee_id: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: number
          employee_id?: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sales_levels_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_levels_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_levels_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sales_records: {
        Row: {
          achieved_at: string
          created_at: string
          employee_id: string
          id: string
          period_reference: string | null
          record_type: string
          record_value: number
          updated_at: string
        }
        Insert: {
          achieved_at: string
          created_at?: string
          employee_id: string
          id?: string
          period_reference?: string | null
          record_type: string
          record_value: number
          updated_at?: string
        }
        Update: {
          achieved_at?: string
          created_at?: string
          employee_id?: string
          id?: string
          period_reference?: string | null
          record_type?: string
          record_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sales_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sales_streaks: {
        Row: {
          created_at: string
          current_streak: number
          employee_id: string
          id: string
          last_streak_date: string | null
          longest_streak: number
          total_streak_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          employee_id: string
          id?: string
          last_streak_date?: string | null
          longest_streak?: number
          total_streak_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          employee_id?: string
          id?: string
          last_streak_date?: string | null
          longest_streak?: number
          total_streak_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sales_streaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_streaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_sales_streaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_standard_shifts: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_standard_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_standard_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_standard_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_standard_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "team_standard_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_clocks: {
        Row: {
          client_id: string | null
          clock_type: Database["public"]["Enums"]["clock_type"]
          created_at: string
          created_by: string | null
          employee_id: string
          hourly_rate: number
          id: string
          is_active: boolean
        }
        Insert: {
          client_id?: string | null
          clock_type: Database["public"]["Enums"]["clock_type"]
          created_at?: string
          created_by?: string | null
          employee_id: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
        }
        Update: {
          client_id?: string | null
          clock_type?: Database["public"]["Enums"]["clock_type"]
          created_at?: string
          created_by?: string | null
          employee_id?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_clocks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string
          employee_id: string
          event_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          event_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_views: {
        Row: {
          employee_id: string
          event_id: string
          id: string
          seen_at: string
        }
        Insert: {
          employee_id: string
          event_id: string
          id?: string
          seen_at?: string
        }
        Update: {
          employee_id?: string
          event_id?: string
          id?: string
          seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_views_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_views_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_views_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_invitations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          team_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_team_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "company_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_work: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          employee_id: string
          from_time: string
          hours: number | null
          id: string
          reason: string | null
          rejection_reason: string | null
          shift_id: string | null
          status: string
          to_time: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          employee_id: string
          from_time: string
          hours?: number | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          shift_id?: string | null
          status?: string
          to_time: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          from_time?: string
          hours?: number | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          shift_id?: string | null
          status?: string
          to_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_work_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_work_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_login_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      fieldmarketing_sales: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          location_id: string
          phone_number: string
          product_name: string
          registered_at: string
          seller_id: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          location_id: string
          phone_number: string
          product_name: string
          registered_at?: string
          seller_id: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          location_id?: string
          phone_number?: string
          product_name?: string
          registered_at?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fieldmarketing_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fieldmarketing_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fieldmarketing_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fieldmarketing_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fieldmarketing_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          active: boolean | null
          amount: number
          category: string
          created_at: string | null
          end_date: string | null
          frequency: string
          id: number
          notes: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          category: string
          created_at?: string | null
          end_date?: string | null
          frequency: string
          id?: number
          notes?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          category?: string
          created_at?: string | null
          end_date?: string | null
          frequency?: string
          id?: number
          notes?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fm_checklist_completions: {
        Row: {
          completed_by: string
          completed_date: string
          created_at: string
          id: string
          note: string | null
          template_id: string
        }
        Insert: {
          completed_by: string
          completed_date: string
          created_at?: string
          id?: string
          note?: string | null
          template_id: string
        }
        Update: {
          completed_by?: string
          completed_date?: string
          created_at?: string
          id?: string
          note?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fm_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fm_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fm_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fm_checklist_completions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "fm_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fm_checklist_email_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          send_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          send_time?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          send_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fm_checklist_email_recipients: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      fm_checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          one_time_date: string | null
          sort_order: number
          title: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          one_time_date?: string | null
          sort_order?: number
          title: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          one_time_date?: string | null
          sort_order?: number
          title?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "fm_checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fm_checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fm_checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_settings: {
        Row: {
          churn_established_pct: number
          churn_new_pct: number
          client_goal: number
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          month: number
          new_seller_threshold: number
          new_seller_weekly_target: number
          rolling_avg_shifts: number
          sick_pct: number
          team_id: string
          updated_at: string
          vacation_pct: number
          year: number
        }
        Insert: {
          churn_established_pct?: number
          churn_new_pct?: number
          client_goal?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          new_seller_threshold?: number
          new_seller_weekly_target?: number
          rolling_avg_shifts?: number
          sick_pct?: number
          team_id: string
          updated_at?: string
          vacation_pct?: number
          year: number
        }
        Update: {
          churn_established_pct?: number
          churn_new_pct?: number
          client_goal?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          new_seller_threshold?: number
          new_seller_weekly_target?: number
          rolling_avg_shifts?: number
          sick_pct?: number
          team_id?: string
          updated_at?: string
          vacation_pct?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "forecast_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_cleanup_log: {
        Row: {
          action: string
          details: Json | null
          id: string
          records_affected: number
          run_at: string
          triggered_by: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          id?: string
          records_affected?: number
          run_at?: string
          triggered_by?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          records_affected?: number
          run_at?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      gdpr_consents: {
        Row: {
          consent_text: string | null
          consent_type: string
          consented_at: string
          created_at: string
          employee_id: string
          id: string
          ip_address: string | null
          revoked_at: string | null
          user_agent: string | null
        }
        Insert: {
          consent_text?: string | null
          consent_type: string
          consented_at?: string
          created_at?: string
          employee_id: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_text?: string | null
          consent_type?: string
          consented_at?: string
          created_at?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_consents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_consents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_consents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_data_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          export_data: Json | null
          id: string
          notes: string | null
          processed_by: string | null
          request_type: string
          requested_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          export_data?: Json | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          request_type: string
          requested_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          export_data?: Json | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          request_type?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_data_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_data_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_data_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      h2h_challenges: {
        Row: {
          accepted_at: string | null
          battle_mode: string
          challenger_employee_id: string
          challenger_final_commission: number | null
          challenger_final_sales: number | null
          comment: string | null
          completed_at: string | null
          created_at: string
          custom_end_at: string | null
          custom_start_at: string | null
          forfeited_at: string | null
          forfeited_by: string | null
          id: string
          is_draw: boolean | null
          opponent_employee_id: string
          opponent_final_commission: number | null
          opponent_final_sales: number | null
          period: string
          responded_at: string | null
          status: string
          target_commission: number | null
          winner_employee_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          battle_mode?: string
          challenger_employee_id: string
          challenger_final_commission?: number | null
          challenger_final_sales?: number | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          custom_end_at?: string | null
          custom_start_at?: string | null
          forfeited_at?: string | null
          forfeited_by?: string | null
          id?: string
          is_draw?: boolean | null
          opponent_employee_id: string
          opponent_final_commission?: number | null
          opponent_final_sales?: number | null
          period?: string
          responded_at?: string | null
          status?: string
          target_commission?: number | null
          winner_employee_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          battle_mode?: string
          challenger_employee_id?: string
          challenger_final_commission?: number | null
          challenger_final_sales?: number | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          custom_end_at?: string | null
          custom_start_at?: string | null
          forfeited_at?: string | null
          forfeited_by?: string | null
          id?: string
          is_draw?: boolean | null
          opponent_employee_id?: string
          opponent_final_commission?: number | null
          opponent_final_sales?: number | null
          period?: string
          responded_at?: string | null
          status?: string
          target_commission?: number | null
          winner_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "h2h_challenges_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_forfeited_by_fkey"
            columns: ["forfeited_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_forfeited_by_fkey"
            columns: ["forfeited_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_forfeited_by_fkey"
            columns: ["forfeited_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_challenges_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      h2h_employee_stats: {
        Row: {
          created_at: string | null
          current_win_streak: number | null
          draws: number | null
          elo_rating: number | null
          employee_id: string
          id: string
          longest_win_streak: number | null
          losses: number | null
          total_commission_earned: number | null
          total_matches: number | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          current_win_streak?: number | null
          draws?: number | null
          elo_rating?: number | null
          employee_id: string
          id?: string
          longest_win_streak?: number | null
          losses?: number | null
          total_commission_earned?: number | null
          total_matches?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          current_win_streak?: number | null
          draws?: number | null
          elo_rating?: number | null
          employee_id?: string
          id?: string
          longest_win_streak?: number | null
          losses?: number | null
          total_commission_earned?: number | null
          total_matches?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "h2h_employee_stats_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_employee_stats_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "h2h_employee_stats_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      head_to_head_battles: {
        Row: {
          challenger_employee_id: string
          challenger_stats: Json
          challenger_wins: number
          completed_at: string | null
          created_at: string
          id: string
          opponent_employee_id: string
          opponent_stats: Json
          opponent_wins: number
          period_end: string
          period_start: string
          winner_employee_id: string | null
        }
        Insert: {
          challenger_employee_id: string
          challenger_stats?: Json
          challenger_wins?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          opponent_employee_id: string
          opponent_stats?: Json
          opponent_wins?: number
          period_end: string
          period_start: string
          winner_employee_id?: string | null
        }
        Update: {
          challenger_employee_id?: string
          challenger_stats?: Json
          challenger_wins?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          opponent_employee_id?: string
          opponent_stats?: Json
          opponent_wins?: number
          period_end?: string
          period_start?: string
          winner_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "head_to_head_battles_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_challenger_employee_id_fkey"
            columns: ["challenger_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_opponent_employee_id_fkey"
            columns: ["opponent_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_to_head_battles_winner_employee_id_fkey"
            columns: ["winner_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_unmapped_agents: {
        Row: {
          agent_id: string
          hidden_at: string
          hidden_by: string | null
          id: string
        }
        Insert: {
          agent_id: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
        }
        Update: {
          agent_id?: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_unmapped_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_employment: {
        Row: {
          created_at: string | null
          employee_name: string
          end_date: string
          id: string
          start_date: string
          team_name: string
          tenure_days: number | null
        }
        Insert: {
          created_at?: string | null
          employee_name: string
          end_date: string
          id?: string
          start_date: string
          team_name: string
          tenure_days?: number | null
        }
        Update: {
          created_at?: string | null
          employee_name?: string
          end_date?: string
          id?: string
          start_date?: string
          team_name?: string
          tenure_days?: number | null
        }
        Relationships: []
      }
      hotel: {
        Row: {
          address: string | null
          city: string
          created_at: string
          default_price_per_night: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          times_used: number
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          default_price_per_night?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          times_used?: number
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          default_price_per_night?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          times_used?: number
        }
        Relationships: []
      }
      integration_circuit_breaker: {
        Row: {
          consecutive_failures: number
          integration_id: string
          last_error: string | null
          last_failure_at: string | null
          paused_until: string | null
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          integration_id: string
          last_error?: string | null
          last_failure_at?: string | null
          paused_until?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          integration_id?: string
          last_error?: string | null
          last_failure_at?: string | null
          paused_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_circuit_breaker_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_debug_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          provider: string
          raw_items: Json
          registered_items: Json
          skipped_items: Json
          stats: Json | null
          sync_completed_at: string | null
          sync_started_at: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider: string
          raw_items?: Json
          registered_items?: Json
          skipped_items?: Json
          stats?: Json | null
          sync_completed_at?: string | null
          sync_started_at?: string
          sync_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          raw_items?: Json
          registered_items?: Json
          skipped_items?: Json
          stats?: Json | null
          sync_completed_at?: string | null
          sync_started_at?: string
          sync_type?: string
        }
        Relationships: []
      }
      integration_field_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          is_excluded: boolean
          sample_value: string | null
          source_field_path: string
          target_field_id: string | null
          transform_rule: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          is_excluded?: boolean
          sample_value?: string | null
          source_field_path: string
          target_field_id?: string | null
          transform_rule?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          is_excluded?: boolean
          sample_value?: string | null
          source_field_path?: string
          target_field_id?: string | null
          transform_rule?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_field_mappings_target_field_id_fkey"
            columns: ["target_field_id"]
            isOneToOne: false
            referencedRelation: "data_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          api_calls: number | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          integration_id: string | null
          integration_name: string | null
          integration_type: string
          message: string
          rate_limit_hits: number | null
          retries: number | null
          status: string
        }
        Insert: {
          api_calls?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          integration_type: string
          message: string
          rate_limit_hits?: number | null
          retries?: number | null
          status: string
        }
        Update: {
          api_calls?: number | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          integration_type?: string
          message?: string
          rate_limit_hits?: number | null
          retries?: number | null
          status?: string
        }
        Relationships: []
      }
      integration_run_locks: {
        Row: {
          created_at: string
          expires_at: string
          integration_id: string
          locked_at: string
          locked_by: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          integration_id: string
          locked_at?: string
          locked_by: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          integration_id?: string
          locked_at?: string
          locked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_run_locks_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_schedule_audit: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          integration_id: string | null
          new_config: Json | null
          new_schedule: string | null
          old_config: Json | null
          old_schedule: string | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          integration_id?: string | null
          new_config?: Json | null
          new_schedule?: string | null
          old_config?: Json | null
          old_schedule?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          integration_id?: string | null
          new_config?: Json | null
          new_schedule?: string | null
          old_config?: Json | null
          old_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_schedule_audit_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          actions: string[] | null
          api_calls_made: number | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          integration_id: string | null
          rate_limit_daily_limit: number | null
          rate_limit_hits: number | null
          rate_limit_remaining: number | null
          rate_limit_reset: number | null
          records_processed: number | null
          retries: number | null
          run_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          actions?: string[] | null
          api_calls_made?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          rate_limit_daily_limit?: number | null
          rate_limit_hits?: number | null
          rate_limit_remaining?: number | null
          rate_limit_reset?: number | null
          records_processed?: number | null
          retries?: number | null
          run_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          actions?: string[] | null
          api_calls_made?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          rate_limit_daily_limit?: number | null
          rate_limit_hits?: number | null
          rate_limit_remaining?: number | null
          rate_limit_reset?: number | null
          records_processed?: number | null
          retries?: number | null
          run_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          created_at: string | null
          default_landing_page: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_session_hours: number | null
          name: string
          permissions: Json
          requires_mfa: boolean | null
          session_timeout_minutes: number | null
          system_role_key: string | null
          trusted_ip_ranges: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_landing_page?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_session_hours?: number | null
          name: string
          permissions?: Json
          requires_mfa?: boolean | null
          session_timeout_minutes?: number | null
          system_role_key?: string | null
          trusted_ip_ranges?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_landing_page?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_session_hours?: number | null
          name?: string
          permissions?: Json
          requires_mfa?: boolean | null
          session_timeout_minutes?: number | null
          system_role_key?: string | null
          trusted_ip_ranges?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_positions_system_role_key_fkey"
            columns: ["system_role_key"]
            isOneToOne: false
            referencedRelation: "system_role_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      kpi_cached_values: {
        Row: {
          calculated_at: string
          created_at: string
          formatted_value: string | null
          id: string
          kpi_slug: string
          period_type: string
          scope_id: string | null
          scope_type: string
          updated_at: string
          value: number
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          formatted_value?: string | null
          id?: string
          kpi_slug: string
          period_type: string
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          calculated_at?: string
          created_at?: string
          formatted_value?: string | null
          id?: string
          kpi_slug?: string
          period_type?: string
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      kpi_definitions: {
        Row: {
          calculation_formula: string | null
          category: string
          created_at: string | null
          dashboard_slugs: string[] | null
          data_sources: string[] | null
          description: string | null
          example_value: string | null
          id: string
          important_notes: string[] | null
          is_active: boolean | null
          name: string
          slug: string
          sql_query: string | null
          updated_at: string | null
        }
        Insert: {
          calculation_formula?: string | null
          category: string
          created_at?: string | null
          dashboard_slugs?: string[] | null
          data_sources?: string[] | null
          description?: string | null
          example_value?: string | null
          id?: string
          important_notes?: string[] | null
          is_active?: boolean | null
          name: string
          slug: string
          sql_query?: string | null
          updated_at?: string | null
        }
        Update: {
          calculation_formula?: string | null
          category?: string
          created_at?: string | null
          dashboard_slugs?: string[] | null
          data_sources?: string[] | null
          description?: string | null
          example_value?: string | null
          id?: string
          important_notes?: string[] | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sql_query?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kpi_dual_read_compare: {
        Row: {
          commission_delta_pct: number
          contract_version: string
          created_at: string
          id: string
          legacy_commission: number
          legacy_data_as_of: string
          legacy_revenue: number
          legacy_sales: number
          period_type: string
          revenue_delta_pct: number
          sales_delta_pct: number
          scope_id: string | null
          scope_type: string
          unified_commission: number
          unified_data_as_of: string
          unified_revenue: number
          unified_sales: number
        }
        Insert: {
          commission_delta_pct: number
          contract_version: string
          created_at?: string
          id?: string
          legacy_commission: number
          legacy_data_as_of: string
          legacy_revenue: number
          legacy_sales: number
          period_type: string
          revenue_delta_pct: number
          sales_delta_pct: number
          scope_id?: string | null
          scope_type: string
          unified_commission: number
          unified_data_as_of: string
          unified_revenue: number
          unified_sales: number
        }
        Update: {
          commission_delta_pct?: number
          contract_version?: string
          created_at?: string
          id?: string
          legacy_commission?: number
          legacy_data_as_of?: string
          legacy_revenue?: number
          legacy_sales?: number
          period_type?: string
          revenue_delta_pct?: number
          sales_delta_pct?: number
          scope_id?: string | null
          scope_type?: string
          unified_commission?: number
          unified_data_as_of?: string
          unified_revenue?: number
          unified_sales?: number
        }
        Relationships: []
      }
      kpi_health_snapshots: {
        Row: {
          contract_version: string
          created_at: string
          data_as_of: string
          freshness_lag_seconds: number
          id: string
          period_type: string
          scope_id: string | null
          scope_type: string
          source: string
          total_commission: number
          total_revenue: number
          total_sales: number
        }
        Insert: {
          contract_version: string
          created_at?: string
          data_as_of: string
          freshness_lag_seconds?: number
          id?: string
          period_type: string
          scope_id?: string | null
          scope_type: string
          source: string
          total_commission?: number
          total_revenue?: number
          total_sales?: number
        }
        Update: {
          contract_version?: string
          created_at?: string
          data_as_of?: string
          freshness_lag_seconds?: number
          id?: string
          period_type?: string
          scope_id?: string | null
          scope_type?: string
          source?: string
          total_commission?: number
          total_revenue?: number
          total_sales?: number
        }
        Relationships: []
      }
      kpi_leaderboard_cache: {
        Row: {
          calculated_at: string
          created_at: string | null
          id: string
          leaderboard_data: Json
          period_type: string
          scope_id: string | null
          scope_type: string
          updated_at: string | null
        }
        Insert: {
          calculated_at?: string
          created_at?: string | null
          id?: string
          leaderboard_data?: Json
          period_type: string
          scope_id?: string | null
          scope_type?: string
          updated_at?: string | null
        }
        Update: {
          calculated_at?: string
          created_at?: string | null
          id?: string
          leaderboard_data?: Json
          period_type?: string
          scope_id?: string | null
          scope_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kpi_period_snapshots: {
        Row: {
          formatted_value: string | null
          id: string
          kpi_slug: string
          period_end: string
          period_key: string
          period_start: string
          scope_id: string | null
          scope_type: string
          snapshotted_at: string
          value: number
        }
        Insert: {
          formatted_value?: string | null
          id?: string
          kpi_slug: string
          period_end: string
          period_key: string
          period_start: string
          scope_id?: string | null
          scope_type: string
          snapshotted_at?: string
          value?: number
        }
        Update: {
          formatted_value?: string | null
          id?: string
          kpi_slug?: string
          period_end?: string
          period_key?: string
          period_start?: string
          scope_id?: string | null
          scope_type?: string
          snapshotted_at?: string
          value?: number
        }
        Relationships: []
      }
      kpi_reconcile_schedule: {
        Row: {
          cadence: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          lookback_window: string
          reconcile_mode: string
          schedule_name: string
          updated_at: string
        }
        Insert: {
          cadence: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          lookback_window: string
          reconcile_mode: string
          schedule_name: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          lookback_window?: string
          reconcile_mode?: string
          schedule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpi_watermarks: {
        Row: {
          id: string
          last_processed_at: string
          period_type: string
          scope_id: string | null
          scope_type: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_processed_at?: string
          period_type: string
          scope_id?: string | null
          scope_type: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_processed_at?: string
          period_type?: string
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lateness_record: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          minutes: number
          new_start_time: string | null
          note: string | null
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          minutes?: number
          new_start_time?: string | null
          note?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          minutes?: number
          new_start_time?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lateness_record_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lateness_record_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lateness_record_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      league_enrollments: {
        Row: {
          employee_id: string
          enrolled_at: string | null
          id: string
          is_active: boolean | null
          is_spectator: boolean
          season_id: string
        }
        Insert: {
          employee_id: string
          enrolled_at?: string | null
          id?: string
          is_active?: boolean | null
          is_spectator?: boolean
          season_id: string
        }
        Update: {
          employee_id?: string
          enrolled_at?: string | null
          id?: string
          is_active?: boolean | null
          is_spectator?: boolean
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_enrollments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_qualification_standings: {
        Row: {
          current_provision: number | null
          deals_count: number | null
          employee_id: string
          id: string
          last_calculated_at: string | null
          overall_rank: number
          previous_overall_rank: number | null
          projected_division: number
          projected_rank: number
          season_id: string
        }
        Insert: {
          current_provision?: number | null
          deals_count?: number | null
          employee_id: string
          id?: string
          last_calculated_at?: string | null
          overall_rank?: number
          previous_overall_rank?: number | null
          projected_division?: number
          projected_rank?: number
          season_id: string
        }
        Update: {
          current_provision?: number | null
          deals_count?: number | null
          employee_id?: string
          id?: string
          last_calculated_at?: string | null
          overall_rank?: number
          previous_overall_rank?: number | null
          projected_division?: number
          projected_rank?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_qualification_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_qualification_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_qualification_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_qualification_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_round_standings: {
        Row: {
          created_at: string
          cumulative_points: number
          division: number
          employee_id: string
          id: string
          movement: string
          points_earned: number
          rank_in_division: number
          round_id: string
          season_id: string
          weekly_deals: number
          weekly_provision: number
        }
        Insert: {
          created_at?: string
          cumulative_points?: number
          division: number
          employee_id: string
          id?: string
          movement?: string
          points_earned?: number
          rank_in_division: number
          round_id: string
          season_id: string
          weekly_deals?: number
          weekly_provision?: number
        }
        Update: {
          created_at?: string
          cumulative_points?: number
          division?: number
          employee_id?: string
          id?: string
          movement?: string
          points_earned?: number
          rank_in_division?: number
          round_id?: string
          season_id?: string
          weekly_deals?: number
          weekly_provision?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_round_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_round_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_round_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_round_standings_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "league_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_round_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_rounds: {
        Row: {
          created_at: string
          end_date: string
          id: string
          round_number: number
          season_id: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          round_number: number
          season_id: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          round_number?: number
          season_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_season_standings: {
        Row: {
          current_division: number
          division_rank: number
          employee_id: string
          id: string
          overall_rank: number
          previous_division: number | null
          rounds_played: number
          season_id: string
          total_points: number
          total_provision: number
          updated_at: string
        }
        Insert: {
          current_division?: number
          division_rank?: number
          employee_id: string
          id?: string
          overall_rank?: number
          previous_division?: number | null
          rounds_played?: number
          season_id: string
          total_points?: number
          total_provision?: number
          updated_at?: string
        }
        Update: {
          current_division?: number
          division_rank?: number
          employee_id?: string
          id?: string
          overall_rank?: number
          previous_division?: number | null
          rounds_played?: number
          season_id?: string
          total_points?: number
          total_provision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_season_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_season_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_season_standings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_seasons: {
        Row: {
          config: Json | null
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          qualification_end_at: string
          qualification_source_end: string
          qualification_source_start: string
          qualification_start_at: string
          season_number: number
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          qualification_end_at: string
          qualification_source_end: string
          qualification_source_start: string
          qualification_start_at: string
          season_number: number
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          qualification_end_at?: string
          qualification_source_end?: string
          qualification_source_start?: string
          qualification_start_at?: string
          season_number?: number
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      location: {
        Row: {
          address_city: string | null
          address_postal_code: string | null
          address_street: string | null
          available_after_date: string | null
          bookable_client_ids: string[] | null
          can_book_eesy: boolean | null
          can_book_yousee: boolean | null
          client_campaign_mapping: Json | null
          contact_email: string | null
          contact_person_name: string | null
          contact_phone: string | null
          cooldown_weeks: number | null
          created_at: string | null
          daily_rate: number | null
          external_id: string | null
          id: string
          is_favorite: boolean | null
          name: string
          notes: string | null
          region: string | null
          status: Database["public"]["Enums"]["location_status"] | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          available_after_date?: string | null
          bookable_client_ids?: string[] | null
          can_book_eesy?: boolean | null
          can_book_yousee?: boolean | null
          client_campaign_mapping?: Json | null
          contact_email?: string | null
          contact_person_name?: string | null
          contact_phone?: string | null
          cooldown_weeks?: number | null
          created_at?: string | null
          daily_rate?: number | null
          external_id?: string | null
          id?: string
          is_favorite?: boolean | null
          name: string
          notes?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["location_status"] | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          available_after_date?: string | null
          bookable_client_ids?: string[] | null
          can_book_eesy?: boolean | null
          can_book_yousee?: boolean | null
          client_campaign_mapping?: Json | null
          contact_email?: string | null
          contact_person_name?: string | null
          contact_phone?: string | null
          cooldown_weeks?: number | null
          created_at?: string | null
          daily_rate?: number | null
          external_id?: string | null
          id?: string
          is_favorite?: boolean | null
          name?: string
          notes?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["location_status"] | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      location_placements: {
        Row: {
          created_at: string | null
          daily_rate: number
          id: string
          location_id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          daily_rate?: number
          id?: string
          location_id: string
          name: string
        }
        Update: {
          created_at?: string | null
          daily_rate?: number
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_placements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          session_id: string | null
          user_agent: string | null
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      master_employee: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          primary_email: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          primary_email?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          primary_email?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          candidate_id: string | null
          content: string
          created_at: string
          direction: string
          employee_id: string | null
          id: string
          message_type: string
          phone_number: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          candidate_id?: string | null
          content: string
          created_at?: string
          direction: string
          employee_id?: string | null
          id?: string
          message_type?: string
          phone_number?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          candidate_id?: string | null
          content?: string
          created_at?: string
          direction?: string
          employee_id?: string | null
          id?: string
          message_type?: string
          phone_number?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_report: {
        Row: {
          booking_id: string | null
          created_at: string | null
          date: string
          employee_id: string
          end_km: number
          id: string
          route_description: string | null
          start_km: number
          vehicle_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          date: string
          employee_id: string
          end_km: number
          id?: string
          route_description?: string | null
          start_km: number
          vehicle_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string
          end_km?: number
          id?: string
          route_description?: string | null
          start_km?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mileage_report_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_report_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_report_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_coaching_tasks: {
        Row: {
          assigned_drill_id: string | null
          call_id: string | null
          call_timestamp: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          improvement: string | null
          leader_id: string | null
          onboarding_day_id: string
          score: number | null
          status: string
          strength: string | null
          suggested_phrase: string | null
          updated_at: string
        }
        Insert: {
          assigned_drill_id?: string | null
          call_id?: string | null
          call_timestamp?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          improvement?: string | null
          leader_id?: string | null
          onboarding_day_id: string
          score?: number | null
          status?: string
          strength?: string | null
          suggested_phrase?: string | null
          updated_at?: string
        }
        Update: {
          assigned_drill_id?: string | null
          call_id?: string | null
          call_timestamp?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          improvement?: string | null
          leader_id?: string | null
          onboarding_day_id?: string
          score?: number | null
          status?: string
          strength?: string | null
          suggested_phrase?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_coaching_tasks_assigned_drill_id_fkey"
            columns: ["assigned_drill_id"]
            isOneToOne: false
            referencedRelation: "onboarding_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_coaching_tasks_onboarding_day_id_fkey"
            columns: ["onboarding_day_id"]
            isOneToOne: false
            referencedRelation: "onboarding_days"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_cohorts: {
        Row: {
          client_campaign: string | null
          created_at: string
          created_by: string | null
          daily_bonus_client_id: string | null
          id: string
          location: string | null
          max_capacity: number | null
          name: string
          notes: string | null
          start_date: string
          start_time: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          client_campaign?: string | null
          created_at?: string
          created_by?: string | null
          daily_bonus_client_id?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          name: string
          notes?: string | null
          start_date: string
          start_time?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          client_campaign?: string | null
          created_at?: string
          created_by?: string | null
          daily_bonus_client_id?: string | null
          id?: string
          location?: string | null
          max_capacity?: number | null
          name?: string
          notes?: string | null
          start_date?: string
          start_time?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_cohorts_daily_bonus_client_id_fkey"
            columns: ["daily_bonus_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_cohorts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_days: {
        Row: {
          call_mission: string | null
          checkout_blockers: string[] | null
          checkout_confidence_scale: boolean | null
          coaching_focus_only: boolean | null
          coaching_required: boolean | null
          coaching_reviews_per_rep: number | null
          coaching_schedule_tag: string | null
          created_at: string
          daily_message: string | null
          day: number
          drill_duration_min: number | null
          drill_id: string | null
          drill_title: string | null
          focus_description: string | null
          focus_id: string
          focus_title: string
          id: string
          is_active: boolean | null
          leader_course_duration_min: number | null
          leader_course_ppt_id: string | null
          leader_course_title: string | null
          leader_script: string | null
          quiz_pass_score: number | null
          quiz_questions: number | null
          updated_at: string
          videos: Json
          week: number
        }
        Insert: {
          call_mission?: string | null
          checkout_blockers?: string[] | null
          checkout_confidence_scale?: boolean | null
          coaching_focus_only?: boolean | null
          coaching_required?: boolean | null
          coaching_reviews_per_rep?: number | null
          coaching_schedule_tag?: string | null
          created_at?: string
          daily_message?: string | null
          day: number
          drill_duration_min?: number | null
          drill_id?: string | null
          drill_title?: string | null
          focus_description?: string | null
          focus_id: string
          focus_title: string
          id?: string
          is_active?: boolean | null
          leader_course_duration_min?: number | null
          leader_course_ppt_id?: string | null
          leader_course_title?: string | null
          leader_script?: string | null
          quiz_pass_score?: number | null
          quiz_questions?: number | null
          updated_at?: string
          videos?: Json
          week: number
        }
        Update: {
          call_mission?: string | null
          checkout_blockers?: string[] | null
          checkout_confidence_scale?: boolean | null
          coaching_focus_only?: boolean | null
          coaching_required?: boolean | null
          coaching_reviews_per_rep?: number | null
          coaching_schedule_tag?: string | null
          created_at?: string
          daily_message?: string | null
          day?: number
          drill_duration_min?: number | null
          drill_id?: string | null
          drill_title?: string | null
          focus_description?: string | null
          focus_id?: string
          focus_title?: string
          id?: string
          is_active?: boolean | null
          leader_course_duration_min?: number | null
          leader_course_ppt_id?: string | null
          leader_course_title?: string | null
          leader_script?: string | null
          quiz_pass_score?: number | null
          quiz_questions?: number | null
          updated_at?: string
          videos?: Json
          week?: number
        }
        Relationships: []
      }
      onboarding_drills: {
        Row: {
          common_mistakes: Json | null
          created_at: string
          description: string | null
          duration_min: number | null
          focus: string
          id: string
          reps: number | null
          script_snippets: Json | null
          setup: string | null
          steps: Json | null
          success_criteria: Json | null
          title: string
          variants: Json | null
          when_to_use: string | null
        }
        Insert: {
          common_mistakes?: Json | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          focus: string
          id: string
          reps?: number | null
          script_snippets?: Json | null
          setup?: string | null
          steps?: Json | null
          success_criteria?: Json | null
          title: string
          variants?: Json | null
          when_to_use?: string | null
        }
        Update: {
          common_mistakes?: Json | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          focus?: string
          id?: string
          reps?: number | null
          script_snippets?: Json | null
          setup?: string | null
          steps?: Json | null
          success_criteria?: Json | null
          title?: string
          variants?: Json | null
          when_to_use?: string | null
        }
        Relationships: []
      }
      onboarding_week_expectations: {
        Row: {
          color: string
          created_at: string
          daily_message: string
          do_not_measure_on: string[]
          good_day_definition: string
          good_week_criteria: string[]
          id: string
          measure_on: string[]
          note: string | null
          progression_text: string
          title: string
          updated_at: string
          we_dont_expect: string[]
          we_expect: string[]
          week_number: number
        }
        Insert: {
          color?: string
          created_at?: string
          daily_message: string
          do_not_measure_on?: string[]
          good_day_definition: string
          good_week_criteria?: string[]
          id?: string
          measure_on?: string[]
          note?: string | null
          progression_text: string
          title: string
          updated_at?: string
          we_dont_expect?: string[]
          we_expect?: string[]
          week_number: number
        }
        Update: {
          color?: string
          created_at?: string
          daily_message?: string
          do_not_measure_on?: string[]
          good_day_definition?: string
          good_week_criteria?: string[]
          id?: string
          measure_on?: string[]
          note?: string | null
          progression_text?: string
          title?: string
          updated_at?: string
          we_dont_expect?: string[]
          we_expect?: string[]
          week_number?: number
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          employee_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          employee_id: string
          expires_at?: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          employee_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_error_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          employee_id: string
          error_date_end: string | null
          error_date_start: string | null
          id: string
          payroll_period_end: string
          payroll_period_start: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          employee_id: string
          error_date_end?: string | null
          error_date_start?: string | null
          id?: string
          payroll_period_end: string
          payroll_period_start: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          employee_id?: string
          error_date_end?: string | null
          error_date_start?: string | null
          id?: string
          payroll_period_end?: string
          payroll_period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_error_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_error_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_error_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          rating: string
          recruitment_employee_id: string
          review_date: string
          review_period: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          rating: string
          recruitment_employee_id: string
          review_date?: string
          review_period: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          rating?: string
          recruitment_employee_id?: string
          review_date?: string
          review_period?: number
        }
        Relationships: []
      }
      personnel_salaries: {
        Row: {
          created_at: string
          employee_id: string
          hourly_rate: number | null
          hours_source: string | null
          id: string
          is_active: boolean | null
          minimum_salary: number | null
          monthly_salary: number | null
          notes: string | null
          percentage_rate: number | null
          salary_type: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          hourly_rate?: number | null
          hours_source?: string | null
          id?: string
          is_active?: boolean | null
          minimum_salary?: number | null
          monthly_salary?: number | null
          notes?: string | null
          percentage_rate?: number | null
          salary_type: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          hourly_rate?: number | null
          hours_source?: string | null
          id?: string
          is_active?: boolean | null
          minimum_salary?: number | null
          monthly_salary?: number | null
          notes?: string | null
          percentage_rate?: number | null
          salary_type?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      powerdag_events: {
        Row: {
          created_at: string
          event_date: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          event_date?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      powerdag_point_rules: {
        Row: {
          created_at: string
          display_order: number
          event_id: string
          id: string
          points_per_sale: number
          sub_client_name: string | null
          team_name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          event_id: string
          id?: string
          points_per_sale?: number
          sub_client_name?: string | null
          team_name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          event_id?: string
          id?: string
          points_per_sale?: number
          sub_client_name?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "powerdag_point_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "powerdag_events"
            referencedColumns: ["id"]
          },
        ]
      }
      powerdag_scores: {
        Row: {
          event_id: string
          id: string
          rule_id: string
          sales_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          id?: string
          rule_id: string
          sales_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          rule_id?: string
          sales_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "powerdag_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "powerdag_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "powerdag_scores_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "powerdag_point_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rule_history: {
        Row: {
          allows_immediate_payment: boolean | null
          campaign_mapping_ids: string[] | null
          change_type: string | null
          changed_at: string | null
          changed_by: string | null
          commission_dkk: number | null
          conditions: Json | null
          effective_from: string | null
          effective_to: string | null
          id: string
          immediate_payment_commission_dkk: number | null
          immediate_payment_revenue_dkk: number | null
          is_active: boolean | null
          name: string | null
          pricing_rule_id: string | null
          priority: number | null
          revenue_dkk: number | null
        }
        Insert: {
          allows_immediate_payment?: boolean | null
          campaign_mapping_ids?: string[] | null
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          commission_dkk?: number | null
          conditions?: Json | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          immediate_payment_commission_dkk?: number | null
          immediate_payment_revenue_dkk?: number | null
          is_active?: boolean | null
          name?: string | null
          pricing_rule_id?: string | null
          priority?: number | null
          revenue_dkk?: number | null
        }
        Update: {
          allows_immediate_payment?: boolean | null
          campaign_mapping_ids?: string[] | null
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          commission_dkk?: number | null
          conditions?: Json | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          immediate_payment_commission_dkk?: number | null
          immediate_payment_revenue_dkk?: number | null
          is_active?: boolean | null
          name?: string | null
          pricing_rule_id?: string | null
          priority?: number | null
          revenue_dkk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rule_history_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "product_pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      product_campaign_overrides: {
        Row: {
          campaign_mapping_id: string
          commission_dkk: number | null
          created_at: string
          id: string
          product_id: string
          revenue_dkk: number | null
          updated_at: string
        }
        Insert: {
          campaign_mapping_id: string
          commission_dkk?: number | null
          created_at?: string
          id?: string
          product_id: string
          revenue_dkk?: number | null
          updated_at?: string
        }
        Update: {
          campaign_mapping_id?: string
          commission_dkk?: number | null
          created_at?: string
          id?: string
          product_id?: string
          revenue_dkk?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_campaign_overrides_campaign_mapping_id_fkey"
            columns: ["campaign_mapping_id"]
            isOneToOne: false
            referencedRelation: "adversus_campaign_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_campaign_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_change_log: {
        Row: {
          cancellation_queue_id: string | null
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_commission: number | null
          new_product_id: string | null
          new_product_name: string | null
          new_revenue: number | null
          old_commission: number | null
          old_product_id: string | null
          old_product_name: string | null
          old_revenue: number | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          sale_id: string
          sale_item_id: string
        }
        Insert: {
          cancellation_queue_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_commission?: number | null
          new_product_id?: string | null
          new_product_name?: string | null
          new_revenue?: number | null
          old_commission?: number | null
          old_product_id?: string | null
          old_product_name?: string | null
          old_revenue?: number | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          sale_id: string
          sale_item_id: string
        }
        Update: {
          cancellation_queue_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_commission?: number | null
          new_product_id?: string | null
          new_product_name?: string | null
          new_revenue?: number | null
          old_commission?: number | null
          old_product_id?: string | null
          old_product_name?: string | null
          old_revenue?: number | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          sale_id?: string
          sale_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_change_log_cancellation_queue_id_fkey"
            columns: ["cancellation_queue_id"]
            isOneToOne: false
            referencedRelation: "cancellation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_change_log_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_merge_history: {
        Row: {
          adversus_mappings_moved: number | null
          id: string
          merged_at: string
          merged_by: string | null
          pricing_rules_moved: number | null
          sale_items_moved: number | null
          source_product_id: string
          source_product_name: string | null
          target_product_id: string
        }
        Insert: {
          adversus_mappings_moved?: number | null
          id?: string
          merged_at?: string
          merged_by?: string | null
          pricing_rules_moved?: number | null
          sale_items_moved?: number | null
          source_product_id: string
          source_product_name?: string | null
          target_product_id: string
        }
        Update: {
          adversus_mappings_moved?: number | null
          id?: string
          merged_at?: string
          merged_by?: string | null
          pricing_rules_moved?: number | null
          sale_items_moved?: number | null
          source_product_id?: string
          source_product_name?: string | null
          target_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_merge_history_target_product_id_fkey"
            columns: ["target_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          applied_at: string | null
          commission_dkk: number | null
          counts_as_cross_sale: boolean | null
          counts_as_sale: boolean | null
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_retroactive: boolean
          product_id: string
          revenue_dkk: number | null
        }
        Insert: {
          applied_at?: string | null
          commission_dkk?: number | null
          counts_as_cross_sale?: boolean | null
          counts_as_sale?: boolean | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          is_retroactive?: boolean
          product_id: string
          revenue_dkk?: number | null
        }
        Update: {
          applied_at?: string | null
          commission_dkk?: number | null
          counts_as_cross_sale?: boolean | null
          counts_as_sale?: boolean | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_retroactive?: boolean
          product_id?: string
          revenue_dkk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_rules: {
        Row: {
          allows_immediate_payment: boolean | null
          campaign_mapping_ids: string[] | null
          commission_dkk: number
          conditions: Json
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          immediate_payment_commission_dkk: number | null
          immediate_payment_revenue_dkk: number | null
          is_active: boolean | null
          name: string | null
          priority: number | null
          product_id: string
          revenue_dkk: number
          updated_at: string | null
          use_rule_name_as_display: boolean | null
        }
        Insert: {
          allows_immediate_payment?: boolean | null
          campaign_mapping_ids?: string[] | null
          commission_dkk: number
          conditions?: Json
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          immediate_payment_commission_dkk?: number | null
          immediate_payment_revenue_dkk?: number | null
          is_active?: boolean | null
          name?: string | null
          priority?: number | null
          product_id: string
          revenue_dkk: number
          updated_at?: string | null
          use_rule_name_as_display?: boolean | null
        }
        Update: {
          allows_immediate_payment?: boolean | null
          campaign_mapping_ids?: string[] | null
          commission_dkk?: number
          conditions?: Json
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          immediate_payment_commission_dkk?: number | null
          immediate_payment_revenue_dkk?: number | null
          is_active?: boolean | null
          name?: string | null
          priority?: number | null
          product_id?: string
          revenue_dkk?: number
          updated_at?: string | null
          use_rule_name_as_display?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_campaign_id: string | null
          commission_dkk: number | null
          counts_as_cross_sale: boolean
          counts_as_sale: boolean
          created_at: string | null
          external_product_code: string | null
          id: string
          is_active: boolean
          is_hidden: boolean | null
          merged_into_product_id: string | null
          name: string
          priority: number | null
          revenue_dkk: number | null
          updated_at: string | null
        }
        Insert: {
          client_campaign_id?: string | null
          commission_dkk?: number | null
          counts_as_cross_sale?: boolean
          counts_as_sale?: boolean
          created_at?: string | null
          external_product_code?: string | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean | null
          merged_into_product_id?: string | null
          name: string
          priority?: number | null
          revenue_dkk?: number | null
          updated_at?: string | null
        }
        Update: {
          client_campaign_id?: string | null
          commission_dkk?: number | null
          counts_as_cross_sale?: boolean
          counts_as_sale?: boolean
          created_at?: string | null
          external_product_code?: string | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean | null
          merged_into_product_id?: string | null
          name?: string
          priority?: number | null
          revenue_dkk?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_campaign_id_fkey"
            columns: ["client_campaign_id"]
            isOneToOne: false
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merged_into_product_id_fkey"
            columns: ["merged_into_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_sync_locks: {
        Row: {
          expires_at: string
          locked_at: string
          locked_by: string | null
          provider: string
        }
        Insert: {
          expires_at?: string
          locked_at?: string
          locked_by?: string | null
          provider: string
        }
        Update: {
          expires_at?: string
          locked_at?: string
          locked_by?: string | null
          provider?: string
        }
        Relationships: []
      }
      pulse_survey_completions: {
        Row: {
          completed_at: string
          employee_id: string
          id: string
          survey_id: string
        }
        Insert: {
          completed_at?: string
          employee_id: string
          id?: string
          survey_id: string
        }
        Update: {
          completed_at?: string
          employee_id?: string
          id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_completions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_survey_dismissals: {
        Row: {
          created_at: string | null
          dismissal_count: number
          dismissed_until: string
          employee_id: string
          id: string
          survey_id: string
        }
        Insert: {
          created_at?: string | null
          dismissal_count?: number
          dismissed_until: string
          employee_id: string
          id?: string
          survey_id: string
        }
        Update: {
          created_at?: string | null
          dismissal_count?: number
          dismissed_until?: string
          employee_id?: string
          id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_dismissals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_dismissals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_dismissals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_dismissals_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_survey_drafts: {
        Row: {
          draft_data: Json
          employee_id: string
          id: string
          survey_id: string
          updated_at: string
        }
        Insert: {
          draft_data?: Json
          employee_id: string
          id?: string
          survey_id: string
          updated_at?: string
        }
        Update: {
          draft_data?: Json
          employee_id?: string
          id?: string
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_drafts_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_survey_responses: {
        Row: {
          attrition_risk_score: number | null
          campaign_attractiveness_score: number | null
          campaign_improvement_suggestions: string | null
          created_at: string
          department: string | null
          development_score: number | null
          energy_score: number | null
          id: string
          improvement_suggestions: string | null
          interest_creation_score: number | null
          leader_availability_score: number | null
          leadership_score: number | null
          market_fit_score: number | null
          nps_comment: string | null
          nps_score: number
          product_competitiveness_score: number | null
          psychological_safety_score: number | null
          recognition_score: number | null
          seriousness_score: number | null
          submitted_team_id: string | null
          survey_id: string
          team_id: string | null
          tenure: string
          wellbeing_score: number | null
        }
        Insert: {
          attrition_risk_score?: number | null
          campaign_attractiveness_score?: number | null
          campaign_improvement_suggestions?: string | null
          created_at?: string
          department?: string | null
          development_score?: number | null
          energy_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          interest_creation_score?: number | null
          leader_availability_score?: number | null
          leadership_score?: number | null
          market_fit_score?: number | null
          nps_comment?: string | null
          nps_score: number
          product_competitiveness_score?: number | null
          psychological_safety_score?: number | null
          recognition_score?: number | null
          seriousness_score?: number | null
          submitted_team_id?: string | null
          survey_id: string
          team_id?: string | null
          tenure: string
          wellbeing_score?: number | null
        }
        Update: {
          attrition_risk_score?: number | null
          campaign_attractiveness_score?: number | null
          campaign_improvement_suggestions?: string | null
          created_at?: string
          department?: string | null
          development_score?: number | null
          energy_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          interest_creation_score?: number | null
          leader_availability_score?: number | null
          leadership_score?: number | null
          market_fit_score?: number | null
          nps_comment?: string | null
          nps_score?: number
          product_competitiveness_score?: number | null
          psychological_safety_score?: number | null
          recognition_score?: number | null
          seriousness_score?: number | null
          submitted_team_id?: string | null
          survey_id?: string
          team_id?: string | null
          tenure?: string
          wellbeing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_responses_submitted_team_id_fkey"
            columns: ["submitted_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_responses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_surveys: {
        Row: {
          activated_at: string
          created_at: string
          id: string
          is_active: boolean
          month: number
          year: number
        }
        Insert: {
          activated_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          month: number
          year: number
        }
        Update: {
          activated_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          month?: number
          year?: number
        }
        Relationships: []
      }
      quiz_templates: {
        Row: {
          created_at: string
          id: string
          questions: Json
          quiz_type: string
          summary_points: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          questions?: Json
          quiz_type: string
          summary_points?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          questions?: Json
          quiz_type?: string
          summary_points?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      recruitment_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      role_dashboard_permissions: {
        Row: {
          can_view: boolean
          created_at: string
          dashboard_slug: string
          id: string
          role_key: string
          updated_at: string
        }
        Insert: {
          can_view?: boolean
          created_at?: string
          dashboard_slug: string
          id?: string
          role_key: string
          updated_at?: string
        }
        Update: {
          can_view?: boolean
          created_at?: string
          dashboard_slug?: string
          id?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_page_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          description: string | null
          id: string
          parent_key: string | null
          permission_key: string
          permission_type: string | null
          role_key: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          parent_key?: string | null
          permission_key: string
          permission_type?: string | null
          role_key: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          parent_key?: string | null
          permission_key?: string
          permission_type?: string | null
          role_key?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_page_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "system_role_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      salary_additions: {
        Row: {
          amount: number
          column_key: string
          created_at: string | null
          employee_id: string
          id: string
          note: string | null
          period_end: string
          period_start: string
        }
        Insert: {
          amount: number
          column_key: string
          created_at?: string | null
          employee_id: string
          id?: string
          note?: string | null
          period_end: string
          period_start: string
        }
        Update: {
          amount?: number
          column_key?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          note?: string | null
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_additions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_additions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_additions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_schemes: {
        Row: {
          created_at: string
          description: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          name: string
          percentage_value: number | null
          scheme_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          percentage_value?: number | null
          scheme_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          percentage_value?: number | null
          scheme_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_type_employees: {
        Row: {
          created_at: string
          effective_from: string | null
          employee_id: string
          id: string
          salary_type_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          employee_id: string
          id?: string
          salary_type_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          employee_id?: string
          id?: string
          salary_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_type_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_type_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_type_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_type_employees_salary_type_id_fkey"
            columns: ["salary_type_id"]
            isOneToOne: false
            referencedRelation: "salary_types"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_types: {
        Row: {
          activation_condition: string | null
          amount: number | null
          amount_type: string | null
          calculation_basis: string | null
          calculation_formula: string | null
          created_at: string
          description: string | null
          group_restriction_ids: string[] | null
          group_restriction_type: string | null
          id: string
          is_active: boolean
          name: string
          payout_frequency: string | null
          updated_at: string
        }
        Insert: {
          activation_condition?: string | null
          amount?: number | null
          amount_type?: string | null
          calculation_basis?: string | null
          calculation_formula?: string | null
          created_at?: string
          description?: string | null
          group_restriction_ids?: string[] | null
          group_restriction_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          payout_frequency?: string | null
          updated_at?: string
        }
        Update: {
          activation_condition?: string | null
          amount?: number | null
          amount_type?: string | null
          calculation_basis?: string | null
          calculation_formula?: string | null
          created_at?: string
          description?: string | null
          group_restriction_ids?: string[] | null
          group_restriction_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payout_frequency?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          adversus_external_id: string | null
          adversus_product_title: string | null
          cancelled_quantity: number
          created_at: string | null
          display_name: string | null
          id: string
          is_cancelled: boolean
          is_immediate_payment: boolean | null
          mapped_commission: number | null
          mapped_revenue: number | null
          matched_pricing_rule_id: string | null
          needs_mapping: boolean | null
          product_id: string | null
          quantity: number | null
          raw_data: Json | null
          sale_id: string
          unit_price: number | null
        }
        Insert: {
          adversus_external_id?: string | null
          adversus_product_title?: string | null
          cancelled_quantity?: number
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_cancelled?: boolean
          is_immediate_payment?: boolean | null
          mapped_commission?: number | null
          mapped_revenue?: number | null
          matched_pricing_rule_id?: string | null
          needs_mapping?: boolean | null
          product_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          sale_id: string
          unit_price?: number | null
        }
        Update: {
          adversus_external_id?: string | null
          adversus_product_title?: string | null
          cancelled_quantity?: number
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_cancelled?: boolean
          is_immediate_payment?: boolean | null
          mapped_commission?: number | null
          mapped_revenue?: number | null
          matched_pricing_rule_id?: string | null
          needs_mapping?: boolean | null
          product_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          sale_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_matched_pricing_rule_id_fkey"
            columns: ["matched_pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "product_pricing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          adversus_event_id: string | null
          adversus_external_id: string | null
          agent_email: string | null
          agent_external_id: string | null
          agent_name: string | null
          client_campaign_id: string | null
          created_at: string | null
          customer_company: string | null
          customer_phone: string | null
          dialer_campaign_id: string | null
          enrichment_attempts: number | null
          enrichment_error: string | null
          enrichment_last_attempt: string | null
          enrichment_status: string | null
          id: string
          integration_type: string | null
          internal_reference: string | null
          normalized_data: Json | null
          raw_payload: Json | null
          sale_datetime: string
          source: string | null
          status: string | null
          updated_at: string | null
          validation_status: string | null
        }
        Insert: {
          adversus_event_id?: string | null
          adversus_external_id?: string | null
          agent_email?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          dialer_campaign_id?: string | null
          enrichment_attempts?: number | null
          enrichment_error?: string | null
          enrichment_last_attempt?: string | null
          enrichment_status?: string | null
          id?: string
          integration_type?: string | null
          internal_reference?: string | null
          normalized_data?: Json | null
          raw_payload?: Json | null
          sale_datetime?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          validation_status?: string | null
        }
        Update: {
          adversus_event_id?: string | null
          adversus_external_id?: string | null
          agent_email?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          dialer_campaign_id?: string | null
          enrichment_attempts?: number | null
          enrichment_error?: string | null
          enrichment_last_attempt?: string | null
          enrichment_status?: string | null
          id?: string
          integration_type?: string | null
          internal_reference?: string | null
          normalized_data?: Json | null
          raw_payload?: Json | null
          sale_datetime?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_adversus_event_id_fkey"
            columns: ["adversus_event_id"]
            isOneToOne: false
            referencedRelation: "adversus_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_campaign_id_fkey"
            columns: ["client_campaign_id"]
            isOneToOne: false
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_reference_sequence: {
        Row: {
          last_number: number
          year_month: string
        }
        Insert: {
          last_number?: number
          year_month: string
        }
        Update: {
          last_number?: number
          year_month?: string
        }
        Relationships: []
      }
      sales_validation_uploads: {
        Row: {
          client_id: string | null
          created_at: string
          file_name: string
          id: string
          matched_cancellations: number | null
          period_month: string
          results_json: Json | null
          status: string
          total_billable: number | null
          total_cancelled: number | null
          unmatched_cancellations: number | null
          unverified_sales: number | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          matched_cancellations?: number | null
          period_month: string
          results_json?: Json | null
          status?: string
          total_billable?: number | null
          total_cancelled?: number | null
          unmatched_cancellations?: number | null
          unverified_sales?: number | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          matched_cancellations?: number | null
          period_month?: string
          results_json?: Json | null
          status?: string
          total_billable?: number | null
          total_cancelled?: number | null
          unmatched_cancellations?: number | null
          unverified_sales?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_validation_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_validation_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_validation_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_validation_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          candidate_id: string | null
          content: string
          created_at: string | null
          employee_id: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          scheduled_at: string
          sent_at: string | null
          status: string | null
          subject: string
          template_key: string | null
        }
        Insert: {
          candidate_id?: string | null
          content: string
          created_at?: string | null
          employee_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string | null
          subject: string
          template_key?: string | null
        }
        Update: {
          candidate_id?: string | null
          content?: string
          created_at?: string | null
          employee_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_team_changes: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_date: string
          employee_id: string
          executed_at: string | null
          from_team_id: string | null
          id: string
          status: string | null
          to_team_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          employee_id: string
          executed_at?: string | null
          from_team_id?: string | null
          id?: string
          status?: string | null
          to_team_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          employee_id?: string
          executed_at?: string | null
          from_team_id?: string | null
          id?: string
          status?: string | null
          to_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_team_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_team_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_team_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_team_changes_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_team_changes_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          affected_categories: string[] | null
          affected_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incident_date: string
          remedial_actions: string | null
          reported_at: string | null
          reported_to_authority: boolean | null
          severity: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_categories?: string[] | null
          affected_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date?: string
          remedial_actions?: string | null
          reported_at?: string | null
          reported_to_authority?: boolean | null
          severity?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_categories?: string[] | null
          affected_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date?: string
          remedial_actions?: string | null
          reported_at?: string | null
          reported_to_authority?: boolean | null
          severity?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sensitive_data_access_log: {
        Row: {
          access_type: string
          created_at: string
          employee_id: string
          field_accessed: string
          id: string
          user_id: string
        }
        Insert: {
          access_type?: string
          created_at?: string
          employee_id: string
          field_accessed: string
          id?: string
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string
          employee_id?: string
          field_accessed?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      shift: {
        Row: {
          break_minutes: number | null
          created_at: string | null
          created_by: string | null
          date: string
          employee_id: string
          end_time: string
          id: string
          note: string | null
          planned_hours: number | null
          start_time: string
          status: Database["public"]["Enums"]["shift_status"] | null
          updated_at: string | null
        }
        Insert: {
          break_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          date: string
          employee_id: string
          end_time: string
          id?: string
          note?: string | null
          planned_hours?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Update: {
          break_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          employee_id?: string
          end_time?: string
          id?: string
          note?: string | null
          planned_hours?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_notification: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      short_links: {
        Row: {
          candidate_id: string | null
          code: string
          created_at: string
          id: string
          link_type: string | null
          target_url: string
        }
        Insert: {
          candidate_id?: string | null
          code: string
          created_at?: string
          id?: string
          link_type?: string | null
          target_url: string
        }
        Update: {
          candidate_id?: string | null
          code?: string
          created_at?: string
          id?: string
          link_type?: string | null
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_links_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_notification_log: {
        Row: {
          booking_assignment_id: string | null
          employee_id: string
          id: string
          message_body: string
          sent_at: string | null
          type: Database["public"]["Enums"]["sms_type"]
        }
        Insert: {
          booking_assignment_id?: string | null
          employee_id: string
          id?: string
          message_body: string
          sent_at?: string | null
          type: Database["public"]["Enums"]["sms_type"]
        }
        Update: {
          booking_assignment_id?: string | null
          employee_id?: string
          id?: string
          message_body?: string
          sent_at?: string | null
          type?: Database["public"]["Enums"]["sms_type"]
        }
        Relationships: [
          {
            foreignKeyName: "sms_notification_log_booking_assignment_id_fkey"
            columns: ["booking_assignment_id"]
            isOneToOne: false
            referencedRelation: "booking_assignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_notification_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          template_key: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          template_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      some_default_goals: {
        Row: {
          id: string
          insta_posts_target: number
          insta_stories_target: number
          tiktok_videos_target: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          insta_posts_target?: number
          insta_stories_target?: number
          tiktok_videos_target?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          insta_posts_target?: number
          insta_stories_target?: number
          tiktok_videos_target?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      some_weekly_metrics: {
        Row: {
          created_at: string | null
          id: string
          insta_followers: number | null
          insta_likes: number | null
          insta_views: number | null
          tiktok_followers: number | null
          tiktok_likes: number | null
          tiktok_views: number | null
          updated_at: string | null
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          insta_followers?: number | null
          insta_likes?: number | null
          insta_views?: number | null
          tiktok_followers?: number | null
          tiktok_likes?: number | null
          tiktok_views?: number | null
          updated_at?: string | null
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          insta_followers?: number | null
          insta_likes?: number | null
          insta_views?: number | null
          tiktok_followers?: number | null
          tiktok_likes?: number | null
          tiktok_views?: number | null
          updated_at?: string | null
          week_start_date?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_primary: boolean
          location_type: string
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          location_type: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          location_type?: string
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      supplier_discount_rules: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          discount_type: string
          id: string
          is_active: boolean
          location_type: string
          min_days_per_location: number
          min_placements: number
          min_revenue: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent: number
          discount_type?: string
          id?: string
          is_active?: boolean
          location_type: string
          min_days_per_location?: number
          min_placements: number
          min_revenue?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          discount_type?: string
          id?: string
          is_active?: boolean
          location_type?: string
          min_days_per_location?: number
          min_placements?: number
          min_revenue?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_invoice_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          discount_amount: number
          discount_percent: number
          final_amount: number
          id: string
          location_type: string
          period_end: string
          period_start: string
          report_data: Json | null
          sent_at: string | null
          sent_to: string[] | null
          status: string
          total_amount: number
          unique_locations: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          discount_amount?: number
          discount_percent?: number
          final_amount?: number
          id?: string
          location_type: string
          period_end: string
          period_start: string
          report_data?: Json | null
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string
          total_amount?: number
          unique_locations?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          discount_amount?: number
          discount_percent?: number
          final_amount?: number
          id?: string
          location_type?: string
          period_end?: string
          period_start?: string
          report_data?: Json | null
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string
          total_amount?: number
          unique_locations?: number
        }
        Relationships: []
      }
      supplier_location_exceptions: {
        Row: {
          created_at: string
          exception_type: string
          id: string
          is_active: boolean
          location_name: string
          location_type: string
          max_discount_percent: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exception_type?: string
          id?: string
          is_active?: boolean
          location_name: string
          location_type: string
          max_discount_percent?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exception_type?: string
          id?: string
          is_active?: boolean
          location_name?: string
          location_type?: string
          max_discount_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_daily_summary: {
        Row: {
          avg_duration_ms: number
          created_at: string
          error_runs: number
          id: string
          provider: string
          skipped_runs: number
          successful_runs: number
          summary_date: string
          total_api_calls: number
          total_rate_limit_hits: number
          total_records_processed: number
          total_runs: number
        }
        Insert: {
          avg_duration_ms?: number
          created_at?: string
          error_runs?: number
          id?: string
          provider: string
          skipped_runs?: number
          successful_runs?: number
          summary_date: string
          total_api_calls?: number
          total_rate_limit_hits?: number
          total_records_processed?: number
          total_runs?: number
        }
        Update: {
          avg_duration_ms?: number
          created_at?: string
          error_runs?: number
          id?: string
          provider?: string
          skipped_runs?: number
          successful_runs?: number
          summary_date?: string
          total_api_calls?: number
          total_rate_limit_hits?: number
          total_records_processed?: number
          total_runs?: number
        }
        Relationships: []
      }
      sync_failed_records: {
        Row: {
          created_at: string
          dataset: string
          error_message: string
          id: string
          integration_id: string
          raw_payload: Json
          resolved_at: string | null
          retry_count: number
          run_id: string | null
        }
        Insert: {
          created_at?: string
          dataset: string
          error_message: string
          id?: string
          integration_id: string
          raw_payload: Json
          resolved_at?: string | null
          retry_count?: number
          run_id?: string | null
        }
        Update: {
          created_at?: string
          dataset?: string
          error_message?: string
          id?: string
          integration_id?: string
          raw_payload?: Json
          resolved_at?: string | null
          retry_count?: number
          run_id?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          id: number
          last_entry_date: string | null
          last_sync_at: string | null
        }
        Insert: {
          id?: number
          last_entry_date?: string | null
          last_sync_at?: string | null
        }
        Update: {
          id?: number
          last_entry_date?: string | null
          last_sync_at?: string | null
        }
        Relationships: []
      }
      system_feedback: {
        Row: {
          admin_notes: string | null
          admin_response: string | null
          affected_employee_name: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          priority: string
          screenshot_url: string | null
          status: string
          submitted_by: string | null
          system_area: string | null
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          admin_response?: string | null
          affected_employee_name?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          system_area?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          admin_response?: string | null
          affected_employee_name?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          system_area?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      system_feedback_access: {
        Row: {
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_feedback_access_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_access_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_access_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      system_feedback_recipients: {
        Row: {
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_feedback_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_feedback_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      system_role_definitions: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          detailed_description: string | null
          icon: string | null
          id: string
          key: string
          label: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          icon?: string | null
          id?: string
          key: string
          label: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          icon?: string | null
          id?: string
          key?: string
          label?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["system_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tdc_cancellation_imports: {
        Row: {
          id: string
          raw_data: Json
          row_index: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          raw_data: Json
          row_index: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          raw_data?: Json
          row_index?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      team_assistant_leaders: {
        Row: {
          created_at: string | null
          employee_id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_assistant_leaders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assistant_leaders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assistant_leaders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_assistant_leaders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_client_daily_bonus: {
        Row: {
          bonus_amount: number
          bonus_days: number
          client_id: string
          created_at: string
          id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          bonus_days?: number
          client_id: string
          created_at?: string
          id?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          bonus_days?: number
          client_id?: string
          created_at?: string
          id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_client_daily_bonus_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_client_daily_bonus_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_clients: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          team_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          team_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_dashboard_permissions: {
        Row: {
          access_level: string
          created_at: string | null
          dashboard_slug: string
          id: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string
          created_at?: string | null
          dashboard_slug: string
          id?: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string | null
          dashboard_slug?: string
          id?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_dashboard_permissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_expenses: {
        Row: {
          all_days: boolean | null
          amount: number
          calculation_formula: string | null
          category: string | null
          created_at: string | null
          description: string
          expense_date: string
          formula_description: string | null
          formula_variables: Json | null
          id: string
          is_dynamic: boolean | null
          is_recurring: boolean | null
          notes: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          all_days?: boolean | null
          amount?: number
          calculation_formula?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          expense_date: string
          formula_description?: string | null
          formula_variables?: Json | null
          id?: string
          is_dynamic?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          all_days?: boolean | null
          amount?: number
          calculation_formula?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string
          formula_description?: string | null
          formula_variables?: Json | null
          id?: string
          is_dynamic?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_monthly_goals: {
        Row: {
          bonus_description: string | null
          bonus_tier1_amount: number
          bonus_tier1_description: string | null
          bonus_tier2_amount: number
          bonus_tier2_description: string | null
          bonus_tier3_amount: number
          bonus_tier3_description: string | null
          created_at: string
          id: string
          month: number
          sales_target: number
          team_id: string
          updated_at: string
          year: number
        }
        Insert: {
          bonus_description?: string | null
          bonus_tier1_amount?: number
          bonus_tier1_description?: string | null
          bonus_tier2_amount?: number
          bonus_tier2_description?: string | null
          bonus_tier3_amount?: number
          bonus_tier3_description?: string | null
          created_at?: string
          id?: string
          month: number
          sales_target?: number
          team_id: string
          updated_at?: string
          year: number
        }
        Update: {
          bonus_description?: string | null
          bonus_tier1_amount?: number
          bonus_tier1_description?: string | null
          bonus_tier2_amount?: number
          bonus_tier2_description?: string | null
          bonus_tier3_amount?: number
          bonus_tier3_description?: string | null
          created_at?: string
          id?: string
          month?: number
          sales_target?: number
          team_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_monthly_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_sales_goals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          target_amount: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          target_amount?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          target_amount?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_sales_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_shift_breaks: {
        Row: {
          break_end: string
          break_start: string
          created_at: string
          day_of_week: number | null
          id: string
          shift_id: string
        }
        Insert: {
          break_end: string
          break_start: string
          created_at?: string
          day_of_week?: number | null
          id?: string
          shift_id: string
        }
        Update: {
          break_end?: string
          break_start?: string
          created_at?: string
          day_of_week?: number | null
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_shift_breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "team_standard_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_standard_shift_days: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          shift_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          shift_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          shift_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_standard_shift_days_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "team_standard_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_standard_shifts: {
        Row: {
          created_at: string
          end_time: string
          hours_source: string
          id: string
          is_active: boolean
          name: string
          start_time: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          hours_source?: string
          id?: string
          is_active?: boolean
          name: string
          start_time: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          hours_source?: string
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_standard_shifts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          assistant_team_leader_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          team_leader_id: string | null
          updated_at: string | null
        }
        Insert: {
          assistant_team_leader_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assistant_team_leader_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_assistant_team_leader_id_fkey"
            columns: ["assistant_team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_assistant_team_leader_id_fkey"
            columns: ["assistant_team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_assistant_team_leader_id_fkey"
            columns: ["assistant_team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry: {
        Row: {
          actual_hours: number | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          date: string
          employee_id: string
          id: string
          note: string | null
          shift_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_request: {
        Row: {
          created_at: string | null
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_request_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_request_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["id"]
          },
        ]
      }
      time_stamps: {
        Row: {
          break_minutes: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          edited_at: string | null
          edited_by: string | null
          effective_clock_in: string | null
          effective_clock_out: string | null
          effective_hours: number | null
          employee_id: string
          id: string
          note: string | null
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          effective_clock_in?: string | null
          effective_clock_out?: string | null
          effective_hours?: number | null
          employee_id: string
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          effective_clock_in?: string | null
          effective_clock_out?: string | null
          effective_hours?: number | null
          employee_id?: string
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_stamps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_stamps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_stamps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_stamps_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_number: string
          amount: number
          category: string | null
          created_at: string | null
          date: string
          id: number
          source_id: string | null
          text: string | null
          type: string
          updated_at: string | null
          voucher_id: string | null
        }
        Insert: {
          account_number: string
          amount: number
          category?: string | null
          created_at?: string | null
          date: string
          id?: number
          source_id?: string | null
          text?: string | null
          type: string
          updated_at?: string | null
          voucher_id?: string | null
        }
        Update: {
          account_number?: string
          amount?: number
          category?: string | null
          created_at?: string | null
          date?: string
          id?: number
          source_id?: string | null
          text?: string | null
          type?: string
          updated_at?: string | null
          voucher_id?: string | null
        }
        Relationships: []
      }
      trusted_ip_ranges: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          ip_range: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          ip_range: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          ip_range?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tv_board_access: {
        Row: {
          access_code: string
          access_count: number | null
          auto_rotate: boolean | null
          celebration_duration: number | null
          celebration_effect: string | null
          celebration_enabled: boolean | null
          celebration_metric: string | null
          celebration_source_dashboard: string | null
          celebration_text: string | null
          celebration_trigger_condition: string | null
          celebration_trigger_value: number | null
          created_at: string | null
          created_by: string | null
          dashboard_slug: string
          dashboard_slugs: string[] | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          name: string | null
          rotate_interval_seconds: number | null
          rotate_intervals_per_dashboard: Json | null
          start_fullscreen: boolean
        }
        Insert: {
          access_code: string
          access_count?: number | null
          auto_rotate?: boolean | null
          celebration_duration?: number | null
          celebration_effect?: string | null
          celebration_enabled?: boolean | null
          celebration_metric?: string | null
          celebration_source_dashboard?: string | null
          celebration_text?: string | null
          celebration_trigger_condition?: string | null
          celebration_trigger_value?: number | null
          created_at?: string | null
          created_by?: string | null
          dashboard_slug: string
          dashboard_slugs?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          name?: string | null
          rotate_interval_seconds?: number | null
          rotate_intervals_per_dashboard?: Json | null
          start_fullscreen?: boolean
        }
        Update: {
          access_code?: string
          access_count?: number | null
          auto_rotate?: boolean | null
          celebration_duration?: number | null
          celebration_effect?: string | null
          celebration_enabled?: boolean | null
          celebration_metric?: string | null
          celebration_source_dashboard?: string | null
          celebration_text?: string | null
          celebration_trigger_condition?: string | null
          celebration_trigger_value?: number | null
          created_at?: string | null
          created_by?: string | null
          dashboard_slug?: string
          dashboard_slugs?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          name?: string | null
          rotate_interval_seconds?: number | null
          rotate_intervals_per_dashboard?: Json | null
          start_fullscreen?: boolean
        }
        Relationships: []
      }
      user_menu_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          menu_item_id: string
          permission_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          menu_item_id: string
          permission_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          menu_item_id?: string
          permission_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          license_plate: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_plate: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          license_plate?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      vehicle_mileage: {
        Row: {
          booking_id: string | null
          created_at: string | null
          date: string
          end_mileage: number
          estimated_distance: number | null
          id: string
          notes: string | null
          start_mileage: number
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          date: string
          end_mileage: number
          estimated_distance?: number | null
          id?: string
          notes?: string | null
          start_mileage: number
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          date?: string
          end_mileage?: number
          estimated_distance?: number | null
          id?: string
          notes?: string | null
          start_mileage?: number
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mileage_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_mileage_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_return_confirmation: {
        Row: {
          booking_date: string | null
          booking_id: string | null
          booking_vehicle_id: string | null
          confirmed_at: string
          employee_id: string
          id: string
          photo_url: string | null
          vehicle_id: string | null
          vehicle_name: string | null
        }
        Insert: {
          booking_date?: string | null
          booking_id?: string | null
          booking_vehicle_id?: string | null
          confirmed_at?: string
          employee_id: string
          id?: string
          photo_url?: string | null
          vehicle_id?: string | null
          vehicle_name?: string | null
        }
        Update: {
          booking_date?: string | null
          booking_id?: string | null
          booking_vehicle_id?: string | null
          confirmed_at?: string
          employee_id?: string
          id?: string
          photo_url?: string | null
          vehicle_id?: string | null
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_return_confirmation_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_return_confirmation_booking_vehicle_id_fkey"
            columns: ["booking_vehicle_id"]
            isOneToOne: false
            referencedRelation: "booking_vehicle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_return_confirmation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_basic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_return_confirmation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_return_confirmation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_referral_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_return_confirmation_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          description: string | null
          endpoint_path: string
          id: string
          is_active: boolean | null
          last_received_at: string | null
          name: string
          total_requests: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          endpoint_path: string
          id?: string
          is_active?: boolean | null
          last_received_at?: string | null
          name: string
          total_requests?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          endpoint_path?: string
          id?: string
          is_active?: boolean | null
          last_received_at?: string | null
          name?: string
          total_requests?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      weekend_cleanup_config: {
        Row: {
          created_at: string
          id: string
          recipients: string | null
          send_time: string | null
          tasks: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipients?: string | null
          send_time?: string | null
          tasks?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipients?: string | null
          send_time?: string | null
          tasks?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weekly_goals: {
        Row: {
          created_at: string | null
          id: string
          insta_posts_target: number
          insta_stories_target: number
          tiktok_videos_target: number
          updated_at: string | null
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          insta_posts_target?: number
          insta_stories_target?: number
          tiktok_videos_target?: number
          updated_at?: string | null
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          insta_posts_target?: number
          insta_stories_target?: number
          tiktok_videos_target?: number
          updated_at?: string | null
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      dialer_session_daily_metrics: {
        Row: {
          agent_external_id: string | null
          avg_call_duration: number | null
          avg_session_seconds: number | null
          campaign_external_id: string | null
          date: string | null
          integration_id: string | null
          invalid_sessions: number | null
          not_interested_sessions: number | null
          redial_sessions: number | null
          sessions_with_calls: number | null
          success_sessions: number | null
          total_sessions: number | null
          unqualified_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dialer_sessions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "dialer_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_basic_info: {
        Row: {
          avatar_url: string | null
          department: string | null
          employment_start_date: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          job_title: string | null
          last_name: string | null
          team_id: string | null
          work_email: string | null
        }
        Insert: {
          avatar_url?: string | null
          department?: string | null
          employment_start_date?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string | null
          team_id?: string | null
          work_email?: string | null
        }
        Update: {
          avatar_url?: string | null
          department?: string | null
          employment_start_date?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string | null
          team_id?: string | null
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_master_data_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_referral_lookup: {
        Row: {
          first_name: string | null
          id: string | null
          last_name: string | null
          referral_code: string | null
        }
        Insert: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          referral_code?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          referral_code?: string | null
        }
        Relationships: []
      }
      mv_daily_sales_stats: {
        Row: {
          agent_email: string | null
          client_campaign_id: string | null
          client_id: string | null
          sale_date: string | null
          sale_row_count: number | null
          total_commission: number | null
          total_quantity: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_campaign_id_fkey"
            columns: ["client_campaign_id"]
            isOneToOne: false
            referencedRelation: "client_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      posteringer_enriched: {
        Row: {
          beloeb_dkk: number | null
          bilags_nr: number | null
          dato: string | null
          import_id: string | null
          is_balance_account: boolean | null
          kategori: string | null
          kategori_id: string | null
          klassificering_kilde: string | null
          konto_nr: number | null
          kontonavn: string | null
          kunde_nr: number | null
          leverandoer_nr: number | null
          loebe_nr: number | null
          maaned: string | null
          needs_review: boolean | null
          team: string | null
          team_id: string | null
          tekst: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_posteringer_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "economic_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_posteringer_konto_nr_fkey"
            columns: ["konto_nr"]
            isOneToOne: false
            referencedRelation: "economic_kontoplan"
            referencedColumns: ["konto_nr"]
          },
        ]
      }
    }
    Functions: {
      assign_role_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["system_role"]
        }
        Returns: undefined
      }
      auto_suggest_konto_mapping: { Args: never; Returns: number }
      can_access_confidential_contract: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_permissions: { Args: { _user_id: string }; Returns: boolean }
      can_view_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_sale_as_employee: {
        Args: { _sale_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_invalid_email_sales: { Args: never; Returns: Json }
      cleanup_kpi_cache: { Args: never; Returns: number }
      cleanup_stale_leaderboard_cache: { Args: never; Returns: number }
      complete_invitation_password: { Args: { _token: string }; Returns: Json }
      consume_password_reset_token: {
        Args: { _token_hash: string }
        Returns: boolean
      }
      contract_has_pending_signature: {
        Args: { contract_uuid: string }
        Returns: boolean
      }
      create_customer_integration: {
        Args: {
          p_api_url: string
          p_client_id: string
          p_config: Json
          p_credentials: string
          p_crm_type: Database["public"]["Enums"]["crm_type"]
          p_cron_schedule: string
          p_encryption_key: string
        }
        Returns: string
      }
      create_dialer_integration: {
        Args: {
          p_credentials: string
          p_encryption_key: string
          p_name: string
          p_provider: string
        }
        Returns: string
      }
      create_onboarding_coaching_tasks_for_employee: {
        Args: { p_employee_id: string; p_start_date?: string }
        Returns: number
      }
      generate_access_code: { Args: never; Returns: string }
      get_agent_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_aggregated_product_types: {
        Args: never
        Returns: {
          adversus_external_id: string
          adversus_product_title: string
          client_id: string
          client_name: string
          commission_dkk: number
          counts_as_cross_sale: boolean
          counts_as_sale: boolean
          is_hidden: boolean
          product_client_campaign_id: string
          product_id: string
          product_name: string
          revenue_dkk: number
          sale_source: string
        }[]
      }
      get_all_role_page_permissions: {
        Args: never
        Returns: {
          can_edit: boolean
          can_view: boolean
          description: string
          id: string
          parent_key: string
          permission_key: string
          permission_type: string
          role_key: string
          visibility: string
        }[]
      }
      get_auth_email_by_work_email: {
        Args: { _work_email: string }
        Returns: string
      }
      get_auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_call_stats: {
        Args: { end_ts: string; start_ts: string }
        Returns: {
          avg_duration: number
          total_duration: number
        }[]
      }
      get_client_sales_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          client_id: string
          client_name: string
          commission_month: number
          commission_today: number
          revenue_month: number
          revenue_today: number
          sales_month: number
          sales_today: number
          top_sellers: Json
        }[]
      }
      get_coaching_coverage_stats: {
        Args: { p_leader_id?: string }
        Returns: {
          completed_tasks: number
          completion_rate: number
          employee_id: string
          employee_name: string
          leader_id: string
          leader_name: string
          open_tasks: number
          overdue_tasks: number
          total_tasks: number
        }[]
      }
      get_cs_top20_custom_period_leaderboard: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: {
          avatar_url: string
          commission: number
          employee_id: string
          employee_name: string
          sales_count: number
          team_name: string
        }[]
      }
      get_current_employee_id: { Args: never; Returns: string }
      get_customer_credentials: {
        Args: { p_client_id: string; p_encryption_key: string }
        Returns: Json
      }
      get_customer_integration_decrypted: {
        Args: { p_client_id: string; p_encryption_key: string }
        Returns: {
          api_url: string
          client_id: string
          config: Json
          credentials: Json
          crm_type: Database["public"]["Enums"]["crm_type"]
          cron_schedule: string
          id: string
          is_active: boolean
        }[]
      }
      get_decrypted_integration: {
        Args: { p_client_id: string; p_encryption_key: string }
        Returns: {
          api_url: string
          config: Json
          credentials: Json
          crm_type: Database["public"]["Enums"]["crm_type"]
          id: string
        }[]
      }
      get_dialer_credentials: {
        Args: { p_encryption_key: string; p_integration_id: string }
        Returns: Json
      }
      get_distinct_agent_emails_for_client: {
        Args: { p_client_id: string }
        Returns: {
          agent_email: string
        }[]
      }
      get_distinct_cached_kpi_slugs: {
        Args: never
        Returns: {
          kpi_slug: string
        }[]
      }
      get_distinct_sales_sources: {
        Args: never
        Returns: {
          source: string
        }[]
      }
      get_employee_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_employee_roles_for_admin: {
        Args: never
        Returns: {
          auth_user_id: string
          email: string
          employee_id: string
          first_name: string
          is_active: boolean
          job_title: string
          last_name: string
          roles: Database["public"]["Enums"]["system_role"][]
        }[]
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          employee_id: string
          expires_at: string
          first_name: string
          id: string
          last_name: string
          status: string
        }[]
      }
      get_invitation_by_token_v2: {
        Args: { _token: string }
        Returns: {
          email: string
          employee_id: string
          expires_at: string
          first_name: string
          id: string
          last_name: string
          password_set_at: string
          status: string
        }[]
      }
      get_personal_daily_commission: {
        Args: {
          p_employee_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          commission: number
          sale_date: string
        }[]
      }
      get_referrer_by_code: {
        Args: { p_referral_code: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
          referral_code: string
        }[]
      }
      get_sales_aggregates: {
        Args: {
          p_client_id?: string
          p_employee_id?: string
          p_end: string
          p_start: string
          p_team_id?: string
        }
        Returns: {
          total_commission: number
          total_revenue: number
          total_sales: number
        }[]
      }
      get_sales_aggregates_v2: {
        Args: {
          p_agent_emails?: string[]
          p_client_id?: string
          p_employee_id?: string
          p_end: string
          p_group_by?: string
          p_start: string
          p_team_id?: string
        }
        Returns: {
          group_key: string
          group_name: string
          total_commission: number
          total_revenue: number
          total_sales: number
        }[]
      }
      get_sales_report_detailed: {
        Args: { p_client_id: string; p_end: string; p_start: string }
        Returns: {
          commission: number
          employee_name: string
          product_name: string
          quantity: number
          revenue: number
        }[]
      }
      get_sales_report_raw:
        | {
            Args: { p_client_id: string; p_end: string; p_start: string }
            Returns: {
              adversus_opp_number: string
              commission: number
              customer_company: string
              customer_phone: string
              employee_name: string
              internal_reference: string
              product_name: string
              quantity: number
              revenue: number
              sale_datetime: string
              status: string
            }[]
          }
        | {
            Args: {
              p_client_id: string
              p_end: string
              p_limit?: number
              p_offset?: number
              p_start: string
            }
            Returns: {
              adversus_opp_number: string
              commission: number
              customer_company: string
              customer_phone: string
              employee_name: string
              internal_reference: string
              product_name: string
              quantity: number
              revenue: number
              sale_datetime: string
              status: string
            }[]
          }
      get_sales_with_unknown_products: {
        Args: never
        Returns: {
          agent_email: string
          agent_name: string
          campaign_name: string
          created_at: string
          customer_company: string
          customer_phone: string
          dialer_campaign_id: string
          integration_type: string
          product_external_id: string
          product_title: string
          quantity: number
          raw_payload: Json
          sale_datetime: string
          sale_external_id: string
          sale_id: string
          sale_item_id: string
          source: string
        }[]
      }
      get_sales_without_items_count: {
        Args: { p_since: string }
        Returns: number
      }
      get_source_counts: {
        Args: never
        Returns: {
          cnt: number
          entity_type: string
          source_name: string
        }[]
      }
      get_team_employees_basic_info: {
        Args: never
        Returns: {
          created_at: string
          department: string
          employment_start_date: string
          first_name: string
          id: string
          is_active: boolean
          job_title: string
          last_name: string
          private_email: string
          private_phone: string
          team_id: string
          work_email: string
        }[]
      }
      get_team_performance_summary: { Args: { p_date: string }; Returns: Json }
      get_unread_message_count: {
        Args: { p_employee_id: string }
        Returns: number
      }
      get_user_granted_permissions: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_manager_scope: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["system_role"]
      }
      has_edit_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heal_fm_missing_sale_items: { Args: never; Returns: number }
      is_chat_conversation_member: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string; p_employee_id: string }
        Returns: boolean
      }
      is_fieldmarketing_leder: { Args: { _user_id: string }; Returns: boolean }
      is_in_my_team: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_in_my_teams: {
        Args: { _target_employee_id: string }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_manager_position: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner_only: { Args: { _user_id: string }; Returns: boolean }
      is_rekruttering: { Args: { _user_id: string }; Returns: boolean }
      is_some: { Args: { _user_id: string }; Returns: boolean }
      is_teamleder_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_vagt_admin_or_planner: { Args: { _user_id: string }; Returns: boolean }
      jsonb_object_keys_array: { Args: { p_json: Json }; Returns: Json }
      recalculate_coaching_due_dates_for_employee: {
        Args: { p_employee_id: string }
        Returns: number
      }
      remove_role_by_email: { Args: { _email: string }; Returns: undefined }
      rollback_cancellation_import: {
        Args: { p_import_id: string }
        Returns: Json
      }
      save_integration_secret: {
        Args: {
          p_api_url: string
          p_client_id: string
          p_crm_type: Database["public"]["Enums"]["crm_type"]
          p_encryption_key: string
          p_secret_json: Json
        }
        Returns: string
      }
      schedule_integration_sync: {
        Args: {
          p_anon_key: string
          p_function_url: string
          p_job_name: string
          p_payload?: Json
          p_schedule: string
        }
        Returns: number
      }
      search_sales: {
        Args: { max_results?: number; search_query: string }
        Returns: string[]
      }
      shares_team_with_user: {
        Args: { _target_employee_id: string; _user_id: string }
        Returns: boolean
      }
      trigger_kpi_calculation: { Args: never; Returns: undefined }
      trigger_kpi_incremental: { Args: never; Returns: undefined }
      trigger_leaderboard_calculation: { Args: never; Returns: undefined }
      update_customer_credentials: {
        Args: {
          p_client_id: string
          p_credentials: string
          p_encryption_key: string
        }
        Returns: undefined
      }
      update_dialer_credentials: {
        Args: {
          p_credentials: string
          p_encryption_key: string
          p_integration_id: string
        }
        Returns: undefined
      }
      update_fordelingsregel_counts: { Args: never; Returns: undefined }
      update_overdue_coaching_tasks: { Args: never; Returns: number }
      upsert_sync_state_atomic: {
        Args: {
          p_dataset: string
          p_integration_id: string
          p_last_success_at: string
        }
        Returns: undefined
      }
      validate_password_reset_token: {
        Args: { _token_hash: string }
        Returns: {
          email: string
          employee_id: string
          expires_at: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
    }
    Enums: {
      absence_request_status: "pending" | "approved" | "rejected"
      absence_type: "sick" | "vacation" | "other"
      absence_type_v2: "vacation" | "sick" | "no_show" | "day_off"
      amo_apv_reason:
        | "regular_cycle"
        | "organisational_change"
        | "relocation"
        | "incident"
        | "other"
      amo_meeting_status: "planned" | "completed" | "overdue" | "cancelled"
      amo_meeting_type: "amo_meeting" | "annual_discussion" | "extraordinary"
      amo_role_type:
        | "admin"
        | "ledelsesrepresentant"
        | "arbejdsleder"
        | "amr"
        | "readonly"
      amo_rule_type: "lovpligtigt" | "anbefalet" | "intern"
      amo_task_priority: "low" | "medium" | "high" | "critical"
      amo_task_status: "open" | "in_progress" | "done" | "overdue"
      amo_training_type:
        | "mandatory_3day"
        | "supplementary"
        | "internal_workshop"
        | "legal_update"
      app_role: "admin" | "payroll" | "manager" | "agent"
      clock_type: "override" | "documentation" | "revenue"
      commission_transaction_type: "earn" | "clawback" | "manual_adjustment"
      commission_type: "fixed" | "percentage"
      communication_channel: "Telefon" | "Mail" | "Andet"
      content_platform: "TikTok" | "Instagram"
      content_status:
        | "planned"
        | "in_progress"
        | "filmed"
        | "edited"
        | "published"
      content_type: "tiktok_video" | "insta_story" | "insta_post"
      contract_status:
        | "draft"
        | "pending_employee"
        | "pending_manager"
        | "signed"
        | "rejected"
        | "expired"
        | "cancelled"
      contract_type:
        | "employment"
        | "amendment"
        | "nda"
        | "company_car"
        | "termination"
        | "other"
        | "team_leader"
        | "assistant_team_leader"
      crm_type: "hubspot" | "salesforce" | "pipedrive" | "generic_api" | "excel"
      employment_type: "hourly" | "monthly"
      leadership_interest: "yes" | "maybe" | "no"
      leadership_role_type: "junior_teamleder" | "teamleder" | "coach" | "other"
      location_status: "Ny" | "Aktiv" | "Pause" | "Sortlistet"
      payroll_status: "draft" | "approved" | "exported"
      salary_type: "provision" | "fixed" | "hourly"
      sale_status: "pending" | "active" | "cancelled" | "clawbacked"
      shift_status: "planned" | "completed" | "cancelled"
      sms_type:
        | "new_shift"
        | "updated_shift"
        | "deleted_shift"
        | "week_confirmation"
      system_role:
        | "medarbejder"
        | "teamleder"
        | "ejer"
        | "rekruttering"
        | "some"
      team_change_wish: "yes" | "no"
      vacation_type: "vacation_pay" | "vacation_bonus"
      vagt_absence_reason: "Ferie" | "Syg" | "Barn syg" | "Andet"
      vagt_flow_role: "admin" | "planner" | "employee" | "brand_viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      absence_request_status: ["pending", "approved", "rejected"],
      absence_type: ["sick", "vacation", "other"],
      absence_type_v2: ["vacation", "sick", "no_show", "day_off"],
      amo_apv_reason: [
        "regular_cycle",
        "organisational_change",
        "relocation",
        "incident",
        "other",
      ],
      amo_meeting_status: ["planned", "completed", "overdue", "cancelled"],
      amo_meeting_type: ["amo_meeting", "annual_discussion", "extraordinary"],
      amo_role_type: [
        "admin",
        "ledelsesrepresentant",
        "arbejdsleder",
        "amr",
        "readonly",
      ],
      amo_rule_type: ["lovpligtigt", "anbefalet", "intern"],
      amo_task_priority: ["low", "medium", "high", "critical"],
      amo_task_status: ["open", "in_progress", "done", "overdue"],
      amo_training_type: [
        "mandatory_3day",
        "supplementary",
        "internal_workshop",
        "legal_update",
      ],
      app_role: ["admin", "payroll", "manager", "agent"],
      clock_type: ["override", "documentation", "revenue"],
      commission_transaction_type: ["earn", "clawback", "manual_adjustment"],
      commission_type: ["fixed", "percentage"],
      communication_channel: ["Telefon", "Mail", "Andet"],
      content_platform: ["TikTok", "Instagram"],
      content_status: [
        "planned",
        "in_progress",
        "filmed",
        "edited",
        "published",
      ],
      content_type: ["tiktok_video", "insta_story", "insta_post"],
      contract_status: [
        "draft",
        "pending_employee",
        "pending_manager",
        "signed",
        "rejected",
        "expired",
        "cancelled",
      ],
      contract_type: [
        "employment",
        "amendment",
        "nda",
        "company_car",
        "termination",
        "other",
        "team_leader",
        "assistant_team_leader",
      ],
      crm_type: ["hubspot", "salesforce", "pipedrive", "generic_api", "excel"],
      employment_type: ["hourly", "monthly"],
      leadership_interest: ["yes", "maybe", "no"],
      leadership_role_type: ["junior_teamleder", "teamleder", "coach", "other"],
      location_status: ["Ny", "Aktiv", "Pause", "Sortlistet"],
      payroll_status: ["draft", "approved", "exported"],
      salary_type: ["provision", "fixed", "hourly"],
      sale_status: ["pending", "active", "cancelled", "clawbacked"],
      shift_status: ["planned", "completed", "cancelled"],
      sms_type: [
        "new_shift",
        "updated_shift",
        "deleted_shift",
        "week_confirmation",
      ],
      system_role: ["medarbejder", "teamleder", "ejer", "rekruttering", "some"],
      team_change_wish: ["yes", "no"],
      vacation_type: ["vacation_pay", "vacation_bonus"],
      vagt_absence_reason: ["Ferie", "Syg", "Barn syg", "Andet"],
      vagt_flow_role: ["admin", "planner", "employee", "brand_viewer"],
    },
  },
} as const
