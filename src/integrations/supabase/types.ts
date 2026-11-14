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
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          created_at: string
          hours: string | null
          id: string
          is_published: boolean
          locality: string | null
          phone: string | null
          public_name: string
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          is_published?: boolean
          locality?: string | null
          phone?: string | null
          public_name: string
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          hours?: string | null
          id?: string
          is_published?: boolean
          locality?: string | null
          phone?: string | null
          public_name?: string
          slug?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          business_id: string
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
          business_id?: string
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
          business_id?: string
          created_at?: string | null
          date?: string
          id?: string
          invoice_id?: string
          mode?: string
          notes?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_orders: {
        Row: {
          business_id: string
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          items: Json
          note: string | null
          order_code: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          items?: Json
          note?: string | null
          order_code: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          items?: Json
          note?: string | null
          order_code?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_purchases: {
        Row: {
          business_id: string
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
          business_id?: string
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
          business_id?: string
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
        Relationships: [
          {
            foreignKeyName: "product_purchases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_movements: {
        Row: {
          balance_after: number
          business_id: string
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
          business_id?: string
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
          business_id?: string
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
        Relationships: [
          {
            foreignKeyName: "product_stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_import_logs: {
        Row: {
          business_id: string
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
          business_id?: string
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
          business_id?: string
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
        Relationships: [
          {
            foreignKeyName: "purchase_import_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          business_id: string
          category: string | null
          description: string | null
          in_stock: boolean
          name: string
          price: number
          product_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string
          category?: string | null
          description?: string | null
          in_stock?: boolean
          name: string
          price?: number
          product_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          description?: string | null
          in_stock?: boolean
          name?: string
          price?: number
          product_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_business: {
        Args: {
          _category?: string
          _city?: string
          _locality?: string
          _public_name: string
          _slug: string
        }
        Returns: string
      }
      current_business_id: { Args: never; Returns: string }
      is_business_member: {
        Args: {
          _business_id: string
          _roles?: Database["public"]["Enums"]["business_role"][]
        }
        Returns: boolean
      }
      place_pickup_order: {
        Args: {
          _items: Json
          _name: string
          _note: string
          _phone: string
          _slug: string
        }
        Returns: string
      }
      record_product_stock_purchase: {
        Args: { payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      business_role: "owner" | "manager" | "staff"
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
    Enums: {
      business_role: ["owner", "manager", "staff"],
    },
  },
} as const
