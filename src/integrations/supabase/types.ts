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
          contact_mobile: string
          contact_person: string
          created_at: string | null
          dealer_signature: string | null
          demo_farmers_data: Json | null
          distributor_links: Json | null
          documents: Json | null
          est_year: string | null
          firm_type: string | null
          gst_number: string | null
          id: string
          landline_number: string | null
          landmark: string | null
          owners_list: Json | null
          pan_number: string | null
          pdf_url: string | null
          primary_address: string
          primary_shop_location: Json | null
          primary_shop_name: string
          proposed_status: string | null
          scoring: Json | null
          se_id: string | null
          se_signature: string | null
          status: string | null
          total_score: number | null
          update_history: Json | null
          updated_at: string | null
        }
        Insert: {
          additional_locations?: Json | null
          annexures?: Json | null
          bank_details?: Json | null
          category?: string | null
          commitments?: Json | null
          contact_mobile: string
          contact_person: string
          created_at?: string | null
          dealer_signature?: string | null
          demo_farmers_data?: Json | null
          distributor_links?: Json | null
          documents?: Json | null
          est_year?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          landline_number?: string | null
          landmark?: string | null
          owners_list?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          primary_address: string
          primary_shop_location?: Json | null
          primary_shop_name: string
          proposed_status?: string | null
          scoring?: Json | null
          se_id?: string | null
          se_signature?: string | null
          status?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          additional_locations?: Json | null
          annexures?: Json | null
          bank_details?: Json | null
          category?: string | null
          commitments?: Json | null
          contact_mobile?: string
          contact_person?: string
          created_at?: string | null
          dealer_signature?: string | null
          demo_farmers_data?: Json | null
          distributor_links?: Json | null
          documents?: Json | null
          est_year?: string | null
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          landline_number?: string | null
          landmark?: string | null
          owners_list?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          primary_address?: string
          primary_shop_location?: Json | null
          primary_shop_name?: string
          proposed_status?: string | null
          scoring?: Json | null
          se_id?: string | null
          se_signature?: string | null
          status?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
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
          address: string
          annexures: Json | null
          band: string | null
          bank_details: Json | null
          business_scope: Json | null
          city: string
          commitments: Json | null
          contact_designation: string | null
          contact_mobile: string
          contact_person: string
          created_at: string | null
          dealer_network: Json | null
          distributor_signature: string | null
          documents: Json | null
          email: string | null
          est_year: string | null
          firm_name: string
          firm_type: string | null
          gst_number: string | null
          id: string
          owner_name: string
          pan_number: string | null
          pdf_url: string | null
          pincode: string | null
          raw_data: Json | null
          scoring: Json | null
          se_id: string
          se_signature: string | null
          state: string
          status: string | null
          taluka: string | null
          total_score: number | null
          update_history: Json | null
          updated_at: string | null
        }
        Insert: {
          address: string
          annexures?: Json | null
          band?: string | null
          bank_details?: Json | null
          business_scope?: Json | null
          city: string
          commitments?: Json | null
          contact_designation?: string | null
          contact_mobile: string
          contact_person: string
          created_at?: string | null
          dealer_network?: Json | null
          distributor_signature?: string | null
          documents?: Json | null
          email?: string | null
          est_year?: string | null
          firm_name: string
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owner_name: string
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          raw_data?: Json | null
          scoring?: Json | null
          se_id: string
          se_signature?: string | null
          state: string
          status?: string | null
          taluka?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          annexures?: Json | null
          band?: string | null
          bank_details?: Json | null
          business_scope?: Json | null
          city?: string
          commitments?: Json | null
          contact_designation?: string | null
          contact_mobile?: string
          contact_person?: string
          created_at?: string | null
          dealer_network?: Json | null
          distributor_signature?: string | null
          documents?: Json | null
          email?: string | null
          est_year?: string | null
          firm_name?: string
          firm_type?: string | null
          gst_number?: string | null
          id?: string
          owner_name?: string
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          raw_data?: Json | null
          scoring?: Json | null
          se_id?: string
          se_signature?: string | null
          state?: string
          status?: string | null
          taluka?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
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
      districts: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          created_at: string | null
          current_step: number
          draft_data: Json
          entity_id: string
          entity_type: string
          id: string
          se_id: string
          update_history: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step?: number
          draft_data?: Json
          entity_id: string
          entity_type: string
          id?: string
          se_id: string
          update_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: number
          draft_data?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          se_id?: string
          update_history?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drafts_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string
          id: string
          receipt_url: string
          remarks: string | null
          se_id: string
          shift_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date: string
          id?: string
          receipt_url: string
          remarks?: string | null
          se_id: string
          shift_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          id?: string
          receipt_url?: string
          remarks?: string | null
          se_id?: string
          shift_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          created_at: string | null
          dealer_id: string | null
          farm_details: Json
          farmer_signature: string
          full_name: string
          history_details: Json
          id: string
          mobile: string
          pdf_url: string | null
          personal_details: Json
          se_id: string
          se_signature: string
          status: string | null
          update_history: Json | null
          updated_at: string | null
          village: string
        }
        Insert: {
          created_at?: string | null
          dealer_id?: string | null
          farm_details?: Json
          farmer_signature: string
          full_name: string
          history_details?: Json
          id?: string
          mobile: string
          pdf_url?: string | null
          personal_details?: Json
          se_id: string
          se_signature: string
          status?: string | null
          update_history?: Json | null
          updated_at?: string | null
          village: string
        }
        Update: {
          created_at?: string | null
          dealer_id?: string | null
          farm_details?: Json
          farmer_signature?: string
          full_name?: string
          history_details?: Json
          id?: string
          mobile?: string
          pdf_url?: string | null
          personal_details?: Json
          se_id?: string
          se_signature?: string
          status?: string | null
          update_history?: Json | null
          updated_at?: string | null
          village?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmers_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fpos: {
        Row: {
          address: string
          agreement_accepted: boolean | null
          band: string | null
          bank_details: Json | null
          bod_president_name: string
          business_scope: Json | null
          ceo_name: string
          city: string
          command_area: string | null
          commitments: Json | null
          contact_mobile: string
          created_at: string | null
          documents: Json | null
          email: string | null
          fpo_name: string
          fpo_signature: string | null
          gst_number: string | null
          id: string
          incorporation_year: string | null
          member_base: Json | null
          pan_number: string | null
          pdf_url: string | null
          pincode: string | null
          promoting_agency: string | null
          registration_number: string | null
          scoring: Json | null
          se_id: string
          se_signature: string | null
          state: string
          status: string | null
          storage_locations: Json | null
          taluka: string | null
          total_score: number | null
          update_history: Json | null
          updated_at: string | null
        }
        Insert: {
          address: string
          agreement_accepted?: boolean | null
          band?: string | null
          bank_details?: Json | null
          bod_president_name: string
          business_scope?: Json | null
          ceo_name: string
          city: string
          command_area?: string | null
          commitments?: Json | null
          contact_mobile: string
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          fpo_name: string
          fpo_signature?: string | null
          gst_number?: string | null
          id?: string
          incorporation_year?: string | null
          member_base?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          promoting_agency?: string | null
          registration_number?: string | null
          scoring?: Json | null
          se_id: string
          se_signature?: string | null
          state: string
          status?: string | null
          storage_locations?: Json | null
          taluka?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          agreement_accepted?: boolean | null
          band?: string | null
          bank_details?: Json | null
          bod_president_name?: string
          business_scope?: Json | null
          ceo_name?: string
          city?: string
          command_area?: string | null
          commitments?: Json | null
          contact_mobile?: string
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          fpo_name?: string
          fpo_signature?: string | null
          gst_number?: string | null
          id?: string
          incorporation_year?: string | null
          member_base?: Json | null
          pan_number?: string | null
          pdf_url?: string | null
          pincode?: string | null
          promoting_agency?: string | null
          registration_number?: string | null
          scoring?: Json | null
          se_id?: string
          se_signature?: string | null
          state?: string
          status?: string | null
          storage_locations?: Json | null
          taluka?: string | null
          total_score?: number | null
          update_history?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpos_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_demo: boolean | null
          mobile: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_demo?: boolean | null
          mobile: string
          name: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean | null
          mobile?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          locations: Json
          name: string
          se_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          locations?: Json
          name: string
          se_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          locations?: Json
          name?: string
          se_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_executive: {
        Row: {
          assets_details: Json | null
          created_at: string | null
          documents: Json | null
          financial_details: Json | null
          is_profile_complete: boolean | null
          organization_details: Json | null
          personal_details: Json | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          assets_details?: Json | null
          created_at?: string | null
          documents?: Json | null
          financial_details?: Json | null
          is_profile_complete?: boolean | null
          organization_details?: Json | null
          personal_details?: Json | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          assets_details?: Json | null
          created_at?: string | null
          documents?: Json | null
          financial_details?: Json | null
          is_profile_complete?: boolean | null
          organization_details?: Json | null
          personal_details?: Json | null
          profile_id?: string
          updated_at?: string | null
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
      shift_locations: {
        Row: {
          accuracy: number | null
          created_at: string | null
          heading: number | null
          id: string
          lat: number
          lng: number
          shift_id: string
          speed: number | null
          timestamp: number
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          shift_id: string
          speed?: number | null
          timestamp: number
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          shift_id?: string
          speed?: number | null
          timestamp?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_locations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          activities_logged: number | null
          allowance_status: string | null
          created_at: string | null
          date: string
          end_km: string | null
          end_location: Json | null
          end_odo_image: string | null
          end_time: number | null
          events: Json
          id: string
          is_personal_vehicle: boolean | null
          route_path: Json | null
          se_id: string
          start_km: string | null
          start_location: Json | null
          start_odo_image: string | null
          start_time: number
          status: string
          total_distance: number | null
          transit_mode: string | null
          updated_at: string | null
          vehicle_type: string | null
        }
        Insert: {
          activities_logged?: number | null
          allowance_status?: string | null
          created_at?: string | null
          date?: string
          end_km?: string | null
          end_location?: Json | null
          end_odo_image?: string | null
          end_time?: number | null
          events?: Json
          id?: string
          is_personal_vehicle?: boolean | null
          route_path?: Json | null
          se_id: string
          start_km?: string | null
          start_location?: Json | null
          start_odo_image?: string | null
          start_time: number
          status?: string
          total_distance?: number | null
          transit_mode?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Update: {
          activities_logged?: number | null
          allowance_status?: string | null
          created_at?: string | null
          date?: string
          end_km?: string | null
          end_location?: Json | null
          end_odo_image?: string | null
          end_time?: number | null
          events?: Json
          id?: string
          is_personal_vehicle?: boolean | null
          route_path?: Json | null
          se_id?: string
          start_km?: string | null
          start_location?: Json | null
          start_odo_image?: string | null
          start_time?: number
          status?: string
          total_distance?: number | null
          transit_mode?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_se_id_fkey"
            columns: ["se_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talukas: {
        Row: {
          created_at: string | null
          district_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          district_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          district_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "talukas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          id: string
          module_name: string
          user_id: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module_name: string
          user_id?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      villages: {
        Row: {
          created_at: string | null
          id: string
          name: string
          taluka_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          taluka_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          taluka_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "villages_taluka_id_fkey"
            columns: ["taluka_id"]
            isOneToOne: false
            referencedRelation: "talukas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
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
