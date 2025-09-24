// API Client for connecting frontend to backend server
import { tokenManager } from '../auth/tokenManager';

// Use direct backend URL in development, environment variable in production
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001/api'  // Direct URL for development
  : (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');

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
    // Load token from localStorage on initialization
    try {
      const savedUser = localStorage.getItem('casinoUser');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        if (userData.token) {
          this.token = userData.token;
          console.log('🔑 ApiClient: Token loaded from localStorage on init');
        }
      }
    } catch (error) {
      console.warn('⚠️ ApiClient: Failed to load token from localStorage:', error);
    }
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

  // Request interceptor - automatically adds token to all requests
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    customToken?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Prepare headers with interceptor logic
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Token interceptor: automatically get and attach token
    let token = customToken || this.token;
    
    // If no token in memory, try to get from localStorage
    if (!token) {
      try {
        const savedUser = localStorage.getItem('casinoUser');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          if (userData.token) {
            token = userData.token;
            this.token = token; // Cache in memory
            console.log('🔑 ApiClient Interceptor: Token retrieved from localStorage');
          }
        }
      } catch (error) {
        console.warn('⚠️ ApiClient Interceptor: Failed to parse localStorage user data');
      }
    }

    // If still no token, try TokenManager as fallback
    if (!token) {
      token = await tokenManager.getToken() || null;
      if (token) {
        this.token = token;
        console.log('🔑 ApiClient Interceptor: Token retrieved from TokenManager');
      }
    }

    // Skip auth for login endpoint
    if (endpoint === '/auth/login') {
      console.log('🔓 ApiClient: Skipping auth for login endpoint');
    } else if (!token) {
      console.error('❌ ApiClient Interceptor: No authentication token available');
      return {
        success: false,
        error: 'Authentication required - please login first'
      };
    } else {
      // Add Authorization header with token
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`🔑 ApiClient Interceptor: Added auth header for ${endpoint}`);
    }

    // Debug log for API requests
    console.log("📤 API Request:", {
      url,
      method: options.method || 'GET',
      headers,
      body: options.body,
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - token might be expired
        if (response.status === 401 && token) {
          console.warn('🔄 Token expired, clearing stored tokens...');
          this.token = null;
          localStorage.removeItem('casinoUser');
          tokenManager.clearToken();
          return {
            success: false,
            error: 'Session expired - please login again'
          };
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
    try {
      console.log('🔐 ApiClient: Making login request...');
      
      // Use the request method but it will skip auth for /auth/login
      const response = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      console.log('🔐 ApiClient: Login response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Login failed');
      }

      // Extract and store token after successful login
      let token = null;
      let user = null;
      
      // Handle nested response structure with proper type checking
      const responseData = response.data as any;
      if (responseData?.data?.token) {
        token = responseData.data.token;
        user = responseData.data.user || {};
      } else if (responseData?.token) {
        token = responseData.token;
        user = responseData.user || {};
      }

      if (token) {
        console.log('🔑 ApiClient: Storing token after successful login');
        
        // Store token in memory
        this.setToken(token);
        
        // Create complete user object with token
        const userWithToken = {
          ...user,
          token: token,
          id: user.id || 'admin-1',
          username: user.username || username,
          role: user.role || 'admin'
        };
        
        // Store in localStorage
        localStorage.setItem('casinoUser', JSON.stringify(userWithToken));
        console.log('🔑 ApiClient: Saved user with token to localStorage');
        
        // Store in TokenManager
        tokenManager.setToken(token);
        
        // Return response with complete user data
        return {
          success: true,
          data: {
            ...(responseData || {}),
            data: {
              token: token,
              user: userWithToken
            }
          }
        };
      }

      return response;
    } catch (error) {
      console.error('Login request failed:', error);
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

  // Customer passport file upload
  async uploadCustomerPassport(customerId: string, passportData: any): Promise<ApiResponse<any>> {
    return this.request(`/customers/${customerId}/passport`, {
      method: 'POST',
      body: JSON.stringify(passportData)
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
