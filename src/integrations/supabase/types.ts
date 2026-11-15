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
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
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
      company_settings: {
        Row: {
          address: string | null
          bank_details: Json
          business_name: string
          created_at: string
          email: string | null
          extra: Json
          gstin: string | null
          id: string
          invoice_prefix: string
          logo_url: string | null
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_details?: Json
          business_name?: string
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_details?: Json
          business_name?: string
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          email: string | null
          extra: Json
          gstin: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          owner_id: string
          paid_on: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          owner_id: string
          paid_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          paid_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          customer_id: string | null
          customer_snapshot: Json
          discount: number
          due_date: string | null
          extra: Json
          id: string
          invoice_date: string
          invoice_number: string
          items: Json
          notes: string | null
          owner_id: string
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount?: number
          due_date?: string | null
          extra?: Json
          id?: string
          invoice_date?: string
          invoice_number: string
          items?: Json
          notes?: string | null
          owner_id: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount?: number
          due_date?: string | null
          extra?: Json
          id?: string
          invoice_date?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          owner_id?: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      products: {
        Row: {
          created_at: string
          extra: Json
          gst_rate: number
          hsn: string | null
          id: string
          name: string
          owner_id: string
          price: number
          purchase_price: number | null
          sku: string | null
          stock: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra?: Json
          gst_rate?: number
          hsn?: string | null
          id?: string
          name: string
          owner_id: string
          price?: number
          purchase_price?: number | null
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra?: Json
          gst_rate?: number
          hsn?: string | null
          id?: string
          name?: string
          owner_id?: string
          price?: number
          purchase_price?: number | null
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotation_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          template: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          template?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          template?: Json
          updated_at?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_snapshot: Json
          extra: Json
          id: string
          items: Json
          notes: string | null
          owner_id: string
          quotation_date: string
          quotation_number: string
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_snapshot?: Json
          extra?: Json
          id?: string
          items?: Json
          notes?: string | null
          owner_id: string
          quotation_date?: string
          quotation_number: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_snapshot?: Json
          extra?: Json
          id?: string
          items?: Json
          notes?: string | null
          owner_id?: string
          quotation_date?: string
          quotation_number?: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          business_id: string
          category: string | null
          description: string | null
          id: string
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
          id?: string
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
          id?: string
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
      supplier_transactions: {
        Row: {
          amount: number
          created_at: string
          extra: Json
          id: string
          notes: string | null
          owner_id: string
          supplier_id: string
          txn_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          extra?: Json
          id?: string
          notes?: string | null
          owner_id: string
          supplier_id: string
          txn_date?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          extra?: Json
          id?: string
          notes?: string | null
          owner_id?: string
          supplier_id?: string
          txn_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          email: string | null
          extra: Json
          gstin: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          extra?: Json
          gstin?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
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
      user_settings: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_business: {
        Args: {
          _category: string
          _city: string
          _locality: string
          _phone?: string
          _public_name: string
          _slug: string
        }
        Returns: string
      }
      current_business_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
