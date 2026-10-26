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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          invoice_id: string
          mode: string
          notes: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id: string
          invoice_id: string
          mode?: string
          notes?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          invoice_id?: string
          mode?: string
          notes?: string | null
          reference?: string | null
        }
        Relationships: []
      }
      product_purchases: {
        Row: {
          created_at: string | null
          details: Json
          id: string
          notes: string | null
          product_id: string
          purchase_date: string
          purchase_price: number
          quantity: number
          quantity_added: number | null
          supplier_name: string | null
          total_purchase_cost: number | null
          total_value: number | null
        }
        Insert: {
          created_at?: string | null
          details?: Json
          id?: string
          notes?: string | null
          product_id: string
          purchase_date?: string
          purchase_price: number
          quantity: number
          quantity_added?: number | null
          supplier_name?: string | null
          total_purchase_cost?: number | null
          total_value?: number | null
        }
        Update: {
          created_at?: string | null
          details?: Json
          id?: string
          notes?: string | null
          product_id?: string
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          quantity_added?: number | null
          supplier_name?: string | null
          total_purchase_cost?: number | null
          total_value?: number | null
        }
        Relationships: []
      }
      product_stock_movements: {
        Row: {
          balance_after: number
          created_at: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity_change: number
          quantity_delta: number | null
          reference_id: string | null
          reference_type: string | null
          stock_balance: number | null
        }
        Insert: {
          balance_after: number
          created_at?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity_change: number
          quantity_delta?: number | null
          reference_id?: string | null
          reference_type?: string | null
          stock_balance?: number | null
        }
        Update: {
          balance_after?: number
          created_at?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity_change?: number
          quantity_delta?: number | null
          reference_id?: string | null
          reference_type?: string | null
          stock_balance?: number | null
        }
        Relationships: []
      }
      purchase_import_logs: {
        Row: {
          created_at: string
          errors: Json
          file_name: string
          format: string
          id: string
          import_date: string
          imported_by: string | null
          invoice_number: string | null
          products_imported: number
          rows: Json
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_value: number
        }
        Insert: {
          created_at?: string
          errors?: Json
          file_name: string
          format: string
          id?: string
          import_date?: string
          imported_by?: string | null
          invoice_number?: string | null
          products_imported?: number
          rows?: Json
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_value?: number
        }
        Update: {
          created_at?: string
          errors?: Json
          file_name?: string
          format?: string
          id?: string
          import_date?: string
          imported_by?: string | null
          invoice_number?: string | null
          products_imported?: number
          rows?: Json
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_product_stock_purchase: {
        Args: { payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
