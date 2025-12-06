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
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_map: {
        Row: {
          account_number: string
          category: string
          type: string
        }
        Insert: {
          account_number: string
          category: string
          type: string
        }
        Update: {
          account_number?: string
          category?: string
          type?: string
        }
        Relationships: []
      }
      adversus_campaign_mappings: {
        Row: {
          adversus_campaign_id: string
          adversus_campaign_name: string | null
          client_campaign_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          adversus_campaign_id: string
          adversus_campaign_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          adversus_campaign_id?: string
          adversus_campaign_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          id?: string
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
      agents: {
        Row: {
          base_salary_monthly: number | null
          created_at: string | null
          email: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          external_adversus_id: string | null
          id: string
          is_active: boolean | null
          name: string
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
          id?: string
          is_active?: boolean | null
          name: string
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
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking: {
        Row: {
          brand_id: string
          comment: string | null
          created_at: string | null
          end_date: string
          expected_staff_count: number | null
          id: string
          location_id: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"] | null
          updated_at: string | null
          week_number: number
          year: number
        }
        Insert: {
          brand_id: string
          comment?: string | null
          created_at?: string | null
          end_date: string
          expected_staff_count?: number | null
          id?: string
          location_id: string
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
          week_number: number
          year: number
        }
        Update: {
          brand_id?: string
          comment?: string | null
          created_at?: string | null
          end_date?: string
          expected_staff_count?: number | null
          id?: string
          location_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
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
            foreignKeyName: "booking_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
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
            referencedRelation: "employee"
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
      clients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "employee_master_data"
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
            referencedRelation: "employee_master_data"
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
      economic_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
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
            referencedRelation: "employee"
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
          status: string
          token: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          status?: string
          token: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_master_data: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          bank_account_number: string | null
          bank_reg_number: string | null
          contract_id: string | null
          contract_version: string | null
          cpr_number: string | null
          created_at: string | null
          department: string | null
          employment_end_date: string | null
          employment_start_date: string | null
          first_name: string
          has_parking: boolean | null
          id: string
          is_active: boolean | null
          job_title: string | null
          last_name: string
          manager_id: string | null
          parking_monthly_cost: number | null
          parking_spot_id: string | null
          private_email: string | null
          private_phone: string | null
          salary_amount: number | null
          salary_type: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time: string | null
          system_role_id: string | null
          updated_at: string | null
          vacation_bonus_percent: number | null
          vacation_type: Database["public"]["Enums"]["vacation_type"] | null
          weekly_hours: number | null
          work_email: string | null
          work_location: string | null
          working_hours_model: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          bank_account_number?: string | null
          bank_reg_number?: string | null
          contract_id?: string | null
          contract_version?: string | null
          cpr_number?: string | null
          created_at?: string | null
          department?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          first_name: string
          has_parking?: boolean | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name: string
          manager_id?: string | null
          parking_monthly_cost?: number | null
          parking_spot_id?: string | null
          private_email?: string | null
          private_phone?: string | null
          salary_amount?: number | null
          salary_type?: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time?: string | null
          system_role_id?: string | null
          updated_at?: string | null
          vacation_bonus_percent?: number | null
          vacation_type?: Database["public"]["Enums"]["vacation_type"] | null
          weekly_hours?: number | null
          work_email?: string | null
          work_location?: string | null
          working_hours_model?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          bank_account_number?: string | null
          bank_reg_number?: string | null
          contract_id?: string | null
          contract_version?: string | null
          cpr_number?: string | null
          created_at?: string | null
          department?: string | null
          employment_end_date?: string | null
          employment_start_date?: string | null
          first_name?: string
          has_parking?: boolean | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string
          manager_id?: string | null
          parking_monthly_cost?: number | null
          parking_spot_id?: string | null
          private_email?: string | null
          private_phone?: string | null
          salary_amount?: number | null
          salary_type?: Database["public"]["Enums"]["salary_type"] | null
          standard_start_time?: string | null
          system_role_id?: string | null
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
            foreignKeyName: "employee_master_data_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_master_data_system_role_id_fkey"
            columns: ["system_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
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
      lateness_record: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          minutes: number
          note: string | null
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          minutes?: number
          note?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          minutes?: number
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lateness_record_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          address_city: string | null
          address_postal_code: string | null
          address_street: string | null
          available_after_date: string | null
          can_book_eesy: boolean | null
          can_book_yousee: boolean | null
          contact_email: string | null
          contact_person_name: string | null
          contact_phone: string | null
          cooldown_weeks: number | null
          created_at: string | null
          daily_rate: number | null
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
          can_book_eesy?: boolean | null
          can_book_yousee?: boolean | null
          contact_email?: string | null
          contact_person_name?: string | null
          contact_phone?: string | null
          cooldown_weeks?: number | null
          created_at?: string | null
          daily_rate?: number | null
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
          can_book_eesy?: boolean | null
          can_book_yousee?: boolean | null
          contact_email?: string | null
          contact_person_name?: string | null
          contact_phone?: string | null
          cooldown_weeks?: number | null
          created_at?: string | null
          daily_rate?: number | null
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
      products: {
        Row: {
          client_campaign_id: string | null
          commission_dkk: number | null
          created_at: string | null
          external_product_code: string | null
          id: string
          name: string
          revenue_dkk: number | null
          updated_at: string | null
        }
        Insert: {
          client_campaign_id?: string | null
          commission_dkk?: number | null
          created_at?: string | null
          external_product_code?: string | null
          id?: string
          name: string
          revenue_dkk?: number | null
          updated_at?: string | null
        }
        Update: {
          client_campaign_id?: string | null
          commission_dkk?: number | null
          created_at?: string | null
          external_product_code?: string | null
          id?: string
          name?: string
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
        ]
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
      pulse_survey_responses: {
        Row: {
          created_at: string
          department: string | null
          development_score: number
          energy_score: number
          id: string
          improvement_suggestions: string | null
          leader_availability_score: number
          leadership_score: number
          nps_comment: string | null
          nps_score: number
          psychological_safety_score: number
          recognition_score: number
          seriousness_score: number
          survey_id: string
          tenure: string
          wellbeing_score: number
        }
        Insert: {
          created_at?: string
          department?: string | null
          development_score: number
          energy_score: number
          id?: string
          improvement_suggestions?: string | null
          leader_availability_score: number
          leadership_score: number
          nps_comment?: string | null
          nps_score: number
          psychological_safety_score: number
          recognition_score: number
          seriousness_score: number
          survey_id: string
          tenure: string
          wellbeing_score: number
        }
        Update: {
          created_at?: string
          department?: string | null
          development_score?: number
          energy_score?: number
          id?: string
          improvement_suggestions?: string | null
          leader_availability_score?: number
          leadership_score?: number
          nps_comment?: string | null
          nps_score?: number
          psychological_safety_score?: number
          recognition_score?: number
          seriousness_score?: number
          survey_id?: string
          tenure?: string
          wellbeing_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
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
      sale_items: {
        Row: {
          adversus_external_id: string | null
          adversus_product_title: string | null
          created_at: string | null
          id: string
          mapped_commission: number | null
          mapped_revenue: number | null
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
          created_at?: string | null
          id?: string
          mapped_commission?: number | null
          mapped_revenue?: number | null
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
          created_at?: string | null
          id?: string
          mapped_commission?: number | null
          mapped_revenue?: number | null
          needs_mapping?: boolean | null
          product_id?: string | null
          quantity?: number | null
          raw_data?: Json | null
          sale_id?: string
          unit_price?: number | null
        }
        Relationships: [
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
          adversus_opp_number: string | null
          agent_external_id: string | null
          agent_name: string | null
          client_campaign_id: string | null
          created_at: string | null
          customer_company: string | null
          customer_phone: string | null
          id: string
          sale_datetime: string
          updated_at: string | null
        }
        Insert: {
          adversus_event_id?: string | null
          adversus_external_id?: string | null
          adversus_opp_number?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          id?: string
          sale_datetime?: string
          updated_at?: string | null
        }
        Update: {
          adversus_event_id?: string | null
          adversus_external_id?: string | null
          adversus_opp_number?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          id?: string
          sale_datetime?: string
          updated_at?: string | null
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_role_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["system_role"]
        }
        Returns: undefined
      }
      contract_has_pending_signature: {
        Args: { contract_uuid: string }
        Returns: boolean
      }
      get_agent_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_current_employee_id: { Args: never; Returns: string }
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
          role: Database["public"]["Enums"]["system_role"]
          role_id: string
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["system_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_my_team: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_rekruttering: { Args: { _user_id: string }; Returns: boolean }
      is_teamleder_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_vagt_admin_or_planner: { Args: { _user_id: string }; Returns: boolean }
      remove_role_by_email: { Args: { _email: string }; Returns: undefined }
    }
    Enums: {
      absence_request_status: "pending" | "approved" | "rejected"
      absence_type: "sick" | "vacation" | "other"
      absence_type_v2: "vacation" | "sick"
      app_role: "admin" | "payroll" | "manager" | "agent"
      booking_status: "Planlagt" | "Bekræftet" | "Aflyst" | "Afsluttet"
      commission_transaction_type: "earn" | "clawback" | "manual_adjustment"
      commission_type: "fixed" | "percentage"
      communication_channel: "Telefon" | "Mail" | "Andet"
      contract_status:
        | "draft"
        | "pending_employee"
        | "pending_manager"
        | "signed"
        | "rejected"
        | "expired"
      contract_type:
        | "employment"
        | "amendment"
        | "nda"
        | "company_car"
        | "termination"
        | "other"
      employment_type: "hourly" | "monthly"
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
      system_role: "medarbejder" | "teamleder" | "ejer" | "rekruttering"
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
      absence_type_v2: ["vacation", "sick"],
      app_role: ["admin", "payroll", "manager", "agent"],
      booking_status: ["Planlagt", "Bekræftet", "Aflyst", "Afsluttet"],
      commission_transaction_type: ["earn", "clawback", "manual_adjustment"],
      commission_type: ["fixed", "percentage"],
      communication_channel: ["Telefon", "Mail", "Andet"],
      contract_status: [
        "draft",
        "pending_employee",
        "pending_manager",
        "signed",
        "rejected",
        "expired",
      ],
      contract_type: [
        "employment",
        "amendment",
        "nda",
        "company_car",
        "termination",
        "other",
      ],
      employment_type: ["hourly", "monthly"],
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
      system_role: ["medarbejder", "teamleder", "ejer", "rekruttering"],
      vacation_type: ["vacation_pay", "vacation_bonus"],
      vagt_absence_reason: ["Ferie", "Syg", "Barn syg", "Andet"],
      vagt_flow_role: ["admin", "planner", "employee", "brand_viewer"],
    },
  },
} as const
