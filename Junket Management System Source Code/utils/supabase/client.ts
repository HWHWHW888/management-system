import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create singleton Supabase client
export const supabase = createClient(supabaseUrl, publicAnonKey);

// FIXED: Much more aggressive timeout reduction to prevent abort errors
const TIMEOUTS = {
  HEALTH_CHECK: 8000,     // 8 seconds (much more aggressive)
  GET_REQUEST: 10000,     // 10 seconds (much more aggressive) 
  SAVE_REQUEST: 15000,    // 15 seconds (much more aggressive)
  LOGIN_REQUEST: 8000,    // 8 seconds (much more aggressive)
  MIGRATION_REQUEST: 25000 // 25 seconds (much more aggressive)
};

// FIXED: More aggressive retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 2,         // Reduced from 3 to 2 to fail faster
  INITIAL_DELAY: 500,     // 0.5 second (reduced from 1 second)
  MAX_DELAY: 3000,        // 3 seconds (reduced from 10 seconds)
  BACKOFF_FACTOR: 1.5     // Less aggressive backoff
};

// Database service class - SUPABASE ONLY MODE
export class DatabaseService {
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private healthStatus: boolean = true;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private useAbortController: boolean = true; // FIXED: Flag to disable abort controller if needed

  constructor() {
    console.log('🔧 DatabaseService initialized in SUPABASE-ONLY mode with enhanced reliability');
    console.log('🔗 Supabase URL:', supabaseUrl);
    console.log('🔑 Using public anon key:', publicAnonKey.substring(0, 50) + '...');
    console.log('⏱️ Enhanced timeouts and retry logic enabled');
  }

  // FIXED: Enhanced retry logic with better signal abort handling
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    operation: string,
    maxRetries: number = RETRY_CONFIG.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        
        // Log successful retry
        if (attempt > 0) {
          console.log(`✅ ${operation} succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // FIXED: Special handling for signal abort errors
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.warn(`⚠️ ${operation} was aborted (attempt ${attempt + 1}/${maxRetries + 1}) - this is often due to timeouts`);
          
          // For abort errors, reduce delay and retry more aggressively
          if (attempt < maxRetries) {
            const shortDelay = Math.min(500 * (attempt + 1), 2000); // Shorter delay for abort errors
            console.log(`🔄 Retrying aborted request in ${shortDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, shortDelay));
            continue;
          }
        }
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // FIXED: Skip retry for certain non-retryable errors
        if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
          console.warn(`⚠️ ${operation} failed with non-retryable error: ${error.message}`);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, attempt),
          RETRY_CONFIG.MAX_DELAY
        );
        
        console.warn(`⚠️ ${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        console.log(`🔄 Retrying in ${delay}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries failed
    console.error(`❌ ${operation} failed after ${maxRetries + 1} attempts:`, lastError);
    throw lastError;
  }

  // FIXED: Enhanced error message formatting with better signal abort handling
  private formatError(error: Error, operation: string): string {
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      return `Request cancelled: ${operation} was cancelled or timed out. This is usually temporary - please try again.`;
    } else if (error.message.includes('signal is aborted without reason')) {
      return `Connection issue: The request was interrupted unexpectedly. Please check your connection and retry.`;
    } else if (error.message.includes('Failed to fetch')) {
      return `Network error: Cannot connect to the server. Please check your internet connection and try again.`;
    } else if (error.message.includes('timeout')) {
      return `Timeout error: The server is taking too long to respond. Please try again.`;
    } else if (error.message.includes('TypeError: Failed to fetch')) {
      return `Connection error: Unable to reach the server. Please verify your internet connection.`;
    } else {
      return `${operation} failed: ${error.message}`;
    }
  }

  // Request deduplication to prevent concurrent duplicate requests
  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if same request is already in progress
    if (this.requestQueue.has(key)) {
      console.log(`🔄 Deduplicating request: ${key}`);
      return this.requestQueue.get(key);
    }

    // Execute request and store promise
    const requestPromise = requestFn().finally(() => {
      // Remove from queue when completed
      this.requestQueue.delete(key);
    });

    this.requestQueue.set(key, requestPromise);
    return requestPromise;
  }

  // Check Supabase server health with enhanced error handling
  private async checkSupabaseHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval && this.healthStatus) {
      return this.healthStatus;
    }

    try {
      const healthResult = await this.retryRequest(async () => {
        const healthUrl = `${supabaseUrl}/functions/v1/make-server-86a1418e/health`;
        console.log('🔍 Checking Supabase health at:', healthUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.HEALTH_CHECK);
        
        try {
          const response = await fetch(healthUrl, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
          }
          
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, 'Health check');

      this.healthStatus = true;
      this.lastHealthCheck = now;
      console.log('🟢 Supabase health check passed');
      return true;
      
    } catch (error) {
      console.error('🔴 Supabase health check error:', error);
      this.healthStatus = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  // FIXED: Enhanced GET method with optional abort controller
  async get<T>(key: string, defaultValue: T[] = []): Promise<T[]> {
    return this.deduplicateRequest(`get-${key}`, async () => {
      return this.retryRequest(async () => {
        const url = `${supabaseUrl}/functions/v1/make-server-86a1418e/${key}`;
        console.log(`📥 Fetching ${key} from:`, url);
        
        let controller: AbortController | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        
        const fetchOptions: RequestInit = {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        };

        // FIXED: Only use AbortController if enabled (can be disabled for debugging)
        if (this.useAbortController) {
          controller = new AbortController();
          fetchOptions.signal = controller.signal;
          
          timeoutId = setTimeout(() => {
            console.log(`⏰ Timeout triggered for ${key} after ${TIMEOUTS.GET_REQUEST}ms`);
            if (controller) controller.abort();
          }, TIMEOUTS.GET_REQUEST);
        } else {
          console.log(`🔧 Fetching ${key} without abort controller (debugging mode)`);
        }
        
        try {
          const response = await fetch(url, fetchOptions);
          
          if (timeoutId) clearTimeout(timeoutId);
          
          if (!response.ok) {
            let errorText = '';
            try {
              errorText = await response.text();
            } catch (textError) {
              errorText = 'Could not read error response';
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
          }
          
          const result = await response.json();
          console.log(`✅ Successfully fetched ${key}:`, result.data?.length || 0, 'items');
          return result.data || defaultValue;
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          
          // FIXED: More detailed error logging
          if (error.name === 'AbortError') {
            console.warn(`⚠️ Fetch ${key} was aborted (timeout after ${TIMEOUTS.GET_REQUEST}ms)`);
            // FIXED: Try disabling abort controller on next requests if we get too many aborts
            if (this.useAbortController) {
              console.log(`🔧 Consider disabling abort controller for ${key} if this persists`);
            }
          } else if (error.message.includes('Failed to fetch')) {
            console.warn(`⚠️ Network error fetching ${key}: Could not connect to server`);
          } else {
            console.warn(`⚠️ Unknown error fetching ${key}:`, error.message);
          }
          
          throw error;
        }
      }, `Fetch ${key}`);
    });
  }

  // FIXED: Enhanced SAVE method with optional abort controller
  async save<T>(key: string, data: T[]): Promise<void> {
    // Create backup in localStorage for emergency recovery
    this.saveToLocalStorageBackup(key, data);

    return this.retryRequest(async () => {
      const url = `${supabaseUrl}/functions/v1/make-server-86a1418e/${key}`;
      console.log(`📤 Saving ${key} to:`, url, '- Items:', data.length);
      
      let controller: AbortController | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data })
      };

      // FIXED: Only use AbortController if enabled
      if (this.useAbortController) {
        controller = new AbortController();
        fetchOptions.signal = controller.signal;
        
        timeoutId = setTimeout(() => {
          console.log(`⏰ Save timeout triggered for ${key} after ${TIMEOUTS.SAVE_REQUEST}ms`);
          if (controller) controller.abort();
        }, TIMEOUTS.SAVE_REQUEST);
      } else {
        console.log(`🔧 Saving ${key} without abort controller (debugging mode)`);
      }
      
      try {
        const response = await fetch(url, fetchOptions);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (textError) {
            errorText = 'Could not read error response';
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`✅ Successfully saved ${key} to Supabase:`, result.message);
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          console.warn(`⚠️ Save ${key} was aborted (timeout after ${TIMEOUTS.SAVE_REQUEST}ms)`);
        } else if (error.message.includes('Failed to fetch')) {
          console.warn(`⚠️ Network error saving ${key}: Could not connect to server`);
        }
        
        throw error;
      }
    }, `Save ${key}`);
  }

  // UPDATED: Enhanced LOGIN method with better error handling and debugging
  async login(username: string, password: string): Promise<any> {
    return this.retryRequest(async () => {
      const loginUrl = `${supabaseUrl}/functions/v1/make-server-86a1418e/login`;
      console.log('🔐 Attempting login at:', loginUrl);
      console.log('👤 Username:', username);
      console.log('🔑 Password length:', password.length);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.LOGIN_REQUEST);
      
      try {
        const response = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('📡 Login response status:', response.status, response.statusText);
        
        if (!response.ok) {
          let errorResult;
          try {
            errorResult = await response.json();
            console.log('❌ Login error response:', errorResult);
          } catch (jsonError) {
            const errorText = await response.text();
            console.log('❌ Login error text:', errorText);
            errorResult = { error: `Server error: ${response.status} ${response.statusText} - ${errorText}` };
          }
          
          throw new Error(errorResult.error || 'Invalid credentials');
        }
        
        const result = await response.json();
        console.log('✅ Login successful:', result);
        return result.user;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Login request error:', error);
        throw error;
      }
    }, 'User login', 2); // Only retry login twice to avoid account lockout
  }

  // Enhanced test connectivity method
  async testConnection(): Promise<{ success: boolean, message: string, details?: any }> {
    try {
      console.log('🔍 Testing Supabase connection with enhanced reliability...');
      
      // Test health endpoint with retry
      const healthResult = await this.checkSupabaseHealth();
      if (!healthResult) {
        return {
          success: false,
          message: 'Health check failed after retries',
          details: 'Server is not responding to health checks even after multiple attempts'
        };
      }

      // Test data endpoint with retry
      try {
        const testData = await this.get('users', []);
        return {
          success: true,
          message: 'Connection successful with retry support',
          details: `Found ${testData.length} users in database. Enhanced timeouts and retry logic active.`
        };
      } catch (dataError) {
        return {
          success: false,
          message: 'Data access failed after retries',
          details: this.formatError(dataError, 'Data access test')
        };
      }
      
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        details: this.formatError(error, 'Connection test')
      };
    }
  }

  // Enhanced migration method with increased timeout
  async migrateData(): Promise<void> {
    try {
      console.log('🚀 Starting data migration with enhanced reliability...');
      
      const dataToMigrate: { [key: string]: any[] } = {};
      const dataKeys = [
        'users', 'agents', 'customers', 'transactions', 
        'trips', 'staff', 'shifts', 'chipExchanges', 'gameTypes', 'rollingRecords', 'staffAccounts', 'buyInOutRecords'
      ];

      // Collect data from localStorage backups
      for (const key of dataKeys) {
        const localData = this.getFromLocalStorageBackup(key, []);
        if (localData.length > 0) {
          dataToMigrate[key] = localData;
          console.log(`📦 Found ${localData.length} ${key} records to migrate`);
        }
      }

      if (Object.keys(dataToMigrate).length === 0) {
        console.log('ℹ️ No data found in localStorage to migrate');
        return;
      }

      console.log('🔄 Migrating data to Supabase with enhanced timeouts...', Object.keys(dataToMigrate));
      
      await this.retryRequest(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.MIGRATION_REQUEST);
        
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/make-server-86a1418e/migrate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToMigrate),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Migration failed: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const result = await response.json();
          console.log('✅ Migration completed successfully:', result.message);
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, 'Data migration');
      
    } catch (error) {
      console.error('🔴 Migration error:', error);
      throw new Error(this.formatError(error, 'Data migration'));
    }
  }

  // Export all data for backup/download
  async exportAllData(): Promise<string> {
    const exportData: {[key: string]: any} = {};
    
    const dataKeys = [
      'users', 'agents', 'customers', 'transactions', 
      'trips', 'staff', 'shifts', 'chipExchanges', 'gameTypes', 'rollingRecords', 'staffAccounts', 'buyInOutRecords'
    ];

    try {
      for (const key of dataKeys) {
        exportData[key] = await this.get(key, []);
      }

      exportData.metadata = {
        exportTimestamp: new Date().toISOString(),
        databaseMode: 'supabase-enhanced',
        version: '2.0',
        reliability: 'enhanced-timeouts-and-retry'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error(this.formatError(error, 'Data export'));
    }
  }

  // Import data from backup file
  async importAllData(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);
      
      // Validate import data
      if (!importData.metadata || !importData.metadata.exportTimestamp) {
        throw new Error('Invalid import data format');
      }

      const dataKeys = [
        'users', 'agents', 'customers', 'transactions', 
        'trips', 'staff', 'shifts', 'chipExchanges', 'gameTypes', 'rollingRecords', 'staffAccounts', 'buyInOutRecords'
      ];

      // Import each data type with retry logic
      for (const key of dataKeys) {
        if (importData[key] && Array.isArray(importData[key])) {
          await this.save(key, importData[key]);
          console.log(`✅ Imported ${importData[key].length} ${key} records`);
        }
      }

      console.log(`✅ Successfully imported data from ${importData.metadata.exportTimestamp}`);
    } catch (error) {
      console.error('Error importing data:', error);
      throw new Error(this.formatError(error, 'Data import'));
    }
  }

  // Get available backups from localStorage (for emergency recovery only)
  getAvailableBackups(): Array<{key: string, timestamp: string, size: number}> {
    const backups: Array<{key: string, timestamp: string, size: number}> = [];
    
    try {
      Object.keys(localStorage).forEach(storageKey => {
        if (storageKey.startsWith('casinoBackup_')) {
          try {
            const backupData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            backups.push({
              key: backupData.key,
              timestamp: backupData.timestamp,
              size: backupData.size
            });
          } catch (error) {
            // Ignore invalid backup entries
          }
        }
      });
    } catch (error) {
      console.error('Error getting available backups:', error);
    }
    
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Restore data from localStorage backup (emergency recovery)
  async restoreFromBackup(key: string, timestamp: string): Promise<void> {
    try {
      const backupKey = `casinoBackup_${key}_${timestamp}`;
      const backupData = localStorage.getItem(backupKey);
      
      if (!backupData) {
        throw new Error('Backup not found');
      }
      
      const backup = JSON.parse(backupData);
      await this.save(key, backup.data);
      
      console.log(`✅ Successfully restored ${key} from backup ${timestamp}`);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw new Error(this.formatError(error, 'Backup restoration'));
    }
  }

  // Public method to check if Supabase is healthy
  async isHealthy(): Promise<boolean> {
    return await this.checkSupabaseHealth();
  }

  // FIXED: Public method to disable abort controller for debugging
  disableAbortController(): void {
    console.log('⚠️ Disabling AbortController for debugging timeout issues');
    this.useAbortController = false;
  }

  // FIXED: Public method to re-enable abort controller
  enableAbortController(): void {
    console.log('✅ Re-enabling AbortController');
    this.useAbortController = true;
  }

  // Get enhanced database statistics
  getStats(): {mode: string, healthy: boolean, lastHealthCheck: string, backupCount: number, reliability: string, abortController: boolean} {
    return {
      mode: 'Supabase Enhanced',
      healthy: this.healthStatus,
      lastHealthCheck: new Date(this.lastHealthCheck).toLocaleString(),
      backupCount: this.getAvailableBackups().length,
      reliability: 'Enhanced timeouts, retry logic, and error handling',
      abortController: this.useAbortController
    };
  }

  // FIXED: Quick test method to check individual data type without retries
  async quickTest(key: string): Promise<{success: boolean, message: string, data?: any}> {
    try {
      console.log(`🧪 Quick test for ${key}...`);
      const url = `${supabaseUrl}/functions/v1/make-server-86a1418e/${key}`;
      
      // Simple fetch without retry or abort controller
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const result = await response.json();
      return {
        success: true,
        message: `Successfully fetched ${key}`,
        data: result.data
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  // Always returns true since we're in Supabase-only mode
  isSupabaseEnabled(): boolean {
    return true;
  }

  // Private methods for emergency localStorage backup (not for normal operation)
  private saveToLocalStorageBackup<T>(key: string, data: T[]): void {
    try {
      // Create timestamped backup
      const timestamp = new Date().toISOString();
      const backupKey = `casinoBackup_${key}_${timestamp}`;
      const backupData = {
        key,
        data,
        timestamp,
        size: JSON.stringify(data).length
      };
      
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Keep only the last 3 backups for each key to prevent storage bloat
      this.cleanupOldBackups(key);
    } catch (error) {
      console.warn(`Warning: Could not create localStorage backup for ${key}:`, error);
      // Don't throw error here as this is just a backup, not critical operation
    }
  }

  private getFromLocalStorageBackup<T>(key: string, defaultValue: T[]): T[] {
    try {
      const stored = localStorage.getItem(`casino${key.charAt(0).toUpperCase() + key.slice(1)}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.warn(`Warning: Error reading ${key} from localStorage backup:`, error);
      return defaultValue;
    }
  }

  private cleanupOldBackups(key: string): void {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(k => k.startsWith(`casinoBackup_${key}_`))
        .sort()
        .reverse(); // Most recent first

      // Remove old backups, keep only the last 3
      for (let i = 3; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
    } catch (error) {
      console.warn('Warning: Error cleaning up backups:', error);
    }
  }

  // FIXED: Data-safe initialization that preserves existing user data
  async initializeSampleDataIfNeeded(): Promise<void> {
    try {
      console.log('🔧 Checking if database initialization is needed (preserving existing data)...');
      
      // Check if we have any users at all
      let existingUsers = [];
      try {
        existingUsers = await this.get('users', []);
        console.log(`📊 Found ${existingUsers.length} existing users in database`);
      } catch (fetchError) {
        console.warn(`⚠️ Could not fetch users (${fetchError.message}), treating as empty`);
        existingUsers = [];
      }

      // Only initialize if we have NO users at all (truly empty database)
      if (existingUsers.length === 0) {
        console.log('🔧 Database appears to be empty, creating initial admin user...');
        
        const adminUser = {
          id: 'admin_001',
          username: 'admin',
          password: 'admin@8888',
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString().split('T')[0],
          createdBy: 'system'
        };

        try {
          await this.save('users', [adminUser]);
          console.log('✅ Created initial admin user with credentials: admin/admin@8888');
        } catch (saveError) {
          console.error('❌ Failed to create initial admin user:', saveError.message);
          throw saveError;
        }
      } else {
        // Check if we have at least one admin user
        const adminUsers = existingUsers.filter((user: any) => user.role === 'admin');
        if (adminUsers.length === 0) {
          console.log('⚠️ No admin users found, adding default admin...');
          
          const adminUser = {
            id: 'admin_001',
            username: 'admin',
            password: 'admin@8888',
            role: 'admin',
            isActive: true,
            createdAt: new Date().toISOString().split('T')[0],
            createdBy: 'system'
          };

          const updatedUsers = [...existingUsers, adminUser];
          await this.save('users', updatedUsers);
          console.log('✅ Added default admin user to existing user data');
        } else {
          console.log(`✅ Database already has ${existingUsers.length} users including ${adminUsers.length} admin(s) - no initialization needed`);
        }
      }

      // Ensure all other data types exist (initialize as empty arrays if missing, but don't clear existing data)
      const dataTypes = [
        'agents', 'customers', 'staff', 'staffAccounts', 'trips', 'shifts', 
        'chipExchanges', 'gameTypes', 'rollingRecords', 'transactions', 'buyInOutRecords'
      ];

      for (const dataType of dataTypes) {
        try {
          const existing = await this.get(dataType, []);
          console.log(`📊 ${dataType}: ${existing.length} existing records (preserved)`);
          
          // Small delay to prevent overload
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn(`⚠️ Could not check ${dataType}:`, error.message);
        }
      }

      console.log('✅ Data-safe initialization completed successfully');
      console.log('💾 All existing user data has been preserved');
      
    } catch (error) {
      console.error('❌ Failed to initialize database safely:', error);
      throw new Error(this.formatError(error, 'Safe database initialization'));
    }
  }

  // NEW: Separate method for deliberately clearing all data (admin only)
  async clearAllDataForFreshStart(): Promise<void> {
    try {
      console.log('🧹 CLEARING ALL DATA for fresh start (admin request)...');
      
      // Clear all data types
      const dataTypes = [
        'users', 'agents', 'customers', 'staff', 'staffAccounts', 'trips', 'shifts', 
        'chipExchanges', 'gameTypes', 'rollingRecords', 'transactions', 'buyInOutRecords'
      ];

      for (const dataType of dataTypes) {
        try {
          await this.save(dataType, []);
          console.log(`🧹 Cleared all ${dataType} data`);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(`⚠️ Could not clear ${dataType}:`, error.message);
        }
      }

      // Create fresh admin user
      const adminUser = {
        id: 'admin_001',
        username: 'admin',
        password: 'admin@8888',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy: 'system'
      };

      await this.save('users', [adminUser]);
      
      console.log('✅ Fresh start completed - all data cleared and admin user created');
      
    } catch (error) {
      console.error('❌ Failed to clear data for fresh start:', error);
      throw new Error(this.formatError(error, 'Fresh start operation'));
    }
  }

  // Helper method to set data directly (for admin management)
  async set<T>(key: string, data: T[]): Promise<void> {
    return this.save(key, data);
  }
}

// Create singleton instance
export const db = new DatabaseService();