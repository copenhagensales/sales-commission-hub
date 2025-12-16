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
      booking: {
        Row: {
          application_deadline: string | null
          booked_days: number[] | null
          brand_id: string
          comment: string | null
          created_at: string | null
          end_date: string
          expected_staff_count: number | null
          id: string
          location_id: string
          open_for_applications: boolean | null
          start_date: string
          status: Database["public"]["Enums"]["booking_status"] | null
          updated_at: string | null
          visible_from: string | null
          week_number: number
          year: number
        }
        Insert: {
          application_deadline?: string | null
          booked_days?: number[] | null
          brand_id: string
          comment?: string | null
          created_at?: string | null
          end_date: string
          expected_staff_count?: number | null
          id?: string
          location_id: string
          open_for_applications?: boolean | null
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
          visible_from?: string | null
          week_number: number
          year: number
        }
        Update: {
          application_deadline?: string | null
          booked_days?: number[] | null
          brand_id?: string
          comment?: string | null
          created_at?: string | null
          end_date?: string
          expected_staff_count?: number | null
          id?: string
          location_id?: string
          open_for_applications?: boolean | null
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
          visible_from?: string | null
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          applied_position: string | null
          assigned_to: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          interview_date: string | null
          last_name: string
          notes: string | null
          phone: string | null
          rating: number | null
          resume_url: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_position?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          interview_date?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_position?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          interview_date?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          resume_url?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
      closing_shifts: {
        Row: {
          created_at: string
          email: string | null
          employee_name: string | null
          id: string
          phone: string | null
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
          tasks?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: []
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
          created_at: string
          direction: string
          id: string
          outcome: string | null
          read: boolean
          twilio_sid: string | null
          type: string
        }
        Insert: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          outcome?: string | null
          read?: boolean
          twilio_sid?: string | null
          type: string
        }
        Update: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          outcome?: string | null
          read?: boolean
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
      crm_excel_import_rows: {
        Row: {
          action_type: string | null
          amount_deduct: string | null
          created_at: string
          customer_name: string | null
          date: string | null
          external_id: string | null
          id: string
          import_id: string
          is_matched: boolean | null
          matched_sale_id: string | null
          opp_number: string | null
          ordre_id: string | null
          phone_number: string | null
          raw_data: Json | null
          status: string | null
        }
        Insert: {
          action_type?: string | null
          amount_deduct?: string | null
          created_at?: string
          customer_name?: string | null
          date?: string | null
          external_id?: string | null
          id?: string
          import_id: string
          is_matched?: boolean | null
          matched_sale_id?: string | null
          opp_number?: string | null
          ordre_id?: string | null
          phone_number?: string | null
          raw_data?: Json | null
          status?: string | null
        }
        Update: {
          action_type?: string | null
          amount_deduct?: string | null
          created_at?: string
          customer_name?: string | null
          date?: string | null
          external_id?: string | null
          id?: string
          import_id?: string
          is_matched?: boolean | null
          matched_sale_id?: string | null
          opp_number?: string | null
          ordre_id?: string | null
          phone_number?: string | null
          raw_data?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_excel_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "crm_excel_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_excel_import_rows_matched_sale_id_fkey"
            columns: ["matched_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_excel_imports: {
        Row: {
          cancelled_count: number | null
          client_id: string
          column_mapping: Json | null
          filename: string
          id: string
          matched_count: number | null
          row_count: number
          uploaded_at: string
          uploaded_by: string | null
          validated_at: string | null
          validation_status: string | null
        }
        Insert: {
          cancelled_count?: number | null
          client_id: string
          column_mapping?: Json | null
          filename: string
          id?: string
          matched_count?: number | null
          row_count?: number
          uploaded_at?: string
          uploaded_by?: string | null
          validated_at?: string | null
          validation_status?: string | null
        }
        Update: {
          cancelled_count?: number | null
          client_id?: string
          column_mapping?: Json | null
          filename?: string
          id?: string
          matched_count?: number | null
          row_count?: number
          uploaded_at?: string
          uploaded_by?: string | null
          validated_at?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_excel_imports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_integrations: {
        Row: {
          api_url: string | null
          client_id: string
          config: Json | null
          created_at: string | null
          crm_type: Database["public"]["Enums"]["crm_type"]
          cron_schedule: string | null
          encrypted_credentials: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          last_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_url?: string | null
          client_id: string
          config?: Json | null
          created_at?: string | null
          crm_type: Database["public"]["Enums"]["crm_type"]
          cron_schedule?: string | null
          encrypted_credentials: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_url?: string | null
          client_id?: string
          config?: Json | null
          created_at?: string | null
          crm_type?: Database["public"]["Enums"]["crm_type"]
          cron_schedule?: string | null
          encrypted_credentials?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
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
        ]
      }
      dialer_integrations: {
        Row: {
          api_url: string | null
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
            referencedRelation: "employee_master_data"
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
          referral_bonus: number | null
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
          referral_bonus?: number | null
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
          referral_bonus?: number | null
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
          {
            foreignKeyName: "employee_master_data_team_id_fkey"
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
            referencedRelation: "employee_master_data"
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
            foreignKeyName: "extra_work_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift"
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
      gdpr_consents: {
        Row: {
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
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          integration_id: string | null
          integration_name: string | null
          integration_type: string
          message: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          integration_type: string
          message: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          integration_type?: string
          message?: string
          status?: string
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
      market_application: {
        Row: {
          applied_at: string
          booking_id: string
          created_at: string | null
          employee_id: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["market_application_status"]
          updated_at: string | null
        }
        Insert: {
          applied_at?: string
          booking_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["market_application_status"]
          updated_at?: string | null
        }
        Update: {
          applied_at?: string
          booking_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["market_application_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_application_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_application_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_application_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "employee_master_data"
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
        Relationships: [
          {
            foreignKeyName: "performance_reviews_recruitment_employee_id_fkey"
            columns: ["recruitment_employee_id"]
            isOneToOne: false
            referencedRelation: "recruitment_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_campaign_id: string | null
          commission_dkk: number | null
          counts_as_sale: boolean
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
          counts_as_sale?: boolean
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
          counts_as_sale?: boolean
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
          development_score: number | null
          energy_score: number | null
          id: string
          improvement_suggestions: string | null
          leader_availability_score: number | null
          leadership_score: number | null
          nps_comment: string | null
          nps_score: number
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
          created_at?: string
          department?: string | null
          development_score?: number | null
          energy_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          leader_availability_score?: number | null
          leadership_score?: number | null
          nps_comment?: string | null
          nps_score: number
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
          created_at?: string
          department?: string | null
          development_score?: number | null
          energy_score?: number | null
          id?: string
          improvement_suggestions?: string | null
          leader_availability_score?: number | null
          leadership_score?: number | null
          nps_comment?: string | null
          nps_score?: number
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
      recruitment_employees: {
        Row: {
          candidate_id: string
          created_at: string
          deadline: string | null
          employment_end_reason: string | null
          employment_ended_date: string | null
          hired_date: string | null
          id: string
          role: string
          sub_team: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          deadline?: string | null
          employment_end_reason?: string | null
          employment_ended_date?: string | null
          hired_date?: string | null
          id?: string
          role: string
          sub_team?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          deadline?: string | null
          employment_end_reason?: string | null
          employment_ended_date?: string | null
          hired_date?: string | null
          id?: string
          role?: string
          sub_team?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_employees_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      revenue_data: {
        Row: {
          created_at: string
          id: string
          period: number
          recruitment_employee_id: string
          revenue: number
        }
        Insert: {
          created_at?: string
          id?: string
          period: number
          recruitment_employee_id: string
          revenue?: number
        }
        Update: {
          created_at?: string
          id?: string
          period?: number
          recruitment_employee_id?: string
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_data_recruitment_employee_id_fkey"
            columns: ["recruitment_employee_id"]
            isOneToOne: false
            referencedRelation: "recruitment_employees"
            referencedColumns: ["id"]
          },
        ]
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
          agent_email: string | null
          agent_external_id: string | null
          agent_name: string | null
          client_campaign_id: string | null
          created_at: string | null
          customer_company: string | null
          customer_phone: string | null
          dialer_campaign_id: string | null
          id: string
          integration_type: string | null
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
          adversus_opp_number?: string | null
          agent_email?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          dialer_campaign_id?: string | null
          id?: string
          integration_type?: string | null
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
          adversus_opp_number?: string | null
          agent_email?: string | null
          agent_external_id?: string | null
          agent_name?: string | null
          client_campaign_id?: string | null
          created_at?: string | null
          customer_company?: string | null
          customer_phone?: string | null
          dialer_campaign_id?: string | null
          id?: string
          integration_type?: string | null
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
      sub_teams: {
        Row: {
          created_at: string
          id: string
          name: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
            isOneToOne: false
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
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          team_leader_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "employee_master_data"
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
            referencedRelation: "employee_master_data"
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
      can_view_employee: {
        Args: { _employee_id: string; _user_id: string }
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
      get_agent_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_aggregated_product_types: {
        Args: never
        Returns: {
          adversus_external_id: string
          adversus_product_title: string
          client_id: string
          client_name: string
          commission_dkk: number
          counts_as_sale: boolean
          product_client_campaign_id: string
          product_id: string
          product_name: string
          revenue_dkk: number
          sale_source: string
        }[]
      }
      get_auth_email_by_work_email: {
        Args: { _work_email: string }
        Returns: string
      }
      get_auth_user_id_by_email: { Args: { _email: string }; Returns: string }
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
      get_user_granted_permissions: {
        Args: { _user_id: string }
        Returns: string[]
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
      is_owner_only: { Args: { _user_id: string }; Returns: boolean }
      is_rekruttering: { Args: { _user_id: string }; Returns: boolean }
      is_some: { Args: { _user_id: string }; Returns: boolean }
      is_teamleder_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_vagt_admin_or_planner: { Args: { _user_id: string }; Returns: boolean }
      remove_role_by_email: { Args: { _email: string }; Returns: undefined }
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
      unschedule_integration_sync: {
        Args: { p_job_name: string }
        Returns: boolean
      }
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
      contract_type:
        | "employment"
        | "amendment"
        | "nda"
        | "company_car"
        | "termination"
        | "other"
      crm_type: "hubspot" | "salesforce" | "pipedrive" | "generic_api" | "excel"
      employment_type: "hourly" | "monthly"
      leadership_interest: "yes" | "maybe" | "no"
      leadership_role_type: "junior_teamleder" | "teamleder" | "coach" | "other"
      location_status: "Ny" | "Aktiv" | "Pause" | "Sortlistet"
      market_application_status: "pending" | "approved" | "rejected"
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
      absence_type_v2: ["vacation", "sick"],
      app_role: ["admin", "payroll", "manager", "agent"],
      booking_status: ["Planlagt", "Bekræftet", "Aflyst", "Afsluttet"],
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
      ],
      contract_type: [
        "employment",
        "amendment",
        "nda",
        "company_car",
        "termination",
        "other",
      ],
      crm_type: ["hubspot", "salesforce", "pipedrive", "generic_api", "excel"],
      employment_type: ["hourly", "monthly"],
      leadership_interest: ["yes", "maybe", "no"],
      leadership_role_type: ["junior_teamleder", "teamleder", "coach", "other"],
      location_status: ["Ny", "Aktiv", "Pause", "Sortlistet"],
      market_application_status: ["pending", "approved", "rejected"],
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
