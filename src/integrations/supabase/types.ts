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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      positions: {
        Row: {
          color: string
          created_at: string
          heading: number
          id: string
          name: string
          pitch: number
          project_id: string
          roll: number
          sort_order: number
          type: string
          x: number
          y: number
          z: number
        }
        Insert: {
          color?: string
          created_at?: string
          heading?: number
          id?: string
          name: string
          pitch?: number
          project_id: string
          roll?: number
          sort_order?: number
          type?: string
          x?: number
          y?: number
          z?: number
        }
        Update: {
          color?: string
          created_at?: string
          heading?: number
          id?: string
          name?: string
          pitch?: number
          project_id?: string
          roll?: number
          sort_order?: number
          type?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          audio_url: string | null
          bpm: number | null
          created_at: string
          duration: number
          id: string
          name: string
          playback_speed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          duration?: number
          id?: string
          name?: string
          playback_speed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          duration?: number
          id?: string
          name?: string
          playback_speed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      show_settings: {
        Row: {
          channel_count: number | null
          client_name: string | null
          created_at: string
          fallout_radius: number | null
          firing_system: string | null
          fleet_size: number | null
          geofence_radius: number | null
          gps_alt: number | null
          gps_lat: number | null
          gps_lng: number | null
          humidity: number | null
          id: string
          led_fps: number | null
          license_number: string | null
          max_altitude: number | null
          max_velocity: number | null
          module_count: number | null
          nfpa_category: string | null
          notes: string | null
          project_id: string
          protocol: string | null
          safety_radius: number | null
          show_date: string | null
          start_method: string | null
          temperature: number | null
          timezone: string | null
          updated_at: string
          venue_name: string | null
          wind_direction: number | null
          wind_speed: number | null
        }
        Insert: {
          channel_count?: number | null
          client_name?: string | null
          created_at?: string
          fallout_radius?: number | null
          firing_system?: string | null
          fleet_size?: number | null
          geofence_radius?: number | null
          gps_alt?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          humidity?: number | null
          id?: string
          led_fps?: number | null
          license_number?: string | null
          max_altitude?: number | null
          max_velocity?: number | null
          module_count?: number | null
          nfpa_category?: string | null
          notes?: string | null
          project_id: string
          protocol?: string | null
          safety_radius?: number | null
          show_date?: string | null
          start_method?: string | null
          temperature?: number | null
          timezone?: string | null
          updated_at?: string
          venue_name?: string | null
          wind_direction?: number | null
          wind_speed?: number | null
        }
        Update: {
          channel_count?: number | null
          client_name?: string | null
          created_at?: string
          fallout_radius?: number | null
          firing_system?: string | null
          fleet_size?: number | null
          geofence_radius?: number | null
          gps_alt?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          humidity?: number | null
          id?: string
          led_fps?: number | null
          license_number?: string | null
          max_altitude?: number | null
          max_velocity?: number | null
          module_count?: number | null
          nfpa_category?: string | null
          notes?: string | null
          project_id?: string
          protocol?: string | null
          safety_radius?: number | null
          show_date?: string | null
          start_method?: string | null
          temperature?: number | null
          timezone?: string | null
          updated_at?: string
          venue_name?: string | null
          wind_direction?: number | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "show_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_items: {
        Row: {
          created_at: string
          effect_id: string
          id: string
          pos_x: number
          pos_y: number
          pos_z: number
          project_id: string
          start_time: number
          track_index: number
        }
        Insert: {
          created_at?: string
          effect_id: string
          id?: string
          pos_x?: number
          pos_y?: number
          pos_z?: number
          project_id: string
          start_time?: number
          track_index?: number
        }
        Update: {
          created_at?: string
          effect_id?: string
          id?: string
          pos_x?: number
          pos_y?: number
          pos_z?: number
          project_id?: string
          start_time?: number
          track_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "timeline_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectories: {
        Row: {
          created_at: string
          id: string
          name: string
          position_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          position_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectories_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trajectories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      waypoints: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          time_seconds: number
          trajectory_id: string
          x: number
          y: number
          z: number
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          time_seconds?: number
          trajectory_id: string
          x?: number
          y?: number
          z?: number
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          time_seconds?: number
          trajectory_id?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "waypoints_trajectory_id_fkey"
            columns: ["trajectory_id"]
            isOneToOne: false
            referencedRelation: "trajectories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
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
