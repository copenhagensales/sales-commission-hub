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
