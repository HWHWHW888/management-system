import { Headers as NodeHeaders } from "node-fetch";

// Polyfill Headers global if it doesn't exist
if (typeof (globalThis as any).Headers === "undefined") {
  (globalThis as any).Headers = NodeHeaders as any;
}

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = 'https://rtjdqnuzeupbgbovbriy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0amRxbnV6ZXVwYmdib3Zicml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNjYwOTUsImV4cCI6MjA3MTg0MjA5NX0.5oJes7rJykxuGX0BZFDt4LpTmRJAgoh0wHRpmJ8HTng'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on existing schema
export interface Database {
  public: {
    Tables: {
      game_types: {
        Row: {
          id: number
          name: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          name: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string
          created_at?: string
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: number
          name: string
          email?: string
          phone?: string
          position?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          name: string
          email?: string
          phone?: string
          position?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          phone?: string
          position?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      agents: {
        Row: {
          id: number
          name: string
          email?: string
          phone?: string
          commission_rate?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          name: string
          email?: string
          phone?: string
          commission_rate?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          phone?: string
          commission_rate?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: number
          name: string
          email?: string
          phone?: string
          vip_level?: string
          total_spent?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          name: string
          email?: string
          phone?: string
          vip_level?: string
          total_spent?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          phone?: string
          vip_level?: string
          total_spent?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: number
          username: string
          email: string
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          username: string
          email: string
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          username?: string
          email?: string
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      file_attachments: {
        Row: {
          id: number
          filename: string
          file_path: string
          file_size?: number
          mime_type?: string
          related_table?: string
          related_id?: number
          created_at?: string
        }
        Insert: {
          id?: number
          filename: string
          file_path: string
          file_size?: number
          mime_type?: string
          related_table?: string
          related_id?: number
          created_at?: string
        }
        Update: {
          id?: number
          filename?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          related_table?: string
          related_id?: number
          created_at?: string
        }
      }
      staff_shifts: {
        Row: {
          id: number
          staff_id: number
          shift_date: string
          start_time?: string
          end_time?: string
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          staff_id: number
          shift_date: string
          start_time?: string
          end_time?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          staff_id?: number
          shift_date?: string
          start_time?: string
          end_time?: string
          status?: string
          created_at?: string
        }
      }
      trips: {
        Row: {
          id: number
          trip_name: string
          destination?: string
          start_date?: string
          end_date?: string
          status?: string
          total_budget?: number
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          trip_name: string
          destination?: string
          start_date?: string
          end_date?: string
          status?: string
          total_budget?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          trip_name?: string
          destination?: string
          start_date?: string
          end_date?: string
          status?: string
          total_budget?: number
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: number
          customer_id: number
          trip_id?: number
          amount: number
          transaction_type: string
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          customer_id: number
          trip_id?: number
          amount: number
          transaction_type: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          customer_id?: number
          trip_id?: number
          amount?: number
          transaction_type?: string
          status?: string
          created_at?: string
        }
      }
      rolling_records: {
        Row: {
          id: number
          customer_id: number
          trip_id?: number
          rolling_amount: number
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          customer_id: number
          trip_id?: number
          rolling_amount: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          customer_id?: number
          trip_id?: number
          rolling_amount?: number
          status?: string
          created_at?: string
        }
      }
      ocr_data: {
        Row: {
          id: number
          file_id: number
          extracted_text: string
          confidence_score?: number
          processed_at?: string
          created_at?: string
        }
        Insert: {
          id?: number
          file_id: number
          extracted_text: string
          confidence_score?: number
          processed_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          file_id?: number
          extracted_text?: string
          confidence_score?: number
          processed_at?: string
          created_at?: string
        }
      }
      trip_customers: {
        Row: {
          id: number
          trip_id: number
          customer_id: number
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          trip_id: number
          customer_id: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          trip_id?: number
          customer_id?: number
          status?: string
          created_at?: string
        }
      }
      trip_agents: {
        Row: {
          id: number
          trip_id: number
          agent_id: number
          commission_rate?: number
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          trip_id: number
          agent_id: number
          commission_rate?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          trip_id?: number
          agent_id?: number
          commission_rate?: number
          status?: string
          created_at?: string
        }
      }
      trip_expenses: {
        Row: {
          id: number
          trip_id: number
          expense_type: string
          amount: number
          description?: string
          expense_date?: string
          created_at?: string
        }
        Insert: {
          id?: number
          trip_id: number
          expense_type: string
          amount: number
          description?: string
          expense_date?: string
          created_at?: string
        }
        Update: {
          id?: number
          trip_id?: number
          expense_type?: string
          amount?: number
          description?: string
          expense_date?: string
          created_at?: string
        }
      }
      trip_sharing: {
        Row: {
          id: number
          trip_id: number
          shared_with: string
          share_type: string
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          trip_id: number
          shared_with: string
          share_type: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          trip_id?: number
          shared_with?: string
          share_type?: string
          status?: string
          created_at?: string
        }
      }
      chip_exchanges: {
        Row: {
          id: number
          customer_id: number
          trip_id?: number
          chips_in: number
          chips_out: number
          exchange_rate?: number
          created_at?: string
        }
        Insert: {
          id?: number
          customer_id: number
          trip_id?: number
          chips_in: number
          chips_out: number
          exchange_rate?: number
          created_at?: string
        }
        Update: {
          id?: number
          customer_id?: number
          trip_id?: number
          chips_in?: number
          chips_out?: number
          exchange_rate?: number
          created_at?: string
        }
      }
      buy_in_out_records: {
        Row: {
          id: number
          customer_id: number
          trip_id?: number
          buy_in_amount: number
          cash_out_amount: number
          net_amount: number
          created_at?: string
        }
        Insert: {
          id?: number
          customer_id: number
          trip_id?: number
          buy_in_amount: number
          cash_out_amount: number
          net_amount: number
          created_at?: string
        }
        Update: {
          id?: number
          customer_id?: number
          trip_id?: number
          buy_in_amount?: number
          cash_out_amount?: number
          net_amount?: number
          created_at?: string
        }
      }
    }
  }
}

// Type-safe table access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TableInserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TableUpdates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience types for common tables
export type Customer = Tables<'customers'>
export type Agent = Tables<'agents'>
export type Trip = Tables<'trips'>
export type Transaction = Tables<'transactions'>
export type Staff = Tables<'staff'>
export type User = Tables<'users'>
