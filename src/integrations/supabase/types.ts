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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dealers: {
        Row: {
          additional_locations: Json | null
          annexures: Json | null
          bank_details: Json | null
          category: string | null
          commitments: Json | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          demo_farmers_data: Json | null
          distributor_links: Json | null
          documents: Json | null
          est_year: string | null
          firm_type: string | null
          gst_number: string | null
          id: string
          owners_list: Json | null
          pan_number: string | null
          pdf_url: string | null
          primary_address: string | null
          primary_shop_location: Json | null
          primary_shop_name: string | null
          scoring: Json | null
          se_id: string | null
          status: string | null
          total_score: number | null
        }
        Insert: {
          additional_locations?: Json | null
          annexures?: Json | null
          bank_details?: Json | null
          category?: string | null
          commitments?: Json | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          demo_farmers_data?: Json | null
          distributor_links?: Json | null
          documents?: Json | null
          est_year?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owners_list?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          primary_address?: string | null
          primary_shop_location?: Json | null
          primary_shop_name?: string | null
          scoring?: Json | null
          se_id?: string | null
          status?: string | null
          total_score?: number | null
        }
        Update: {
          additional_locations?: Json | null
          annexures?: Json | null
          bank_details?: Json | null
          category?: string | null
          commitments?: Json | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          demo_farmers_data?: Json | null
          distributor_links?: Json | null
          documents?: Json | null
          est_year?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owners_list?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          primary_address?: string | null
          primary_shop_location?: Json | null
          primary_shop_name?: string | null
          scoring?: Json | null
          se_id?: string | null
          status?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealers_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          address: string | null
          annexures: Json | null
          band: string | null
          bank_details: Json | null
          business_scope: Json | null
          city: string | null
          commitments: Json | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          dealer_network: Json | null
          documents: Json | null
          email: string | null
          est_year: string | null
          firm_name: string | null
          firm_type: string | null
          gst_number: string | null
          id: string
          owner_name: string | null
          pan_number: string | null
          pdf_url: string | null
          pincode: string | null
          raw_data: Json | null
          scoring: Json | null
          se_id: string | null
          state: string | null
          status: string | null
          taluka: string | null
          total_score: number | null
        }
        Insert: {
          address?: string | null
          annexures?: Json | null
          band?: string | null
          bank_details?: Json | null
          business_scope?: Json | null
          city?: string | null
          commitments?: Json | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          dealer_network?: Json | null
          documents?: Json | null
          email?: string | null
          est_year?: string | null
          firm_name?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owner_name?: string | null
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          raw_data?: Json | null
          scoring?: Json | null
          se_id?: string | null
          state?: string | null
          status?: string | null
          taluka?: string | null
          total_score?: number | null
        }
        Update: {
          address?: string | null
          annexures?: Json | null
          band?: string | null
          bank_details?: Json | null
          business_scope?: Json | null
          city?: string | null
          commitments?: Json | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          dealer_network?: Json | null
          documents?: Json | null
          email?: string | null
          est_year?: string | null
          firm_name?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owner_name?: string | null
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          raw_data?: Json | null
          scoring?: Json | null
          se_id?: string | null
          state?: string | null
          status?: string | null
          taluka?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "distributors_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          created_at: string
          dealer_id: string | null
          farm_details: Json | null
          full_name: string | null
          history_details: Json | null
          id: string
          mobile: string | null
          pdf_url: string | null
          personal_details: Json | null
          se_id: string | null
          status: string | null
          village: string | null
        }
        Insert: {
          created_at?: string
          dealer_id?: string | null
          farm_details?: Json | null
          full_name?: string | null
          history_details?: Json | null
          id?: string
          mobile?: string | null
          pdf_url?: string | null
          personal_details?: Json | null
          se_id?: string | null
          status?: string | null
          village?: string | null
        }
        Update: {
          created_at?: string
          dealer_id?: string | null
          farm_details?: Json | null
          full_name?: string | null
          history_details?: Json | null
          id?: string
          mobile?: string | null
          pdf_url?: string | null
          personal_details?: Json | null
          se_id?: string | null
          status?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmers_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          role?: string
        }
        Relationships: []
      }
      sales_executive: {
        Row: {
          assets_details: Json | null
          created_at: string
          documents: Json | null
          financial_details: Json | null
          is_profile_complete: boolean
          organization_details: Json | null
          personal_details: Json | null
          profile_id: string
        }
        Insert: {
          assets_details?: Json | null
          created_at?: string
          documents?: Json | null
          financial_details?: Json | null
          is_profile_complete?: boolean
          organization_details?: Json | null
          personal_details?: Json | null
          profile_id: string
        }
        Update: {
          assets_details?: Json | null
          created_at?: string
          documents?: Json | null
          financial_details?: Json | null
          is_profile_complete?: boolean
          organization_details?: Json | null
          personal_details?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_executive_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
