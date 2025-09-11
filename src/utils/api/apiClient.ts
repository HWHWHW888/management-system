// API Client for connecting frontend to backend server
import { tokenManager } from '../auth/tokenManager';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.initializeToken();
  }

  private async initializeToken() {
    // Don't initialize token on construction - it causes async issues
    // Token will be retrieved when needed in request()
    console.log('🔧 ApiClient: Constructor completed, token will be loaded on first request');
  }

  setToken(token: string) {
    this.token = token;
    tokenManager.setToken(token);
    console.log('🔑 ApiClient: Token set explicitly:', token ? 'YES' : 'NO');
  }

  async refreshToken(): Promise<boolean> {
    console.log('🔄 ApiClient: Refreshing token...');
    const token = await tokenManager.getToken();
    if (token) {
      this.token = token;
      console.log('🔑 ApiClient: Token refreshed successfully');
      return true;
    }
    console.log('❌ ApiClient: Token refresh failed - no token available');
    return false;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    customToken?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Get token with priority: customToken > instance token > centralized token manager
    let token = customToken || this.token;
    
    if (!token) {
      console.log('🔍 ApiClient: No token in instance, checking TokenManager...');
      console.log('🔍 ApiClient: Current instance token:', this.token);
      token = await tokenManager.getToken() || null;
      if (token) {
        this.token = token;
        console.log('🔑 ApiClient: Got token from TokenManager and cached it');
      } else {
        console.log('❌ ApiClient: TokenManager returned no token');
      }
    } else {
      console.log('🔑 ApiClient: Using existing token (custom or instance)');
    }

    if (!token) {
      console.error('❌ ApiClient: No authentication token available from any source');
      console.log('🔍 Debug info:', {
        customToken: !!customToken,
        instanceToken: !!this.token,
        localStorage: !!localStorage.getItem('casinoUser')
      });
      return {
        success: false,
        error: 'Authentication required - please login first'
      };
    }

    headers['Authorization'] = `Bearer ${token}`;
    console.log(`🔑 Making request to ${endpoint} with token:`, token.substring(0, 20) + '...');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - token might be expired
        if (response.status === 401) {
          console.warn('🔄 Token expired, attempting refresh...');
          const refreshed = await this.refreshToken();
          if (refreshed && this.token !== token) {
            // Retry with new token
            headers['Authorization'] = `Bearer ${this.token}`;
            const retryResponse = await fetch(url, { ...options, headers });
            const retryData = await retryResponse.json();
            if (retryResponse.ok) {
              return retryData;
            }
          }
        }
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Auth endpoints - login doesn't need token
  async login(username: string, password: string) {
    const url = `${this.baseUrl}/auth/login`;
    
    try {
      console.log('🔐 ApiClient: Making login request to:', url);
      console.log('🔐 ApiClient: Login data:', { username, password: '***' });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('🔐 ApiClient: Response status:', response.status);
      const data = await response.json();
      console.log('🔐 ApiClient: Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Login request failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async register(userData: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Users endpoints
  async getUsers() {
    return this.request('/users');
  }

  async createUser(userData: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Customers endpoints
  async getCustomers(customToken?: string) {
    return this.request('/customers', {}, customToken);
  }

  async createCustomer(customerData: any, customToken?: string) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }, customToken);
  }

  async updateCustomer(id: string, customerData: any, customToken?: string) {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    }, customToken);
  }

  async deleteCustomer(id: string, customToken?: string) {
    return this.request(`/customers/${id}`, {
      method: 'DELETE',
    }, customToken);
  }

  // Agents endpoints
  async getAgents(customToken?: string) {
    return this.request('/agents', {}, customToken);
  }

  async createAgent(agentData: any, customToken?: string) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    }, customToken);
  }

  async updateAgent(id: string, agentData: any, customToken?: string) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    }, customToken);
  }

  async deleteAgent(id: string, customToken?: string) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    }, customToken);
  }

  // Trips endpoints
  async getTrips() {
    return this.request('/trips');
  }

  async getTripsWithSharing() {
    console.log('🔄 ApiClient: Fetching trips with sharing data...');
    const response = await this.request('/trips');
    console.log('📊 ApiClient: Trips with sharing data loaded:', Array.isArray(response.data) ? response.data.length : 0);
    return response;
  }

  async createTrip(tripData: any) {
    return this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
  }

  async updateTrip(id: string, tripData: any) {
    return this.request(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tripData),
    });
  }

  async deleteTrip(id: string) {
    return this.request(`/trips/${id}`, {
      method: 'DELETE',
    });
  }

  // Transactions endpoints
  async getTransactions() {
    return this.request('/transactions');
  }

  async createTransaction(transactionData: any) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async updateTransaction(id: string, transactionData: any) {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transactionData),
    });
  }

  async deleteTransaction(id: string) {
    return this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Reports endpoints
  async getReports() {
    return this.request('/reports');
  }

  async getDashboardStats() {
    return this.request('/reports/dashboard');
  }

  async getCustomerReport(customerId: string) {
    return this.request(`/reports/customer/${customerId}`);
  }

  async getAgentReport(agentId: string) {
    return this.request(`/reports/agent/${agentId}`);
  }

  async getTripReport(tripId: string) {
    return this.request(`/reports/trip/${tripId}`);
  }

  // Customer Details endpoints
  async getCustomerDetails(customerId: string) {
    return this.request(`/customers/${customerId}/details`);
  }

  async createCustomerDetails(customerId: string, detailsData: any) {
    return this.request(`/customers/${customerId}/details`, {
      method: 'POST',
      body: JSON.stringify(detailsData),
    });
  }


  
  async updateCustomerDetails(customerId: string, detailsData: any) {
    return this.request(`/customers/${customerId}/details`, {
      method: 'PUT',
      body: JSON.stringify(detailsData),
    });
  }

  async deleteCustomerDetails(customerId: string): Promise<ApiResponse<void>> {
    return this.request(`/customers/${customerId}/details`, {
      method: 'DELETE'
    });
  }

  // Customer file attachment methods
  async uploadCustomerAttachments(customerId: string, attachments: any[]): Promise<ApiResponse<any>> {
    return this.request(`/customers/${customerId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ attachments })
    });
  }

  async getCustomerAttachments(customerId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/customers/${customerId}/attachments`);
  }

  async deleteCustomerAttachment(customerId: string, attachmentId: string): Promise<ApiResponse<any>> {
    return this.request(`/customers/${customerId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
  }

  // Staff endpoints
  async getStaffs(): Promise<ApiResponse<any[]>> {
    return this.request('/staffs');
  }

  async getStaff(id: string): Promise<ApiResponse<any>> {
    return this.request(`/staffs/${id}`);
  }

  async createStaff(staffData: any): Promise<ApiResponse<any>> {
    return this.request('/staffs', {
      method: 'POST',
      body: JSON.stringify(staffData)
    });
  }

  async updateStaff(id: string, staffData: any): Promise<ApiResponse<any>> {
    return this.request(`/staffs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData)
    });
  }

  async deleteStaff(id: string): Promise<ApiResponse<any>> {
    return this.request(`/staffs/${id}`, {
      method: 'DELETE'
    });
  }

  async staffCheckIn(id: string, checkInData: any): Promise<ApiResponse<any>> {
    return this.request(`/staffs/${id}/check-in`, {
      method: 'POST',
      body: JSON.stringify(checkInData)
    });
  }

  async staffCheckOut(id: string, checkOutData: any): Promise<ApiResponse<any>> {
    return this.request(`/staffs/${id}/check-out`, {
      method: 'POST',
      body: JSON.stringify(checkOutData)
    });
  }

  async getStaffShifts(id: string, params?: any): Promise<ApiResponse<any[]>> {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/staffs/${id}/shifts${queryString ? `?${queryString}` : ''}`);
  }

  async getStaffRollingRecords(id: string, params?: any): Promise<ApiResponse<any[]>> {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/staffs/${id}/rolling-records${queryString ? `?${queryString}` : ''}`);
  }

  // Generic HTTP methods for flexible API calls
  async get<T = any>(endpoint: string, customToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, customToken);
  }

  async post<T = any>(endpoint: string, data?: any, customToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, customToken);
  }

  async put<T = any>(endpoint: string, data?: any, customToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, customToken);
  }

  async delete<T = any>(endpoint: string, customToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, customToken);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
