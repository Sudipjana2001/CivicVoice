export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_history: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          profile_id: string
          related_post_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          profile_id: string
          related_post_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          profile_id?: string
          related_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_preferences: {
        Row: {
          created_at: string
          id: string
          new_incidents: boolean
          profile_id: string
          status_updates: boolean
          updated_at: string
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          new_incidents?: boolean
          profile_id: string
          status_updates?: boolean
          updated_at?: string
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          new_incidents?: boolean
          profile_id?: string
          status_updates?: boolean
          updated_at?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alert_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          id: string
          recipient_anonymous_id: string
          recipient_user_id: string
          type: string
          title: string
          description: string
          read: boolean
          incident_id: string | null
          topic_type: string | null
          topic_value: string | null
          topic_label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_anonymous_id: string
          recipient_user_id: string
          type: string
          title: string
          description: string
          read?: boolean
          incident_id?: string | null
          topic_type?: string | null
          topic_value?: string | null
          topic_label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_anonymous_id?: string
          recipient_user_id?: string
          type?: string
          title?: string
          description?: string
          read?: boolean
          incident_id?: string | null
          topic_type?: string | null
          topic_value?: string | null
          topic_label?: string | null
          created_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          anonymous_id: string
          content: string
          created_at: string
          downvote_count: number
          edited_at: string | null
          id: string
          like_count: number
          parent_comment_id: string | null
          post_id: string
          upvote_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string
          content: string
          created_at?: string
          downvote_count?: number
          edited_at?: string | null
          id?: string
          like_count?: number
          parent_comment_id?: string | null
          post_id: string
          upvote_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string
          content?: string
          created_at?: string
          downvote_count?: number
          edited_at?: string | null
          id?: string
          like_count?: number
          parent_comment_id?: string | null
          post_id?: string
          upvote_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      followed_topics: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          topic_label: string
          topic_type: string
          topic_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          topic_label: string
          topic_type: string
          topic_value: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          topic_label?: string
          topic_type?: string
          topic_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "followed_topics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          id: string
          recipient_anonymous_id: string
          recipient_user_id: string
          sender_type: string
          sender_label: string
          subject: string
          preview: string
          content: string
          related_post_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_anonymous_id: string
          recipient_user_id: string
          sender_type: string
          sender_label: string
          subject: string
          preview: string
          content: string
          related_post_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_anonymous_id?: string
          recipient_user_id?: string
          sender_type?: string
          sender_label?: string
          subject?: string
          preview?: string
          content?: string
          related_post_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          card_path: string | null
          created_at: string
          duration_ms: number | null
          full_path: string | null
          height: number | null
          id: string
          kind: string
          lqip_data_url: string | null
          mime_type: string | null
          original_path: string
          post_id: string
          poster_path: string | null
          preview_path: string | null
          thumb_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          card_path?: string | null
          created_at?: string
          duration_ms?: number | null
          full_path?: string | null
          height?: number | null
          id?: string
          kind: string
          lqip_data_url?: string | null
          mime_type?: string | null
          original_path: string
          post_id: string
          poster_path?: string | null
          preview_path?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          card_path?: string | null
          created_at?: string
          duration_ms?: number | null
          full_path?: string | null
          height?: number | null
          id?: string
          kind?: string
          lqip_data_url?: string | null
          mime_type?: string | null
          original_path?: string
          post_id?: string
          poster_path?: string | null
          preview_path?: string | null
          thumb_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          id: string
          anonymous_id: string
          content: string
          category: string
          severity: string
          evidence_type: string | null
          location: string | null
          incident_date: string | null
          incident_time: string | null
          image_url: string | null
          credible_votes: number
          suspicious_votes: number
          comment_count: number
          report_count: number
          status: string
          self_destruct_at: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          anonymous_id?: string
          content: string
          category: string
          severity: string
          evidence_type?: string | null
          location?: string | null
          incident_date?: string | null
          incident_time?: string | null
          image_url?: string | null
          credible_votes?: number
          suspicious_votes?: number
          comment_count?: number
          report_count?: number
          status?: string
          self_destruct_at?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          anonymous_id?: string
          content?: string
          category?: string
          severity?: string
          evidence_type?: string | null
          location?: string | null
          incident_date?: string | null
          incident_time?: string | null
          image_url?: string | null
          credible_votes?: number
          suspicious_votes?: number
          comment_count?: number
          report_count?: number
          status?: string
          self_destruct_at?: string | null
          created_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      post_reports: {
        Row: {
          id: string
          post_id: string
          reporter_user_id: string
          reason: string
          details: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          reporter_user_id: string
          reason: string
          details?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          reporter_user_id?: string
          reason?: string
          details?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anonymous_id: string
          created_at: string
          credibility_level: string
          credibility_score: number
          id: string
          inbox_enabled: boolean
          reports_count: number
          self_destruct_days: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anonymous_id?: string
          created_at?: string
          credibility_level?: string
          credibility_score?: number
          id?: string
          inbox_enabled?: boolean
          reports_count?: number
          self_destruct_days?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string
          created_at?: string
          credibility_level?: string
          credibility_score?: number
          id?: string
          inbox_enabled?: boolean
          reports_count?: number
          self_destruct_days?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          id: string
          post_id: string
          voter_user_id: string
          vote_type: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          voter_user_id: string
          vote_type: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          voter_user_id?: string
          vote_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_comment: {
        Args: {
          p_comment_id: string
        }
        Returns: string
      }
      admin_delete_post: {
        Args: {
          p_post_id: string
        }
        Returns: string
      }
      admin_get_dashboard_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_admins: number
          open_reports: number
          reviewing_reports: number
          total_comments: number
          total_posts: number
          total_users: number
          under_review_posts: number
        }[]
      }
      admin_list_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          anonymous_id: string | null
          created_at: string
          created_by: string | null
          created_by_anonymous_id: string | null
          role: string
          user_id: string
        }[]
      }
      admin_list_comments: {
        Args: {
          p_limit?: number | null
          p_search?: string | null
        }
        Returns: {
          anonymous_id: string
          content: string
          created_at: string
          direct_reply_count: number
          edited_at: string | null
          id: string
          parent_comment_id: string | null
          post_anonymous_id: string
          post_excerpt: string
          post_id: string
          upvote_count: number
          downvote_count: number
          user_id: string | null
        }[]
      }
      admin_list_post_reports: {
        Args: {
          p_limit?: number | null
          p_search?: string | null
          p_status?: string | null
        }
        Returns: {
          created_at: string
          details: string | null
          id: string
          post_anonymous_id: string
          post_excerpt: string
          post_id: string
          post_status: string
          reason: string
          reporter_anonymous_id: string | null
          reporter_user_id: string
          status: string
        }[]
      }
      admin_list_posts: {
        Args: {
          p_limit?: number | null
          p_search?: string | null
          p_status?: string | null
        }
        Returns: {
          anonymous_id: string
          category: string
          comment_count: number
          content: string
          created_at: string
          credible_votes: number
          evidence_type: string | null
          id: string
          incident_date: string | null
          incident_time: string | null
          location: string | null
          report_count: number
          self_destruct_at: string | null
          severity: string
          status: string
          suspicious_votes: number
          user_id: string | null
        }[]
      }
      admin_list_profiles: {
        Args: {
          p_limit?: number | null
          p_search?: string | null
        }
        Returns: {
          anonymous_id: string
          comment_count: number
          created_at: string
          credibility_level: string
          credibility_score: number
          inbox_enabled: boolean
          post_count: number
          profile_id: string
          report_count: number
          reports_count: number
          self_destruct_days: number | null
          updated_at: string
          user_id: string
        }[]
      }
      admin_remove_admin_user: {
        Args: {
          p_target_user_id: string
        }
        Returns: string
      }
      admin_send_inbox_message: {
        Args: {
          p_content: string
          p_recipient_user_id: string
          p_related_post_id?: string | null
          p_sender_label?: string | null
          p_subject: string
        }
        Returns: Database["public"]["Tables"]["inbox_messages"]["Row"]
      }
      admin_set_post_report_status: {
        Args: {
          p_report_id: string
          p_status: string
        }
        Returns: {
          id: string
          status: string
        }[]
      }
      admin_set_post_status: {
        Args: {
          p_post_id: string
          p_status: string
        }
        Returns: {
          id: string
          status: string
        }[]
      }
      admin_upsert_admin_user: {
        Args: {
          p_role: string
          p_target_user_id: string
        }
        Returns: Database["public"]["Tables"]["admin_users"]["Row"]
      }
      create_comment_and_increment: {
        Args: {
          p_content: string
          p_parent_comment_id?: string | null
          p_post_id: string
        }
        Returns: Database["public"]["Tables"]["comments"]["Row"]
      }
      delete_own_comment_and_decrement: {
        Args: {
          p_comment_id: string
        }
        Returns: string
      }
      fetch_comment_replies_with_reaction_state: {
        Args: {
          p_parent_comment_ids: string[]
        }
        Returns: {
          anonymous_id: string
          content: string
          created_at: string
          downvote_count: number
          edited_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          upvote_count: number
          user_id: string | null
          viewer_reaction: string | null
        }[]
      }
      fetch_comments_with_like_state: {
        Args: {
          p_before_created_at?: string | null
          p_before_id?: string | null
          p_limit?: number | null
          p_post_id: string
        }
        Returns: {
          anonymous_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          like_count: number
          post_id: string
          updated_at: string
          user_id: string | null
          viewer_has_liked: boolean
        }[]
      }
      fetch_comments_with_reaction_state: {
        Args: {
          p_before_created_at?: string | null
          p_before_id?: string | null
          p_limit?: number | null
          p_post_id: string
        }
        Returns: {
          anonymous_id: string
          content: string
          created_at: string
          downvote_count: number
          edited_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          upvote_count: number
          user_id: string | null
          viewer_reaction: string | null
        }[]
      }
      get_my_admin_access: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_admin: boolean
          role: string | null
          user_id: string | null
        }[]
      }
      set_comment_reaction_state: {
        Args: {
          p_comment_id: string
          p_reaction_type?: string | null
        }
        Returns: {
          downvote_count: number
          reaction: string | null
          upvote_count: number
        }[]
      }
      set_comment_like_state: {
        Args: {
          p_comment_id: string
          p_like: boolean
        }
        Returns: {
          like_count: number
          liked: boolean
        }[]
      }
      update_own_comment: {
        Args: {
          p_comment_id: string
          p_content: string
        }
        Returns: Database["public"]["Tables"]["comments"]["Row"]
      }
      upsert_post_media_asset: {
        Args: {
          p_card_path?: string | null
          p_duration_ms?: number | null
          p_full_path?: string | null
          p_height?: number | null
          p_kind: string
          p_lqip_data_url?: string | null
          p_mime_type?: string | null
          p_original_path: string
          p_post_id: string
          p_poster_path?: string | null
          p_preview_path?: string | null
          p_thumb_path?: string | null
          p_width?: number | null
        }
        Returns: Database["public"]["Tables"]["media_assets"]["Row"]
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
