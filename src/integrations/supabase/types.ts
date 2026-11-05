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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      concept_glossary: {
        Row: {
          created_at: string
          definition: string
          simple_explanation: string | null
          status: string
          term: string
          topic_ids: number[]
          updated_at: string
          why_it_matters: string | null
        }
        Insert: {
          created_at?: string
          definition: string
          simple_explanation?: string | null
          status?: string
          term: string
          topic_ids?: number[]
          updated_at?: string
          why_it_matters?: string | null
        }
        Update: {
          created_at?: string
          definition?: string
          simple_explanation?: string | null
          status?: string
          term?: string
          topic_ids?: number[]
          updated_at?: string
          why_it_matters?: string | null
        }
        Relationships: []
      }
      content_health_baseline_changes: {
        Row: {
          changed_at: string
          id: number
          new_baselines: Json
          old_baselines: Json
        }
        Insert: {
          changed_at?: string
          id?: never
          new_baselines: Json
          old_baselines: Json
        }
        Update: {
          changed_at?: string
          id?: never
          new_baselines?: Json
          old_baselines?: Json
        }
        Relationships: []
      }
      content_health_baselines: {
        Row: {
          baseline: number
          metric: string
          tolerance: number
          updated_at: string
        }
        Insert: {
          baseline: number
          metric: string
          tolerance?: number
          updated_at?: string
        }
        Update: {
          baseline?: number
          metric?: string
          tolerance?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_health_checks: {
        Row: {
          checked_at: string
          healthy: boolean
          id: number
          source: string
          totals: Json
        }
        Insert: {
          checked_at?: string
          healthy: boolean
          id?: never
          source?: string
          totals: Json
        }
        Update: {
          checked_at?: string
          healthy?: boolean
          id?: never
          source?: string
          totals?: Json
        }
        Relationships: []
      }
      content_health_incidents: {
        Row: {
          baseline: number
          id: string
          last_seen_at: string
          lowest_observed: number
          metric: string
          observed: number
          opened_at: string
          resolved_at: string | null
          resolved_observed: number | null
          seen_count: number
          status: string
          threshold: number
        }
        Insert: {
          baseline: number
          id?: string
          last_seen_at?: string
          lowest_observed: number
          metric: string
          observed: number
          opened_at?: string
          resolved_at?: string | null
          resolved_observed?: number | null
          seen_count?: number
          status?: string
          threshold: number
        }
        Update: {
          baseline?: number
          id?: string
          last_seen_at?: string
          lowest_observed?: number
          metric?: string
          observed?: number
          opened_at?: string
          resolved_at?: string | null
          resolved_observed?: number | null
          seen_count?: number
          status?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_health_incidents_metric_fkey"
            columns: ["metric"]
            isOneToOne: false
            referencedRelation: "content_health_baselines"
            referencedColumns: ["metric"]
          },
        ]
      }
      content_resource_bodies: {
        Row: {
          content_html: string
          created_at: string
          resource_id: string
          updated_at: string
        }
        Insert: {
          content_html: string
          created_at?: string
          resource_id: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_resource_bodies_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resource_private: {
        Row: {
          created_at: string
          credibility_notes: string | null
          rejection_reason: string | null
          resource_id: string
          rights_notes: string | null
          selection_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credibility_notes?: string | null
          rejection_reason?: string | null
          resource_id: string
          rights_notes?: string | null
          selection_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credibility_notes?: string | null
          rejection_reason?: string | null
          resource_id?: string
          rights_notes?: string | null
          selection_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_resource_private_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resource_url_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_url: string
          old_url: string
          resource_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_url: string
          old_url: string
          resource_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_url?: string
          old_url?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_resource_url_history_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resources: {
        Row: {
          access_level: string
          author: string | null
          concepts: string[]
          consecutive_failures: number
          content_url: string | null
          created_at: string
          creator: string | null
          credibility_status: string
          description: string | null
          difficulty: string | null
          duration: string | null
          embed_type: string
          embed_url: string | null
          embedding_status: string
          format: string | null
          id: string
          is_start_here: boolean
          kind: string
          last_checked: string | null
          last_checked_at: string | null
          link_status: string
          needs_review: boolean
          needs_review_reason: string | null
          next_check_at: string | null
          origin: string
          position: number
          publication: string | null
          published_at: string | null
          review_status: string
          rights_status: string
          source: string | null
          thumbnail_url: string | null
          title: string
          topic_fit_status: string
          topic_id: number
          updated_at: string
          url: string
          verification: Json
        }
        Insert: {
          access_level?: string
          author?: string | null
          concepts?: string[]
          consecutive_failures?: number
          content_url?: string | null
          created_at?: string
          creator?: string | null
          credibility_status?: string
          description?: string | null
          difficulty?: string | null
          duration?: string | null
          embed_type?: string
          embed_url?: string | null
          embedding_status?: string
          format?: string | null
          id?: string
          is_start_here?: boolean
          kind: string
          last_checked?: string | null
          last_checked_at?: string | null
          link_status?: string
          needs_review?: boolean
          needs_review_reason?: string | null
          next_check_at?: string | null
          origin?: string
          position?: number
          publication?: string | null
          published_at?: string | null
          review_status?: string
          rights_status?: string
          source?: string | null
          thumbnail_url?: string | null
          title: string
          topic_fit_status?: string
          topic_id: number
          updated_at?: string
          url: string
          verification?: Json
        }
        Update: {
          access_level?: string
          author?: string | null
          concepts?: string[]
          consecutive_failures?: number
          content_url?: string | null
          created_at?: string
          creator?: string | null
          credibility_status?: string
          description?: string | null
          difficulty?: string | null
          duration?: string | null
          embed_type?: string
          embed_url?: string | null
          embedding_status?: string
          format?: string | null
          id?: string
          is_start_here?: boolean
          kind?: string
          last_checked?: string | null
          last_checked_at?: string | null
          link_status?: string
          needs_review?: boolean
          needs_review_reason?: string | null
          next_check_at?: string | null
          origin?: string
          position?: number
          publication?: string | null
          published_at?: string | null
          review_status?: string
          rights_status?: string
          source?: string | null
          thumbnail_url?: string | null
          title?: string
          topic_fit_status?: string
          topic_id?: number
          updated_at?: string
          url?: string
          verification?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_resources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topic_private: {
        Row: {
          created_at: string
          editorial_notes: string | null
          provenance: Json
          topic_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          editorial_notes?: string | null
          provenance?: Json
          topic_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          editorial_notes?: string | null
          provenance?: Json
          topic_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_topic_private_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topic_source_codes: {
        Row: {
          created_at: string
          match_kind: string
          source_code: string
          source_group: string
          source_title: string
          topic_id: number
        }
        Insert: {
          created_at?: string
          match_kind: string
          source_code: string
          source_group: string
          source_title: string
          topic_id: number
        }
        Update: {
          created_at?: string
          match_kind?: string
          source_code?: string
          source_group?: string
          source_title?: string
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_topic_source_codes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topic_translations: {
        Row: {
          context: string
          created_at: string
          lang: string
          status: string
          takeaways: string[]
          title: string
          topic_id: number
          translated_by: string | null
          updated_at: string
        }
        Insert: {
          context?: string
          created_at?: string
          lang: string
          status?: string
          takeaways?: string[]
          title: string
          topic_id: number
          translated_by?: string | null
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          lang?: string
          status?: string
          takeaways?: string[]
          title?: string
          topic_id?: number
          translated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_topic_translations_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topics: {
        Row: {
          category: string
          context: string
          created_at: string
          difficulty: string | null
          id: number
          last_verified: string | null
          last_verified_at: string | null
          origin: string
          published_at: string | null
          related_ids: number[]
          search_text: string
          slug: string
          status: string
          tags: string[]
          takeaways: string[]
          title: string
          updated_at: string
          verification_stage: string | null
        }
        Insert: {
          category: string
          context?: string
          created_at?: string
          difficulty?: string | null
          id: number
          last_verified?: string | null
          last_verified_at?: string | null
          origin?: string
          published_at?: string | null
          related_ids?: number[]
          search_text?: string
          slug: string
          status?: string
          tags?: string[]
          takeaways?: string[]
          title: string
          updated_at?: string
          verification_stage?: string | null
        }
        Update: {
          category?: string
          context?: string
          created_at?: string
          difficulty?: string | null
          id?: number
          last_verified?: string | null
          last_verified_at?: string | null
          origin?: string
          published_at?: string | null
          related_ids?: number[]
          search_text?: string
          slug?: string
          status?: string
          tags?: string[]
          takeaways?: string[]
          title?: string
          updated_at?: string
          verification_stage?: string | null
        }
        Relationships: []
      }
      editorial_runs: {
        Row: {
          details: Json
          duplicate_count: number
          finished_at: string | null
          found_count: number
          id: string
          imported_count: number
          kind: string
          rejected_count: number
          shortfall_reason: string | null
          started_at: string
          status: string
          target_count: number
        }
        Insert: {
          details?: Json
          duplicate_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          imported_count?: number
          kind?: string
          rejected_count?: number
          shortfall_reason?: string | null
          started_at?: string
          status?: string
          target_count?: number
        }
        Update: {
          details?: Json
          duplicate_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          imported_count?: number
          kind?: string
          rejected_count?: number
          shortfall_reason?: string | null
          started_at?: string
          status?: string
          target_count?: number
        }
        Relationships: []
      }
      interest_lane_categories: {
        Row: {
          category: string
          created_at: string
          lane_slug: string
        }
        Insert: {
          category: string
          created_at?: string
          lane_slug: string
        }
        Update: {
          category?: string
          created_at?: string
          lane_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "interest_lane_categories_lane_slug_fkey"
            columns: ["lane_slug"]
            isOneToOne: false
            referencedRelation: "interest_lanes"
            referencedColumns: ["slug"]
          },
        ]
      }
      interest_lanes: {
        Row: {
          active: boolean
          created_at: string
          description: string
          examples: string[]
          label: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          examples?: string[]
          label: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          examples?: string[]
          label?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_snapshot: {
        Row: {
          display_name: string
          id: number
          period: string
          place: number
          reads: number
          refreshed_at: string
        }
        Insert: {
          display_name: string
          id?: never
          period: string
          place: number
          reads: number
          refreshed_at?: string
        }
        Update: {
          display_name?: string
          id?: never
          period?: string
          place?: number
          reads?: number
          refreshed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          feed_mix: string
          id: string
          onboarded: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          feed_mix?: string
          id: string
          onboarded?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          feed_mix?: string
          id?: string
          onboarded?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      replacement_gaps: {
        Row: {
          blocker: string
          opened_at: string
          reason: string
          replacement_id: string | null
          resolved_at: string | null
          resource_id: string
          status: string
          topic_id: number
        }
        Insert: {
          blocker: string
          opened_at?: string
          reason: string
          replacement_id?: string | null
          resolved_at?: string | null
          resource_id: string
          status?: string
          topic_id: number
        }
        Update: {
          blocker?: string
          opened_at?: string
          reason?: string
          replacement_id?: string | null
          resolved_at?: string | null
          resource_id?: string
          status?: string
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "replacement_gaps_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      research_candidates: {
        Row: {
          authority: string
          blocked_checks: string[]
          created_at: string
          dedup_key: string
          existing_resource_id: string | null
          host: string
          id: string
          search_call_id: number | null
          search_score: number | null
          selected_for_extract: boolean
          snippet: string | null
          status: string
          title: string | null
          topic_id: number
          url: string
        }
        Insert: {
          authority: string
          blocked_checks?: string[]
          created_at?: string
          dedup_key: string
          existing_resource_id?: string | null
          host: string
          id?: string
          search_call_id?: number | null
          search_score?: number | null
          selected_for_extract?: boolean
          snippet?: string | null
          status?: string
          title?: string | null
          topic_id: number
          url: string
        }
        Update: {
          authority?: string
          blocked_checks?: string[]
          created_at?: string
          dedup_key?: string
          existing_resource_id?: string | null
          host?: string
          id?: string
          search_call_id?: number | null
          search_score?: number | null
          selected_for_extract?: boolean
          snippet?: string | null
          status?: string
          title?: string | null
          topic_id?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_candidates_search_call_id_fkey"
            columns: ["search_call_id"]
            isOneToOne: false
            referencedRelation: "research_pilot_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_candidates_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      research_evidence: {
        Row: {
          candidate_id: string | null
          content_hash: string | null
          dedup_key: string
          excerpt: string | null
          extract_call_id: number | null
          failure_reason: string | null
          id: string
          inspected_method: string
          original_chars: number | null
          outcome: string
          provider: string
          provider_request_id: string | null
          retrieved_at: string
          returned_url: string | null
          stored_chars: number | null
          text_content: string | null
          topic_id: number
          truncated: boolean
          url: string
        }
        Insert: {
          candidate_id?: string | null
          content_hash?: string | null
          dedup_key: string
          excerpt?: string | null
          extract_call_id?: number | null
          failure_reason?: string | null
          id?: string
          inspected_method?: string
          original_chars?: number | null
          outcome: string
          provider?: string
          provider_request_id?: string | null
          retrieved_at?: string
          returned_url?: string | null
          stored_chars?: number | null
          text_content?: string | null
          topic_id: number
          truncated?: boolean
          url: string
        }
        Update: {
          candidate_id?: string | null
          content_hash?: string | null
          dedup_key?: string
          excerpt?: string | null
          extract_call_id?: number | null
          failure_reason?: string | null
          id?: string
          inspected_method?: string
          original_chars?: number | null
          outcome?: string
          provider?: string
          provider_request_id?: string | null
          retrieved_at?: string
          returned_url?: string | null
          stored_chars?: number | null
          text_content?: string | null
          topic_id?: number
          truncated?: boolean
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_evidence_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "research_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_evidence_extract_call_id_fkey"
            columns: ["extract_call_id"]
            isOneToOne: false
            referencedRelation: "research_pilot_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_evidence_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      research_pilot: {
        Row: {
          call_cap: number
          calls_attempted: number
          external_smoke_calls: number
          extract_cap: number
          extracts_used: number
          id: number
          in_flight_until: string
          provider: string
          search_cap: number
          searches_used: number
          state: string
          stop_reason: string | null
          topic_ids: number[]
          updated_at: string
        }
        Insert: {
          call_cap?: number
          calls_attempted?: number
          external_smoke_calls?: number
          extract_cap?: number
          extracts_used?: number
          id: number
          in_flight_until?: string
          provider?: string
          search_cap?: number
          searches_used?: number
          state?: string
          stop_reason?: string | null
          topic_ids?: number[]
          updated_at?: string
        }
        Update: {
          call_cap?: number
          calls_attempted?: number
          external_smoke_calls?: number
          extract_cap?: number
          extracts_used?: number
          id?: number
          in_flight_until?: string
          provider?: string
          search_cap?: number
          searches_used?: number
          state?: string
          stop_reason?: string | null
          topic_ids?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      research_pilot_calls: {
        Row: {
          finished_at: string | null
          http_status: number | null
          id: number
          kind: string
          provider_request_id: string | null
          purpose: string
          reserved_at: string
          status: string
          topic_id: number | null
          url_count: number
        }
        Insert: {
          finished_at?: string | null
          http_status?: number | null
          id?: never
          kind: string
          provider_request_id?: string | null
          purpose?: string
          reserved_at?: string
          status?: string
          topic_id?: number | null
          url_count?: number
        }
        Update: {
          finished_at?: string | null
          http_status?: number | null
          id?: never
          kind?: string
          provider_request_id?: string | null
          purpose?: string
          reserved_at?: string
          status?: string
          topic_id?: number | null
          url_count?: number
        }
        Relationships: []
      }
      research_pilot_topics: {
        Row: {
          note: string | null
          position: number
          query: string | null
          status: string
          topic_id: number
          updated_at: string
        }
        Insert: {
          note?: string | null
          position: number
          query?: string | null
          status?: string
          topic_id: number
          updated_at?: string
        }
        Update: {
          note?: string | null
          position?: number
          query?: string | null
          status?: string
          topic_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_pilot_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_agent_reviews: {
        Row: {
          applied_action: string
          confidence: number
          credibility: string | null
          evaluated_at: string
          model: string
          overridden_at: string | null
          previous_review_status: string | null
          resource_id: string
          suggested_difficulty: string | null
          suggested_reason: string | null
          summary: string | null
          topic_fit: string | null
          verdict: string
        }
        Insert: {
          applied_action?: string
          confidence?: number
          credibility?: string | null
          evaluated_at?: string
          model: string
          overridden_at?: string | null
          previous_review_status?: string | null
          resource_id: string
          suggested_difficulty?: string | null
          suggested_reason?: string | null
          summary?: string | null
          topic_fit?: string | null
          verdict: string
        }
        Update: {
          applied_action?: string
          confidence?: number
          credibility?: string | null
          evaluated_at?: string
          model?: string
          overridden_at?: string | null
          previous_review_status?: string | null
          resource_id?: string
          suggested_difficulty?: string | null
          suggested_reason?: string | null
          summary?: string | null
          topic_fit?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_agent_reviews_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_embed_failures: {
        Row: {
          created_at: string
          id: number
          reason: string
          report_day: string
          reporter: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason: string
          report_day?: string
          reporter?: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string
          report_day?: string
          reporter?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_embed_failures_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          position: Json
          resource_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          position?: Json
          resource_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          position?: Json
          resource_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_progress_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_verification_log: {
        Row: {
          action: string
          created_at: string
          evidence: string
          evidence_json: Json
          exception_reason: string | null
          failed_rules: string[]
          id: number
          outcome: string
          page_inspected: boolean
          resource_id: string
          run_source: string
          topic_id: number
        }
        Insert: {
          action: string
          created_at?: string
          evidence: string
          evidence_json?: Json
          exception_reason?: string | null
          failed_rules?: string[]
          id?: number
          outcome: string
          page_inspected?: boolean
          resource_id: string
          run_source: string
          topic_id: number
        }
        Update: {
          action?: string
          created_at?: string
          evidence?: string
          evidence_json?: Json
          exception_reason?: string | null
          failed_rules?: string[]
          id?: number
          outcome?: string
          page_inspected?: boolean
          resource_id?: string
          run_source?: string
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_verification_log_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_topics: {
        Row: {
          created_at: string
          topic_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          topic_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          topic_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      source_link_checks: {
        Row: {
          access_level: string | null
          checked_at: string
          detail: string | null
          embed_allowed: boolean | null
          failure_reason: string | null
          final_url: string | null
          outcome: string
          redirect_chain: Json
          requested_url: string | null
          resource_id: string
          status_code: number | null
        }
        Insert: {
          access_level?: string | null
          checked_at?: string
          detail?: string | null
          embed_allowed?: boolean | null
          failure_reason?: string | null
          final_url?: string | null
          outcome: string
          redirect_chain?: Json
          requested_url?: string | null
          resource_id: string
          status_code?: number | null
        }
        Update: {
          access_level?: string | null
          checked_at?: string
          detail?: string | null
          embed_allowed?: boolean | null
          failure_reason?: string | null
          final_url?: string | null
          outcome?: string
          redirect_chain?: Json
          requested_url?: string | null
          resource_id?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_link_checks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_replacements: {
        Row: {
          created_at: string
          evidence: Json
          idempotency_key: string
          new_resource_id: string
          old_resource_id: string
          outcome: string
          page_inspected: boolean
          run_source: string
        }
        Insert: {
          created_at?: string
          evidence: Json
          idempotency_key: string
          new_resource_id: string
          old_resource_id: string
          outcome: string
          page_inspected: boolean
          run_source: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          idempotency_key?: string
          new_resource_id?: string
          old_resource_id?: string
          outcome?: string
          page_inspected?: boolean
          run_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_replacements_new_resource_id_fkey"
            columns: ["new_resource_id"]
            isOneToOne: false
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_replacements_old_resource_id_fkey"
            columns: ["old_resource_id"]
            isOneToOne: true
            referencedRelation: "content_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_backlog: {
        Row: {
          created_at: string
          family: string
          id: string
          idea: string
          notes: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          family: string
          id?: string
          idea: string
          notes?: string | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          family?: string
          id?: string
          idea?: string
          notes?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      topic_notes: {
        Row: {
          body: string
          created_at: string
          topic_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          topic_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          topic_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_reads: {
        Row: {
          id: number
          read_at: string
          read_day: string
          seconds: number
          topic_id: number
          user_id: string
        }
        Insert: {
          id?: number
          read_at?: string
          read_day?: string
          seconds?: number
          topic_id: number
          user_id: string
        }
        Update: {
          id?: number
          read_at?: string
          read_day?: string
          seconds?: number
          topic_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_reads_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_suggestion_private: {
        Row: {
          editor_note: string | null
          suggestion_id: string
          updated_at: string
        }
        Insert: {
          editor_note?: string | null
          suggestion_id: string
          updated_at?: string
        }
        Update: {
          editor_note?: string | null
          suggestion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_suggestion_private_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: true
            referencedRelation: "topic_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_suggestions: {
        Row: {
          created_at: string
          details: string | null
          id: string
          lane_slug: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          lane_slug?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          lane_slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_suggestions_lane_slug_fkey"
            columns: ["lane_slug"]
            isOneToOne: false
            referencedRelation: "interest_lanes"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_cursor: {
        Row: {
          id: number
          last_resource_id: string | null
          lease_until: string
          passes: number
          scheduler_note: string
          scheduler_state: string
          updated_at: string
        }
        Insert: {
          id?: number
          last_resource_id?: string | null
          lease_until?: string
          passes?: number
          scheduler_note?: string
          scheduler_state?: string
          updated_at?: string
        }
        Update: {
          id?: number
          last_resource_id?: string | null
          lease_until?: string
          passes?: number
          scheduler_note?: string
          scheduler_state?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_onboarding: {
        Args: {
          _feed_mix: string
          _force?: boolean
          _interests: string[]
          _theme: string
        }
        Returns: {
          applied: boolean
          onboarded: boolean
          reason: string
        }[]
      }
      apply_source_replacement: {
        Args: {
          _creator: string
          _evidence: string
          _kind: string
          _old: string
          _run_source: string
          _title: string
          _url: string
        }
        Returns: string
      }
      apply_verified_replacement: {
        Args: {
          _evidence: Json
          _expected_updated_at: string
          _idempotency_key: string
          _old: string
          _replacement: Json
          _run_source: string
        }
        Returns: string
      }
      complete_research_pilot: { Args: never; Returns: undefined }
      content_health_current_totals: { Args: never; Returns: Json }
      expand_interests: { Args: { _interests: string[] }; Returns: string[] }
      record_ux_event: {
        Args: {
          _elapsed_ms?: number
          _event_name: string
          _journey_id: string
          _step?: number
          _surface: string
          _variant?: string
        }
        Returns: boolean
      }
      feed_topics:
        | {
            Args: {
              _category?: string
              _interests?: string[]
              _limit?: number
              _offset?: number
              _query?: string
              _read_ids?: number[]
              _seed?: number
            }
            Returns: {
              category: string
              context: string
              id: number
              last_verified: string
              slug: string
              tags: string[]
              takeaways: string[]
              title: string
              total_count: number
            }[]
          }
        | {
            Args: {
              _category?: string
              _interests?: string[]
              _limit?: number
              _mix?: string
              _offset?: number
              _query?: string
              _read_ids?: number[]
              _seed?: number
            }
            Returns: {
              category: string
              context: string
              id: number
              last_verified: string
              slug: string
              tags: string[]
              takeaways: string[]
              title: string
              total_count: number
            }[]
          }
      finish_research_call: {
        Args: {
          _http: number
          _id: number
          _request_id: string
          _status: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      init_research_pilot: { Args: never; Returns: number[] }
      is_editor: { Args: never; Returns: boolean }
      is_safe_source_url: { Args: { _url: string }; Returns: boolean }
      my_leaderboard_place: {
        Args: { _period?: string }
        Returns: {
          place: number
          reads: number
        }[]
      }
      my_streak:
        | {
            Args: never
            Returns: {
              best_streak: number
              current_streak: number
              total_reads: number
            }[]
          }
        | {
            Args: { _tz: string }
            Returns: {
              best_streak: number
              current_streak: number
              total_reads: number
            }[]
          }
      rebase_content_health_baselines: {
        Args: { _expected: Json }
        Returns: {
          changed: boolean
          new_baselines: Json
          old_baselines: Json
          reason: string
        }[]
      }
      refresh_leaderboard_snapshot: { Args: never; Returns: undefined }
      reserve_research_call: {
        Args: {
          _kind: string
          _purpose: string
          _topic: number
          _url_count: number
        }
        Returns: number
      }
      run_content_health_check: {
        Args: { _source?: string }
        Returns: {
          healthy: boolean
          metric: string
          observed: number
          threshold: number
        }[]
      }
      search_topics: {
        Args: {
          _category?: string
          _limit?: number
          _offset?: number
          _query?: string
        }
        Returns: {
          category: string
          context: string
          id: number
          last_verified: string
          slug: string
          tags: string[]
          takeaways: string[]
          title: string
          total_count: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "editor" | "reader"
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
      app_role: ["owner", "editor", "reader"],
    },
  },
} as const
