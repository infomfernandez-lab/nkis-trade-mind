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
      calculadora_registro: {
        Row: {
          atr: number | null
          breakeven_precio: number | null
          breakeven_sl: number | null
          broker: string | null
          created_at: string | null
          cuenta_balance: number | null
          direccion: string | null
          distancia_stop: number | null
          id: string
          instrumento: string | null
          lotes: number | null
          precio_entrada: number | null
          riesgo_real: number | null
          stop_loss: number | null
          trailing_sl: number | null
          valor_punto: number | null
          vix: number | null
        }
        Insert: {
          atr?: number | null
          breakeven_precio?: number | null
          breakeven_sl?: number | null
          broker?: string | null
          created_at?: string | null
          cuenta_balance?: number | null
          direccion?: string | null
          distancia_stop?: number | null
          id?: string
          instrumento?: string | null
          lotes?: number | null
          precio_entrada?: number | null
          riesgo_real?: number | null
          stop_loss?: number | null
          trailing_sl?: number | null
          valor_punto?: number | null
          vix?: number | null
        }
        Update: {
          atr?: number | null
          breakeven_precio?: number | null
          breakeven_sl?: number | null
          broker?: string | null
          created_at?: string | null
          cuenta_balance?: number | null
          direccion?: string | null
          distancia_stop?: number | null
          id?: string
          instrumento?: string | null
          lotes?: number | null
          precio_entrada?: number | null
          riesgo_real?: number | null
          stop_loss?: number | null
          trailing_sl?: number | null
          valor_punto?: number | null
          vix?: number | null
        }
        Relationships: []
      }
      momentum_sessions: {
        Row: {
          adx: number | null
          adx_prev: number | null
          atr: number | null
          broker: string
          created_at: string | null
          direccion: string
          evento: string | null
          id: string
          ma200: number | null
          ma50: number | null
          precio_actual: number | null
          score: number
          session_id: string | null
          stoch_d: number | null
          stoch_d_prev: number | null
          stoch_k: number | null
          stoch_k_prev: number | null
          symbol: string
          timeframe: string
          total_analyzed: number | null
          vix_value: number | null
        }
        Insert: {
          adx?: number | null
          adx_prev?: number | null
          atr?: number | null
          broker: string
          created_at?: string | null
          direccion: string
          evento?: string | null
          id?: string
          ma200?: number | null
          ma50?: number | null
          precio_actual?: number | null
          score: number
          session_id?: string | null
          stoch_d?: number | null
          stoch_d_prev?: number | null
          stoch_k?: number | null
          stoch_k_prev?: number | null
          symbol: string
          timeframe?: string
          total_analyzed?: number | null
          vix_value?: number | null
        }
        Update: {
          adx?: number | null
          adx_prev?: number | null
          atr?: number | null
          broker?: string
          created_at?: string | null
          direccion?: string
          evento?: string | null
          id?: string
          ma200?: number | null
          ma50?: number | null
          precio_actual?: number | null
          score?: number
          session_id?: string | null
          stoch_d?: number | null
          stoch_d_prev?: number | null
          stoch_k?: number | null
          stoch_k_prev?: number | null
          symbol?: string
          timeframe?: string
          total_analyzed?: number | null
          vix_value?: number | null
        }
        Relationships: []
      }
      scanner_sessions: {
        Row: {
          broker: string
          correlations_detected: Json | null
          created_at: string
          discarded: number | null
          id: string
          notes: string | null
          session_date: string
          timeframe: string | null
          top_instruments: Json | null
          total_analyzed: number | null
          tradeable: number | null
          updated_at: string
          user_id: string
          vix: number | null
        }
        Insert: {
          broker?: string
          correlations_detected?: Json | null
          created_at?: string
          discarded?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          timeframe?: string | null
          top_instruments?: Json | null
          total_analyzed?: number | null
          tradeable?: number | null
          updated_at?: string
          user_id: string
          vix?: number | null
        }
        Update: {
          broker?: string
          correlations_detected?: Json | null
          created_at?: string
          discarded?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          timeframe?: string | null
          top_instruments?: Json | null
          total_analyzed?: number | null
          tradeable?: number | null
          updated_at?: string
          user_id?: string
          vix?: number | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          adx_state: string | null
          adx_value: number | null
          atr_at_entry: number | null
          broker: string
          commission: number | null
          created_at: string
          direction: string
          distance_to_ma50: number | null
          distance_to_ma50_label: string | null
          duration_hours: number | null
          during_trade_notes: string | null
          ea_comment: string | null
          emotional_state: string | null
          entry_date: string
          entry_price: number
          exit_date: string | null
          exit_price: number | null
          feeling_result: string | null
          gross_pnl: number | null
          how_closed: string | null
          id: string
          is_open: boolean | null
          is_win: boolean | null
          lot_size: number
          magic_number: number | null
          managing_wait: string | null
          manual_intervention: string | null
          momentum_20d: number | null
          momentum_aligned: boolean | null
          net_pnl: number | null
          post_trade_notes: string | null
          pre_trade_notes: string | null
          reason_for_entry: string | null
          scanner_rank: number | null
          setup_doubts: string | null
          sl_phase: string
          sl_price: number | null
          sl_updated_at: string | null
          stochastic_k: number | null
          swap: number | null
          symbol: string
          system_compliance: string | null
          ticket: number | null
          tp_price: number | null
          updated_at: string
          user_id: string
          vix_at_entry: number | null
          what_do_differently: string | null
        }
        Insert: {
          adx_state?: string | null
          adx_value?: number | null
          atr_at_entry?: number | null
          broker?: string
          commission?: number | null
          created_at?: string
          direction: string
          distance_to_ma50?: number | null
          distance_to_ma50_label?: string | null
          duration_hours?: number | null
          during_trade_notes?: string | null
          ea_comment?: string | null
          emotional_state?: string | null
          entry_date: string
          entry_price: number
          exit_date?: string | null
          exit_price?: number | null
          feeling_result?: string | null
          gross_pnl?: number | null
          how_closed?: string | null
          id?: string
          is_open?: boolean | null
          is_win?: boolean | null
          lot_size?: number
          magic_number?: number | null
          managing_wait?: string | null
          manual_intervention?: string | null
          momentum_20d?: number | null
          momentum_aligned?: boolean | null
          net_pnl?: number | null
          post_trade_notes?: string | null
          pre_trade_notes?: string | null
          reason_for_entry?: string | null
          scanner_rank?: number | null
          setup_doubts?: string | null
          sl_phase?: string
          sl_price?: number | null
          sl_updated_at?: string | null
          stochastic_k?: number | null
          swap?: number | null
          symbol: string
          system_compliance?: string | null
          ticket?: number | null
          tp_price?: number | null
          updated_at?: string
          user_id: string
          vix_at_entry?: number | null
          what_do_differently?: string | null
        }
        Update: {
          adx_state?: string | null
          adx_value?: number | null
          atr_at_entry?: number | null
          broker?: string
          commission?: number | null
          created_at?: string
          direction?: string
          distance_to_ma50?: number | null
          distance_to_ma50_label?: string | null
          duration_hours?: number | null
          during_trade_notes?: string | null
          ea_comment?: string | null
          emotional_state?: string | null
          entry_date?: string
          entry_price?: number
          exit_date?: string | null
          exit_price?: number | null
          feeling_result?: string | null
          gross_pnl?: number | null
          how_closed?: string | null
          id?: string
          is_open?: boolean | null
          is_win?: boolean | null
          lot_size?: number
          magic_number?: number | null
          managing_wait?: string | null
          manual_intervention?: string | null
          momentum_20d?: number | null
          momentum_aligned?: boolean | null
          net_pnl?: number | null
          post_trade_notes?: string | null
          pre_trade_notes?: string | null
          reason_for_entry?: string | null
          scanner_rank?: number | null
          setup_doubts?: string | null
          sl_phase?: string
          sl_price?: number | null
          sl_updated_at?: string | null
          stochastic_k?: number | null
          swap?: number | null
          symbol?: string
          system_compliance?: string | null
          ticket?: number | null
          tp_price?: number | null
          updated_at?: string
          user_id?: string
          vix_at_entry?: number | null
          what_do_differently?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          account_number: string | null
          api_key: string | null
          balance: number | null
          broker: string | null
          created_at: string
          id: string
          max_open_positions: number | null
          risk_per_trade: number | null
          updated_at: string
          user_id: string
          vix_block_threshold: number | null
          vix_caution_threshold: number | null
        }
        Insert: {
          account_number?: string | null
          api_key?: string | null
          balance?: number | null
          broker?: string | null
          created_at?: string
          id?: string
          max_open_positions?: number | null
          risk_per_trade?: number | null
          updated_at?: string
          user_id: string
          vix_block_threshold?: number | null
          vix_caution_threshold?: number | null
        }
        Update: {
          account_number?: string | null
          api_key?: string | null
          balance?: number | null
          broker?: string | null
          created_at?: string
          id?: string
          max_open_positions?: number | null
          risk_per_trade?: number | null
          updated_at?: string
          user_id?: string
          vix_block_threshold?: number | null
          vix_caution_threshold?: number | null
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_from_scanner: boolean | null
          adx_state: string | null
          adx_value: number | null
          broker: string
          created_at: string
          direction: string
          distance_to_ma50: number | null
          id: string
          scanner_score: number | null
          status: string
          stochastic_level: number | null
          symbol: string
          trade_id: string | null
          updated_at: string
          user_id: string
          watch_reason: string | null
        }
        Insert: {
          added_from_scanner?: boolean | null
          adx_state?: string | null
          adx_value?: number | null
          broker?: string
          created_at?: string
          direction?: string
          distance_to_ma50?: number | null
          id?: string
          scanner_score?: number | null
          status?: string
          stochastic_level?: number | null
          symbol: string
          trade_id?: string | null
          updated_at?: string
          user_id: string
          watch_reason?: string | null
        }
        Update: {
          added_from_scanner?: boolean | null
          adx_state?: string | null
          adx_value?: number | null
          broker?: string
          created_at?: string
          direction?: string
          distance_to_ma50?: number | null
          id?: string
          scanner_score?: number | null
          status?: string
          stochastic_level?: number | null
          symbol?: string
          trade_id?: string | null
          updated_at?: string
          user_id?: string
          watch_reason?: string | null
        }
        Relationships: []
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
