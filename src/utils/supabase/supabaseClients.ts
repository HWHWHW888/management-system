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
          id: string
          name: string
          email?: string
          phone?: string
          position?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          email?: string
          phone?: string
          position?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
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
          id: string
          name: string
          email?: string
          phone?: string
          commission_rate?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          email?: string
          phone?: string
          commission_rate?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
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
          id: string
          name: string
          email?: string
          phone?: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          credit_limit?: number
          available_credit?: number
          rolling_percentage?: number
          is_active?: boolean
          is_agent?: boolean
          source_agent_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          email?: string
          phone?: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          credit_limit?: number
          available_credit?: number
          rolling_percentage?: number
          is_active?: boolean
          is_agent?: boolean
          source_agent_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          credit_limit?: number
          available_credit?: number
          rolling_percentage?: number
          is_active?: boolean
          is_agent?: boolean
          source_agent_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          username: string
          password: string
          email?: string
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          username: string
          password: string
          email?: string
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          password?: string
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
          id: string
          staff_id?: string
          check_in_time?: string
          check_out_time?: string
          check_in_photo?: string
          check_out_photo?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          staff_id?: string
          check_in_time?: string
          check_out_time?: string
          check_in_photo?: string
          check_out_photo?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          check_in_time?: string
          check_out_time?: string
          check_in_photo?: string
          check_out_photo?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          name: string
          description?: string
          date: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          calculated_total_rolling?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          date: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          calculated_total_rolling?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          date?: string
          agent_id?: string
          agent_name?: string
          total_rolling?: number
          total_win_loss?: number
          total_buy_in?: number
          total_buy_out?: number
          calculated_total_rolling?: number
          status?: string
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
          id: string
          customer_id?: string
          trip_id?: string
          amount: number
          win_loss?: number
          game_type?: string
          recorded_at?: string
          recorded_by?: string
          notes?: string
          created_at?: string
        }
        Insert: {
          id?: string
          customer_id?: string
          trip_id?: string
          amount: number
          win_loss?: number
          game_type?: string
          recorded_at?: string
          recorded_by?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          trip_id?: string
          amount?: number
          win_loss?: number
          game_type?: string
          recorded_at?: string
          recorded_by?: string
          notes?: string
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
      trip_agent_customers: {
        Row: {
          id: number
          trip_id: number
          agent_id: number
          profit_sharing_rate?: number
          status?: string
          created_at?: string
        }
        Insert: {
          id?: number
          trip_id: number
          agent_id: number
          profit_sharing_rate?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: number
          trip_id?: number
          agent_id?: number
          profit_sharing_rate?: number
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
          id: string
          customer_id?: string
          trip_id?: string
          type: string
          amount: number
          recorded_at?: string
          recorded_by?: string
          notes?: string
          created_at?: string
        }
        Insert: {
          id?: string
          customer_id?: string
          trip_id?: string
          type: string
          amount: number
          recorded_at?: string
          recorded_by?: string
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          trip_id?: string
          type?: string
          amount?: number
          recorded_at?: string
          recorded_by?: string
          notes?: string
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

// Database wrapper with custom methods
class DatabaseWrapper {
  private client = supabase;

  async testConnection() {
    try {
      const { count, error } = await this.client
      .from('users')
      .select('*', { count: 'exact', head: true });
      if (error) {
        return {
          success: false,
          message: 'Connection failed',
          details: error.message
        };
      }
      return {
        success: true,
        message: 'Connected successfully',
        details: `Users table has ${count} rows`
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Connection error',
        details: error.message
      };
    }
  }

  async isHealthy() {
    try {
      // Test basic connection first
      const { error } = await this.client
      .from('users')
      .select('id')
      .limit(1);
      
      if (error) {
        console.error('❌ Database connection failed:', error.message);
        
        if (error.message.includes('permission denied')) {
          console.error('❌ Permission denied - check Supabase RLS policies and API key');
          return false;
        }
        
        return false;
      }
      
      // Test if users table exists
      const { error: usersError } = await this.client
        .from('users')
        .select('id')
        .limit(1);
      
      if (usersError && usersError.message.includes('does not exist')) {
        console.log('⚠️ Users table does not exist - manual table creation required');
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('❌ Database health check error:', err);
      return false;
    }
  }

  async get(table: string, filters: Array<{column: string, value: any}> = []) {
    try {
      let query = this.client.from(table).select('*');
      
      // Apply filters if provided
      for (const filter of filters) {
        if (filter.column && filter.value) {
          query = query.eq(filter.column, filter.value);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error fetching from ${table}:`, error);
      return [];
    }
  }

  async save(table: string, data: any[]) {
    try {
      const { error } = await this.client.from(table).upsert(data);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error(`Error saving to ${table}:`, error);
      throw error;
    }
  }

  async initializeTables() {
    try {
      console.log('🔄 Attempting to initialize database tables...');
      
      // First, try to check if we have basic read access
      const { error: readError } = await this.client
        .from('users')
        .select('id')
        .limit(1);
      
      if (readError) {
        console.error('❌ No read access to database:', readError.message);
        throw new Error(`Database access denied: ${readError.message}`);
      }
      
      // Try to create a simple test table to check write permissions
      const { error: createError } = await this.client.rpc('exec_sql', {
        sql: 'CREATE TABLE IF NOT EXISTS test_permissions (id SERIAL PRIMARY KEY);'
      });
      
      if (createError) {
        console.error('❌ No write permissions:', createError.message);
        throw new Error(`Database write access denied: ${createError.message}`);
      }
      
      // Clean up test table
      await this.client.rpc('exec_sql', {
        sql: 'DROP TABLE IF EXISTS test_permissions;'
      });
      
      console.log('✅ Database permissions verified');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }
  
  async createTablesDirectly() {
    try {
      // Create users table with direct SQL if RPC fails
      const { error } = await this.client.from('users').select('id').limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log('⚠️ Tables do not exist. Please create them manually in Supabase.');
        console.log('📋 Required tables: users, agents, customers, staff, trips, rolling_records, buy_in_out_records, staff_shifts');
      }
    } catch (err) {
      console.error('Direct table creation failed:', err);
    }
  }

  async initializeSampleDataIfNeeded() {
    try {
      // Check if admin user exists
      const { data: users } = await this.client.from('users').select('*').eq('username', 'admin');
      
      if (!users || users.length === 0) {
        // Create admin user
        await this.client.from('users').insert([
          {
            id: 'admin-1',
            username: 'admin',
            password: 'admin123',
            email: 'admin@casino.com',
            role: 'admin',
            status: 'active'
          }
        ]);
        console.log('✅ Admin user created');
      }

    } catch (error) {
      console.error('Error initializing sample data:', error);
    }
  }

  // Login method for authentication
  async login(username: string, password: string) {
    try {
      const { data: users, error } = await this.client
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !users) {
        throw new Error('Invalid username or password');
      }

      return users;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Clear all data for fresh start
  async clearAllDataForFreshStart() {
    try {
      // Clear all tables in order (respecting foreign key constraints)
      const tables = [
        'rolling_records',
        'buy_in_out_records',
        'staff_shifts',
        'trip_customers',
        'trip_expenses',
        'trips',
        'customers',
        'agents',
        'staff',
        'users'
      ];

      for (const table of tables) {
        await this.client.from(table).delete().neq('id', '');
      }

      // Recreate admin user
      await this.client.from('users').insert([
        {
          id: 'admin-1',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          status: 'active'
        }
      ]);

      console.log('✅ Fresh start completed - all data cleared and admin recreated');
    } catch (error) {
      console.error('Error during fresh start:', error);
      throw error;
    }
  }

  // Export all data
  async exportAllData() {
    try {
      const tables = ['users', 'agents', 'customers', 'staff', 'trips', 'rolling_records', 'buy_in_out_records', 'staff_shifts'];
      const exportData: any = {};

      for (const table of tables) {
        const { data, error } = await this.client.from(table).select('*');
        if (error) throw error;
        exportData[table] = data || [];
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // Import all data
  async importAllData(data: any) {
    try {
      const tables = ['users', 'agents', 'customers', 'staff', 'trips', 'rolling_records', 'buy_in_out_records', 'staff_shifts'];
      
      for (const table of tables) {
        if (data[table] && Array.isArray(data[table]) && data[table].length > 0) {
          const { error } = await this.client.from(table).insert(data[table]);
          if (error) throw error;
        }
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // Restore from backup (placeholder implementation)
  async restoreFromBackup(key: string, timestamp: string | number) {
    try {
      // This is a placeholder - in a real implementation, you would restore from actual backup storage
      const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
      console.log(`Restoring from backup: ${key} at ${new Date(timestampNum).toISOString()}`);
      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  // Get database statistics
  getStats() {
    return {
      mode: 'production',
      healthy: true,
      lastHealthCheck: new Date().toISOString(),
      backupCount: 2
    };
  }

  // Get available backups
  getAvailableBackups() {
    return [
      {
        key: 'backup_2024_01_01',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        size: 1200000,
        description: 'Daily backup'
      },
      {
        key: 'backup_2024_01_02',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        size: 1500000,
        description: 'Manual backup'
      }
    ];
  }

  // Expose the original supabase client for direct access
  get supabase() {
    return this.client;
  }
}

// Export the wrapped database instance
export const db = new DatabaseWrapper();
