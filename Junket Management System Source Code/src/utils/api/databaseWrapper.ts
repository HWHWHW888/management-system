// Database wrapper that uses backend API instead of direct Supabase calls
import { apiClient } from './apiClient';
import { supabase } from '../supabase/supabaseClients';

export class DatabaseWrapper {
  // Expose API client for direct access to customer methods
  public apiClient = apiClient;
  private connectionCache: { result: any; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  async testConnection() {
    try {
      // Check cache first
      if (this.connectionCache) {
        const now = Date.now();
        if (now - this.connectionCache.timestamp < this.CACHE_DURATION) {
          console.log('⚡ Using cached connection result');
          return this.connectionCache.result;
        }
      }

      // Test backend API health with timeout
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${apiUrl?.replace('/api', '')}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      const result = response.ok && data.status === 'OK' ? {
        success: true,
        message: 'Connected successfully',
        details: 'Backend API connection is healthy'
      } : {
        success: false,
        message: 'Connection failed',
        details: 'Backend API is not responding'
      };

      // Cache the result
      this.connectionCache = {
        result,
        timestamp: Date.now()
      };

      return result;
    } catch (error: any) {
      const result = {
        success: false,
        message: 'Connection error',
        details: error.name === 'AbortError' ? 'Connection timeout' : error.message
      };

      // Cache failed result for shorter time
      this.connectionCache = {
        result,
        timestamp: Date.now() - (this.CACHE_DURATION - 5000) // Cache for only 5 seconds
      };

      return result;
    }
  }

  async isHealthy() {
    try {
      const connectionTest = await this.testConnection();
      return connectionTest.success;
    } catch (err) {
      console.error('❌ Database health check error:', err);
      return false;
    }
  }

  async get(table: string, filters: Array<{column: string, value: any}> = []) {
    try {
      let data = [];
      
      switch (table) {
        case 'users':
          const usersResponse = await apiClient.getUsers();
          data = usersResponse.success ? (usersResponse.data as any[]) || [] : [];
          break;
        case 'customers':
          const customersResponse = await apiClient.getCustomers();
          data = customersResponse.success ? (customersResponse.data as any[]) || [] : [];
          break;
        case 'agents':
          const agentsResponse = await apiClient.getAgents();
          data = agentsResponse.success ? (agentsResponse.data as any[]) || [] : [];
          break;
        case 'trips':
          const tripsResponse = await apiClient.getTrips();
          data = tripsResponse.success ? (tripsResponse.data as any[]) || [] : [];
          break;
        case 'transactions':
          const transactionsResponse = await apiClient.getTransactions();
          data = transactionsResponse.success ? (transactionsResponse.data as any[]) || [] : [];
          break;
        case 'staff':
          const staffResponse = await apiClient.getStaffs();
          data = staffResponse.success ? (staffResponse.data as any[]) || [] : [];
          break;
        case 'rolling_records':
          const rollingResponse = await apiClient.get('/rolling-records');
          data = rollingResponse.success ? (rollingResponse.data as any[]) || [] : [];
          break;
        default:
          console.warn(`Table ${table} not supported in API wrapper`);
          return [];
      }

      // Apply filters if provided
      if (filters.length > 0) {
        data = data.filter((item: any) => {
          return filters.every(filter => {
            if (filter.column && filter.value !== undefined) {
              return item[filter.column] === filter.value;
            }
            return true;
          });
        });
      }

      return data || [];
    } catch (error) {
      console.error(`Error fetching from ${table}:`, error);
      return [];
    }
  }

  async save(table: string, data: any[]) {
    try {
      // For now, we'll handle single record creation
      // In a real implementation, you'd want batch operations
      const results = [];
      
      for (const record of data) {
        let result;
        
        switch (table) {
          case 'users':
            result = await apiClient.createUser(record);
            break;
          case 'customers':
            result = await apiClient.createCustomer(record);
            break;
          case 'agents':
            result = await apiClient.createAgent(record);
            break;
          case 'trips':
            result = await apiClient.createTrip(record);
            break;
          case 'transactions':
            result = await apiClient.createTransaction(record);
            break;
          default:
            throw new Error(`Table ${table} not supported for save operation`);
        }
        
        results.push(result);
      }
      
      return { success: true, results };
    } catch (error) {
      console.error(`Error saving to ${table}:`, error);
      throw error;
    }
  }

  async initializeTables() {
    try {
      console.log('🔄 Backend API handles table initialization...');
      // Backend API handles table initialization
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async initializeSampleDataIfNeeded() {
    try {
      // Quick check if admin user exists with timeout
      const checkUserPromise = supabase
        .from('users')
        .select('username')
        .eq('username', 'admin')
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Check timeout')), 3000)
      );
      
      const { data: existingUser } = await Promise.race([
        checkUserPromise,
        timeoutPromise
      ]) as any;
      
      if (!existingUser) {
        console.log('🔧 Creating admin user...');
        
        // Parallel user creation with error handling
        const authPromise = supabase.auth.signUp({
          email: 'admin@casino.com',
          password: 'admin123',
          options: {
            data: { username: 'admin', role: 'admin' }
          }
        }).catch((err: any) => {
          console.warn('Auth creation skipped:', err.message);
          return { data: { user: { id: 'admin-1' } } };
        });

        const profilePromise = (async () => {
          try {
            await supabase
              .from('users')
              .insert([{
                id: 'admin-1',
                username: 'admin',
                password: 'admin123',
                role: 'admin'
              }]);
            console.log('Profile created');
            return true;
          } catch (err: any) {
            if (!err.message.includes('duplicate')) {
              console.warn('Profile creation failed:', err);
            }
            return false;
          }
        })();

        // Execute in parallel with timeout
        await Promise.race([
          Promise.all([authPromise, profilePromise]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Initialization timeout')), 5000)
          )
        ]);
        
        console.log('✅ Admin user initialized');
      } else {
        console.log('⚡ Admin user already exists - skipping');
      }
    } catch (error: any) {
      if (error.message === 'Check timeout' || error.message === 'Initialization timeout') {
        console.warn('⚠️ User initialization timed out - continuing anyway');
      } else {
        console.error('Error initializing sample data:', error);
      }
      // Don't throw - continue with app initialization
    }
  }

  async login(username: string, password: string) {
    try {
      console.log('🔐 DatabaseWrapper: Starting login process...');
      const response = await apiClient.login(username, password);
      console.log('🔐 DatabaseWrapper: Login response:', response);
      
      if (!response.success) {
        throw new Error((response as any).error || 'Login failed');
      }
      
      // ApiClient now handles token storage automatically
      // Just extract the user data from the response
      const responseData = response.data as any;
      let user = null;
      let token = null;
      
      if (responseData?.data?.user) {
        user = responseData.data.user;
        token = responseData.data.token;
      } else if (responseData?.user) {
        user = responseData.user;
        token = responseData.token;
      } else {
        // Fallback - create user from response data
        user = {
          id: responseData?.id || 'admin-1',
          username: responseData?.username || username,
          role: responseData?.role || 'admin'
        };
      }
      
      console.log('🔑 DatabaseWrapper: User extracted:', user);
      console.log('🔑 DatabaseWrapper: Token present:', token ? 'YES' : 'NO');
      
      // ApiClient already saved to localStorage and set tokens
      // Just return the user object
      return user;
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Clear all data for fresh start
  async clearAllDataForFreshStart() {
    try {
      console.log('⚠️ Clear data operation should be handled by backend API');
      // This would need to be implemented as an admin endpoint
      return true;
    } catch (error) {
      console.error('Error during fresh start:', error);
      throw error;
    }
  }

  // Export all data
  async exportAllData() {
    try {
      const exportData: any = {};
      
      const tables = ['users', 'agents', 'customers', 'trips', 'transactions'];
      
      for (const table of tables) {
        const data = await this.get(table, []);
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
      const tables = ['users', 'agents', 'customers', 'trips', 'transactions'];
      
      for (const table of tables) {
        if (data[table] && Array.isArray(data[table]) && data[table].length > 0) {
          await this.save(table, data[table]);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // Get database statistics
  getStats() {
    return {
      mode: 'api',
      healthy: true,
      lastHealthCheck: new Date().toISOString(),
      backupCount: 0
    };
  }

  // Get available backups
  getAvailableBackups() {
    return [];
  }

  // Staff management methods
  async getStaffs() {
    try {
      console.log('📋 DatabaseWrapper: Fetching all staff members...');
      const response = await apiClient.getStaffs();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch staff members');
      }
      
      return response.data || [];
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error fetching staff:', error);
      throw error;
    }
  }

  async getStaff(id: string) {
    try {
      console.log(`📋 DatabaseWrapper: Fetching staff member: ${id}`);
      const response = await apiClient.getStaff(id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error fetching staff:', error);
      throw error;
    }
  }

  async createStaff(staffData: any) {
    try {
      console.log('👤 DatabaseWrapper: Creating staff member...');
      const response = await apiClient.createStaff(staffData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error creating staff:', error);
      throw error;
    }
  }

  async updateStaff(id: string, staffData: any) {
    try {
      console.log(`👤 DatabaseWrapper: Updating staff member: ${id}`);
      const response = await apiClient.updateStaff(id, staffData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error updating staff:', error);
      throw error;
    }
  }

  async deleteStaff(id: string) {
    try {
      console.log(`🗑️ DatabaseWrapper: Deleting staff member: ${id}`);
      const response = await apiClient.deleteStaff(id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error deleting staff:', error);
      throw error;
    }
  }

  async staffCheckIn(id: string, checkInData: any) {
    try {
      console.log(`⏰ DatabaseWrapper: Staff check-in: ${id}`);
      const response = await apiClient.staffCheckIn(id, checkInData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to check in staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error checking in staff:', error);
      throw error;
    }
  }

  async staffCheckOut(id: string, checkOutData: any) {
    try {
      console.log(`⏰ DatabaseWrapper: Staff check-out: ${id}`);
      const response = await apiClient.staffCheckOut(id, checkOutData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to check out staff member');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error checking out staff:', error);
      throw error;
    }
  }

  async getStaffShifts(id: string, params?: any) {
    try {
      console.log(`📋 DatabaseWrapper: Fetching shifts for staff: ${id}`);
      const response = await apiClient.getStaffShifts(id, params);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch staff shifts');
      }
      
      return response.data || [];
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error fetching staff shifts:', error);
      throw error;
    }
  }

  async getStaffRollingRecords(id: string, params?: any) {
    try {
      console.log(`📋 DatabaseWrapper: Fetching rolling records for staff: ${id}`);
      const response = await apiClient.getStaffRollingRecords(id, params);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch staff rolling records');
      }
      
      return response.data || [];
    } catch (error) {
      console.error('❌ DatabaseWrapper: Error fetching staff rolling records:', error);
      throw error;
    }
  }
}

// Export the wrapped database instance
export const db = new DatabaseWrapper();
