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
      absences: {
        Row: {
          agent_id: string
          comment: string | null
          created_at: string | null
          date: string
          hours: number | null
          id: string
          type: Database["public"]["Enums"]["absence_type"] | null
        }
        Insert: {
          agent_id: string
          comment?: string | null
          created_at?: string | null
          date: string
          hours?: number | null
          id?: string
          type?: Database["public"]["Enums"]["absence_type"] | null
        }
        Update: {
          agent_id?: string
          comment?: string | null
          created_at?: string | null
          date?: string
          hours?: number | null
          id?: string
          type?: Database["public"]["Enums"]["absence_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
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
      campaign_product_mappings: {
        Row: {
          adversus_campaign_id: string
          adversus_campaign_name: string
          adversus_outcome: string | null
          created_at: string
          id: string
          product_id: string | null
          updated_at: string
        }
        Insert: {
          adversus_campaign_id: string
          adversus_campaign_name: string
          adversus_outcome?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          adversus_campaign_id?: string
          adversus_campaign_name?: string
          adversus_outcome?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          agent_id: string
          amount: number | null
          created_at: string | null
          id: string
          reason: string | null
          sale_id: string
          type: Database["public"]["Enums"]["commission_transaction_type"]
        }
        Insert: {
          agent_id: string
          amount?: number | null
          created_at?: string | null
          id?: string
          reason?: string | null
          sale_id: string
          type: Database["public"]["Enums"]["commission_transaction_type"]
        }
        Update: {
          agent_id?: string
          amount?: number | null
          created_at?: string | null
          id?: string
          reason?: string | null
          sale_id?: string
          type?: Database["public"]["Enums"]["commission_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
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
      payroll_lines: {
        Row: {
          agent_id: string
          base_salary_amount: number | null
          bonus_amount: number | null
          commission_amount: number | null
          created_at: string | null
          details_json: Json | null
          id: string
          payroll_run_id: string
          sick_deduction_amount: number | null
          total_payout: number | null
          updated_at: string | null
          vacation_pay_base: number | null
        }
        Insert: {
          agent_id: string
          base_salary_amount?: number | null
          bonus_amount?: number | null
          commission_amount?: number | null
          created_at?: string | null
          details_json?: Json | null
          id?: string
          payroll_run_id: string
          sick_deduction_amount?: number | null
          total_payout?: number | null
          updated_at?: string | null
          vacation_pay_base?: number | null
        }
        Update: {
          agent_id?: string
          base_salary_amount?: number | null
          bonus_amount?: number | null
          commission_amount?: number | null
          created_at?: string | null
          details_json?: Json | null
          id?: string
          payroll_run_id?: string
          sick_deduction_amount?: number | null
          total_payout?: number | null
          updated_at?: string | null
          vacation_pay_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payroll_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          clawback_window_days: number | null
          code: string
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          revenue_amount: number | null
          updated_at: string | null
        }
        Insert: {
          clawback_window_days?: number | null
          code: string
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          revenue_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          clawback_window_days?: number | null
          code?: string
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          revenue_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          adversus_call_id: string | null
          agent_id: string
          campaign_name: string | null
          cancellation_date: string | null
          created_at: string | null
          customer_id: string | null
          customer_phone: string | null
          effective_date: string | null
          id: string
          product_id: string
          sale_amount: number | null
          sale_date: string | null
          status: Database["public"]["Enums"]["sale_status"] | null
          updated_at: string | null
        }
        Insert: {
          adversus_call_id?: string | null
          agent_id: string
          campaign_name?: string | null
          cancellation_date?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          effective_date?: string | null
          id?: string
          product_id: string
          sale_amount?: number | null
          sale_date?: string | null
          status?: Database["public"]["Enums"]["sale_status"] | null
          updated_at?: string | null
        }
        Update: {
          adversus_call_id?: string | null
          agent_id?: string
          campaign_name?: string | null
          cancellation_date?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          effective_date?: string | null
          id?: string
          product_id?: string
          sale_amount?: number | null
          sale_date?: string | null
          status?: Database["public"]["Enums"]["sale_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value_json: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value_json?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value_json?: Json | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_agent_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      absence_type: "sick" | "vacation" | "other"
      app_role: "admin" | "payroll" | "manager" | "agent"
      commission_transaction_type: "earn" | "clawback" | "manual_adjustment"
      commission_type: "fixed" | "percentage"
      employment_type: "hourly" | "monthly"
      payroll_status: "draft" | "approved" | "exported"
      sale_status: "pending" | "active" | "cancelled" | "clawbacked"
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
      absence_type: ["sick", "vacation", "other"],
      app_role: ["admin", "payroll", "manager", "agent"],
      commission_transaction_type: ["earn", "clawback", "manual_adjustment"],
      commission_type: ["fixed", "percentage"],
      employment_type: ["hourly", "monthly"],
      payroll_status: ["draft", "approved", "exported"],
      sale_status: ["pending", "active", "cancelled", "clawbacked"],
    },
  },
} as const
