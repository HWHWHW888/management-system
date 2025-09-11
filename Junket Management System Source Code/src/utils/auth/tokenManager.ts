// Centralized token management for authentication
import { supabase } from '../supabase/supabaseClients';

export class TokenManager {
  private static instance: TokenManager;
  private token: string | undefined = undefined;
  private refreshPromise: Promise<string | undefined> | null = null;

  private constructor() {
    this.initializeToken();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  private async initializeToken() {
    await this.getToken();
  }

  async getToken(): Promise<string | undefined> {
    console.log('🔍 TokenManager: Getting token...');
    
    // If we have a cached token, return it
    if (this.token) {
      console.log('🔑 TokenManager: Returning cached token');
      return this.token;
    }
    
    // Check localStorage for different possible token storage formats
    const storedUser = localStorage.getItem('casinoUser');
    console.log('🔍 TokenManager: localStorage data:', storedUser);
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        console.log('🔍 TokenManager: Parsed user data:', userData);
        console.log('🔍 TokenManager: userData keys:', Object.keys(userData));
        
        // Check for token in different possible fields
        const possibleTokenFields = ['token', 'access_token', 'jwt', 'authToken'];
        for (const field of possibleTokenFields) {
          if (userData[field]) {
            this.token = userData[field];
            console.log(`🔑 TokenManager: Found token in localStorage field '${field}':`, userData[field].substring(0, 20) + '...');
            return userData[field];
          }
        }
        
        console.log('❌ TokenManager: No token field found in localStorage data');
        console.log('❌ TokenManager: Available fields:', Object.keys(userData));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
      }
    } else {
      console.log('❌ TokenManager: No casinoUser in localStorage');
    }
    
    // Also check for direct token storage
    const directToken = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('jwt');
    if (directToken) {
      this.token = directToken;
      console.log('🔑 TokenManager: Found direct token in localStorage');
      return directToken;
    }

    // Check Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      this.token = session.access_token;
      console.log('🔑 TokenManager: Found token in Supabase session');
      return session.access_token;
    }

    console.log('❌ TokenManager: No token found anywhere');
    return undefined;
  }

  setToken(token: string) {
    this.token = token;
    console.log('🔑 TokenManager: Token set:', token ? 'YES' : 'NO');
    
    // Don't modify localStorage here - let DatabaseWrapper handle it
    // This prevents conflicts and ensures consistent data structure
    console.log('🔑 TokenManager: Token cached in memory');
  }

  clearToken() {
    this.token = undefined;
    console.log('🗑️ TokenManager: Token cleared');
    
    // Clear from localStorage
    const savedUser = localStorage.getItem('casinoUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        delete user.token;
        localStorage.setItem('casinoUser', JSON.stringify(user));
      } catch (error) {
        console.warn('TokenManager: Failed to clear token from localStorage');
      }
    }
  }

  isTokenValid(): boolean {
    return this.token !== undefined && this.token !== null;
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();
