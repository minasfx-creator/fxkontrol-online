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
      artnet_modules: {
        Row: {
          channel_count: number
          clone_of: string | null
          created_at: string
          dmx_channel_count: number
          dmx_net: number
          dmx_start_address: number
          dmx_subnet: number
          dmx_universe: number
          gps_lat: number | null
          gps_lng: number | null
          id: string
          ip: string
          label: string | null
          module_address: number
          name: string
          port: number
          project_id: string
          redundancy_mode: string
          relay_server_url: string | null
          relay_token: string | null
          sort_order: number
          transport: string
          updated_at: string
        }
        Insert: {
          channel_count?: number
          clone_of?: string | null
          created_at?: string
          dmx_channel_count?: number
          dmx_net?: number
          dmx_start_address?: number
          dmx_subnet?: number
          dmx_universe?: number
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip?: string
          label?: string | null
          module_address?: number
          name?: string
          port?: number
          project_id: string
          redundancy_mode?: string
          relay_server_url?: string | null
          relay_token?: string | null
          sort_order?: number
          transport?: string
          updated_at?: string
        }
        Update: {
          channel_count?: number
          clone_of?: string | null
          created_at?: string
          dmx_channel_count?: number
          dmx_net?: number
          dmx_start_address?: number
          dmx_subnet?: number
          dmx_universe?: number
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip?: string
          label?: string | null
          module_address?: number
          name?: string
          port?: number
          project_id?: string
          redundancy_mode?: string
          relay_server_url?: string | null
          relay_token?: string | null
          sort_order?: number
          transport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artnet_modules_clone_of_fkey"
            columns: ["clone_of"]
            isOneToOne: false
            referencedRelation: "artnet_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artnet_modules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          currency: string
          event_id: string | null
          id: string
          line_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          event_id?: string | null
          id?: string
          line_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          event_id?: string | null
          id?: string
          line_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      dmx_logs: {
        Row: {
          channel_data: Json
          created_at: string
          id: string
          project_id: string
          protocol: string
          session_id: string
          source: string
          timestamp: string
          universe: number
        }
        Insert: {
          channel_data?: Json
          created_at?: string
          id?: string
          project_id: string
          protocol?: string
          session_id: string
          source?: string
          timestamp?: string
          universe?: number
        }
        Update: {
          channel_data?: Json
          created_at?: string
          id?: string
          project_id?: string
          protocol?: string
          session_id?: string
          source?: string
          timestamp?: string
          universe?: number
        }
        Relationships: [
          {
            foreignKeyName: "dmx_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_name: string | null
          created_at: string
          event_date: string | null
          event_time: string | null
          event_type: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          project_id: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_presets: {
        Row: {
          category_overrides: Json
          created_at: string
          id: string
          name: string
          preset_base: string
          user_id: string
        }
        Insert: {
          category_overrides?: Json
          created_at?: string
          id?: string
          name: string
          preset_base?: string
          user_id: string
        }
        Update: {
          category_overrides?: Json
          created_at?: string
          id?: string
          name?: string
          preset_base?: string
          user_id?: string
        }
        Relationships: []
      }
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: []
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
      rider_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          alt: number
          created_at: string
          id: string
          lat: number
          lon: number
          name: string
          scene_radius: number
          user_id: string
        }
        Insert: {
          alt?: number
          created_at?: string
          id?: string
          lat: number
          lon: number
          name: string
          scene_radius?: number
          user_id: string
        }
        Update: {
          alt?: number
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
          scene_radius?: number
          user_id?: string
        }
        Relationships: []
      }
      setlists: {
        Row: {
          created_at: string
          id: string
          project_id: string
          tracks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          tracks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          tracks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          notes: string | null
          pos_x: number
          pos_y: number
          pos_z: number
          position_id: string | null
          position_name: string | null
          project_id: string
          start_time: number
          track_index: number
        }
        Insert: {
          created_at?: string
          effect_id: string
          id?: string
          notes?: string | null
          pos_x?: number
          pos_y?: number
          pos_z?: number
          position_id?: string | null
          position_name?: string | null
          project_id: string
          start_time?: number
          track_index?: number
        }
        Update: {
          created_at?: string
          effect_id?: string
          id?: string
          notes?: string | null
          pos_x?: number
          pos_y?: number
          pos_z?: number
          position_id?: string | null
          position_name?: string | null
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
      user_library_assets: {
        Row: {
          created_at: string
          file_format: string
          file_path: string
          file_size: number | null
          id: string
          name: string
          source: string
          tags: string[] | null
          thumbnail_base64: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_format?: string
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          source?: string
          tags?: string[] | null
          thumbnail_base64?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_format?: string
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          source?: string
          tags?: string[] | null
          thumbnail_base64?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
