import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DatabaseWrapper } from '../utils/api/databaseWrapper';
import { tokenManager } from '../utils/auth/tokenManager';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { User, Trip, TripCustomer, TripAgent, TripExpense, Customer, Agent } from '../types';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';
import { apiClient } from '../utils/api/apiClient';
import { 
  MapPin, RefreshCw, Activity, AlertTriangle, Info, Zap, Clock,
  Users, DollarSign, Settings, Plus, Edit, Trash2, Eye,
  Calculator, BarChart, UserCheck, X, CheckCircle, Save, Pencil, Share2
} from 'lucide-react';


const REAL_TIME_REFRESH_INTERVAL = 30000;

function ProjectManagementComponent() {
  // Mock user for now since AuthContext is not available
  const user = { role: 'admin', agentId: null, username: 'admin' };
  const clearError = () => {};
  const showError = (message: string) => console.error(message);
  
  // Utility function for safe number conversion
  const safeNumber = (value: any): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };
  // Data states
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState('trips');
  const [selectedTripTab, setSelectedTripTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Trip expenses and sharing states
  const [tripExpenses, setTripExpenses] = useState<any[]>([]);
  const [tripSharing, setTripSharing] = useState<any>(null);
  const [agentProfits, setAgentProfits] = useState<any[]>([]);
  
  // Form states
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [showDeleteAgent, setShowDeleteAgent] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  
  // Form data states
  const [newTrip, setNewTrip] = useState({
    name: '',
    description: '',
    date: '',
    endDate: '',
    venue: '',
    status: 'planned' as 'planned' | 'ongoing' | 'completed'
  });
  
  const [newCustomerData, setNewCustomerData] = useState({ name: '' });
  const [newExpenseData, setNewExpenseData] = useState({ description: '', amount: 0, category: '' });
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'flight' as const
  });
  const [newAgentShare, setNewAgentShare] = useState(25);
  const [editAgentShare, setEditAgentShare] = useState(25);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [deletingAgent, setDeletingAgent] = useState<any>(null);

  // Helper functions
  const safeFormatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString();
  };

  // Permissions
  const isAdmin = user.role === 'admin';
  const isAgent = user.role === 'agent';

  // API functions for trip expenses and sharing
  const loadTripExpenses = async (tripId: string) => {
    try {
      setExpensesLoading(true);
      const response = await apiClient.get(`/trips/${tripId}/expenses`);
      if (response.success) {
        setTripExpenses(response.data.expenses || []);
      }
    } catch (error) {
      console.error('Error loading trip expenses:', error);
      showError('Failed to load trip expenses');
    } finally {
      setExpensesLoading(false);
    }
  };

  const loadTripSharing = async (tripId: string) => {
    try {
      setSharingLoading(true);
      const response = await apiClient.get(`/trips/${tripId}/sharing`);
      if (response.success) {
        setTripSharing(response.data);
      }
    } catch (error) {
      console.error('Error loading trip sharing:', error);
      showError('Failed to load trip sharing');
    } finally {
      setSharingLoading(false);
    }
  };

  const loadAgentProfits = async (tripId: string) => {
    try {
      console.log('🔍 Loading agent profits for trip:', tripId);
      const response = await apiClient.get(`/trips/${tripId}/agents/profits`);
      console.log('📊 Agent profits API response:', response);
      if (response.success) {
        console.log('✅ Agent profits data:', response.data);
        console.log('✅ Setting agentProfits state to:', response.data);
        setAgentProfits(response.data || []);
        console.log('✅ AgentProfits state updated');
      } else {
        console.log('❌ Agent profits API failed:', response);
        setAgentProfits([]);
      }
    } catch (error) {
      console.error('Error loading agent profits:', error);
      showError('Failed to load agent profits');
      setAgentProfits([]);
    }
  };

  const updateCommissionRate = async (agentId: string, customerId: string, commissionRate: number) => {
    try {
      if (!selectedTrip) return;
      
      setSaving(true);
      const response = await apiClient.put(`/trips/${selectedTrip.id}/agents/${agentId}/commission`, {
        customer_id: customerId,
        commission_rate: commissionRate
      });
      
      if (response.success) {
        // Reload agent profits to reflect the change
        await loadAgentProfits(selectedTrip.id);
        console.log('Commission rate updated successfully');
      } else {
        showError('Failed to update commission rate');
      }
    } catch (error) {
      console.error('Error updating commission rate:', error);
      showError('Failed to update commission rate');
    } finally {
      setSaving(false);
    }
  };

  const addTripExpense = async (tripId: string, expenseData: any) => {
    try {
      setSaving(true);
      const response = await apiClient.post(`/trips/${tripId}/expenses`, expenseData);
      if (response.success) {
        await loadTripExpenses(tripId);
        await loadTripSharing(tripId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding trip expense:', error);
      showError('Failed to add trip expense');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateTripSharing = async (tripId: string, sharingData: any) => {
    try {
      setSaving(true);
      const response = await apiClient.put(`/trips/${tripId}/sharing`, sharingData);
      if (response.success) {
        await loadTripSharing(tripId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating trip sharing:', error);
      showError('Failed to update trip sharing');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Enhanced data loading with better error handling
  const loadAllRealTimeData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      clearError();
      
      console.log('🔄 Loading project data from API...');
      
      // First ensure we have authentication
      const token = await tokenManager.getToken();
      if (!token) {
        console.log('❌ No authentication token available, attempting auto-login...');
        
        // Try to auto-login with admin credentials
        try {
          const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: 'admin',
              password: 'admin123'
            })
          });
          
          const loginData = await loginResponse.json();
          
          if (loginData.success && loginData.data?.token) {
            console.log('✅ Auto-login successful');
            tokenManager.setToken(loginData.data.token);
            
            // Store user data in localStorage for consistency
            const userData = {
              ...loginData.data.user,
              token: loginData.data.token
            };
            localStorage.setItem('casinoUser', JSON.stringify(userData));
          } else {
            console.log('❌ Auto-login failed:', loginData);
            setErrorMessage('Authentication required. Please login first.');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('❌ Auto-login error:', error);
          setErrorMessage('Authentication failed. Please check your connection.');
          setLoading(false);
          return;
        }
      }
      
      console.log('🔑 Token available, proceeding with API calls...');
      
      // Load all required data
      console.log('🔄 Starting API calls...');
      const [tripsData, customersData, agentsData] = await Promise.all([
        db.get('trips', []),
        db.get('customers', []),
        db.get('agents', [])
      ]);

      console.log('📊 Raw API responses:', {
        tripsData,
        customersData,
        agentsData
      });

      console.log('📊 Data loaded:', {
        trips: tripsData?.length || 0,
        customers: customersData?.length || 0,
        agents: agentsData?.length || 0
      });

      // Load trip statistics for each trip
      const transformedTrips = await Promise.all((tripsData || []).map(async (trip: any) => {
        let tripStats = null;
        let tripSharing = null;
        let tripCustomerStats = null;
        
        try {
          // Load trip statistics (use correct endpoint)
          console.log(`📊 Loading statistics for trip ${trip.id}...`);
          const statsResponse = await apiClient.get(`/trips/${trip.id}/statistics`);
          console.log(`📊 Statistics response for trip ${trip.id}:`, statsResponse);
          if (statsResponse.success) {
            tripStats = statsResponse.data;
          }
          
          // Load trip sharing data
          console.log(`💰 Loading sharing for trip ${trip.id}...`);
          const sharingResponse = await apiClient.get(`/trips/${trip.id}/sharing`);
          console.log(`💰 Sharing response for trip ${trip.id}:`, sharingResponse);
          if (sharingResponse.success) {
            tripSharing = sharingResponse.data;
          }
          
          // Load customer stats to get customer count
          console.log(`👥 Loading customer stats for trip ${trip.id}...`);
          const customerStatsResponse = await apiClient.get(`/trips/${trip.id}/customer-stats`);
          console.log(`👥 Customer stats response for trip ${trip.id}:`, customerStatsResponse);
          if (customerStatsResponse.success && customerStatsResponse.data) {
            tripCustomerStats = customerStatsResponse.data;
          }
        } catch (error) {
          console.warn(`Failed to load stats for trip ${trip.id}:`, error);
        }
        
        // Extract customer count from customer stats API response
        let customerCount = 0;
        if (tripCustomerStats && Array.isArray(tripCustomerStats)) {
          customerCount = tripCustomerStats.length;
        } else if (tripStats?.statistics && Array.isArray(tripStats.statistics)) {
          customerCount = tripStats.statistics.length;
        } else if (tripStats?.customer_count) {
          customerCount = tripStats.customer_count;
        } else if (tripStats?.total_customers) {
          customerCount = tripStats.total_customers;
        } else if (tripSharing?.customer_count) {
          customerCount = tripSharing.customer_count;
        }
        
        console.log(`👥 Customer count extraction for trip ${trip.id}:`, {
          'tripCustomerStats (array?)': Array.isArray(tripCustomerStats) ? `Array with ${tripCustomerStats.length} items` : 'not array or null',
          'tripCustomerStats': tripCustomerStats,
          'tripStats?.statistics (array?)': Array.isArray(tripStats?.statistics) ? tripStats.statistics : 'not array',
          'tripStats?.statistics?.length': tripStats?.statistics?.length,
          'tripStats?.customer_count': tripStats?.customer_count,
          'tripStats?.total_customers': tripStats?.total_customers,
          'tripSharing?.customer_count': tripSharing?.customer_count,
          'final customerCount': customerCount
        });
        
        // Try different possible data paths based on API response structure
        const statsRoot = tripStats?.statistics || tripStats;
        
        const finalTripData = {
          totalRolling: statsRoot?.total_rolling || tripStats?.total_rolling || 0,
          totalWinLoss: statsRoot?.net_profit || tripStats?.net_profit || 0,
          totalBuyIn: statsRoot?.total_buy_in || tripStats?.total_buy_in || 0,
          totalBuyOut: statsRoot?.total_cash_out || tripStats?.total_cash_out || 0,
          customerCount: customerCount,
        };
        
        console.log(`🔧 Data extraction debug for trip ${trip.id}:`, {
          'tripStats structure': tripStats,
          'statsRoot': statsRoot,
          'tripStats keys': tripStats ? Object.keys(tripStats) : 'no tripStats',
          'statsRoot keys': statsRoot ? Object.keys(statsRoot) : 'no statsRoot'
        });
        
        console.log(`👥 Customer count debug for trip ${trip.id}:`, {
          'tripStats?.statistics?.length': tripStats?.statistics?.length,
          'tripStats?.customer_count': tripStats?.customer_count,
          'tripStats?.total_customers': tripStats?.total_customers,
          'finalCustomerCount': customerCount,
          'tripStatsKeys': tripStats ? Object.keys(tripStats) : 'no tripStats'
        });
        
        console.log(`🔍 Final data for trip ${trip.id}:`, {
          tripStats,
          tripSharing,
          finalTripData,
          'Will set totalBuyIn to': finalTripData.totalBuyIn,
          'Will set activeCustomersCount to': finalTripData.customerCount
        });

        return {
          id: trip.id,
          name: trip.trip_name || trip.name || 'Unnamed Trip',
          description: trip.description || '',
          date: trip.start_date || trip.date,
          startDate: trip.start_date || trip.date,
          endDate: trip.end_date || trip.endDate,
          status: trip.status || 'planned',
          budget: trip.total_budget || 0,
          createdAt: trip.created_at || new Date().toISOString(),
          customers: [],
          agents: [],
          expenses: [],
          totalRolling: finalTripData.totalRolling,
          totalWinLoss: finalTripData.totalWinLoss,
          totalBuyIn: finalTripData.totalBuyIn,
          totalBuyOut: finalTripData.totalBuyOut,
          calculatedTotalRolling: finalTripData.totalRolling,
          sharing: {
            totalWinLoss: tripSharing?.total_win_loss || 0,
            totalExpenses: tripSharing?.total_expenses || 0,
            totalRollingCommission: tripSharing?.total_rolling_commission || 0,
            totalBuyIn: tripSharing?.total_buy_in || 0,
            totalBuyOut: tripSharing?.total_buy_out || 0,
            netResult: tripSharing?.net_result || 0,
            netCashFlow: tripSharing?.net_cash_flow || 0,
            totalAgentShare: tripSharing?.total_agent_share || 0,
            companyShare: tripSharing?.company_share || 0,
            agentSharePercentage: tripSharing?.agent_share_percentage || 0,
            companySharePercentage: tripSharing?.company_share_percentage || 100,
            agentShares: [],
            agentBreakdown: tripSharing?.agent_breakdown || []
          },
          attachments: [],
          lastDataUpdate: new Date().toISOString(),
          activeCustomersCount: finalTripData.customerCount,
          recentActivityCount: 0,
          totalExpenses: tripSharing?.total_expenses || 0
        } as unknown as Trip;
      }));

      console.log('🔄 Transformed trips with financial data:', transformedTrips);

      // Set data
      setTrips(transformedTrips);
      setCustomers(customersData || []);
      setAgents(agentsData || []);
      setLastSyncTime(new Date());
      setDataLoaded(true);
      
      // Update selected trip if it exists
      if (selectedTrip) {
        const updatedSelectedTrip = transformedTrips.find(t => t.id === selectedTrip.id);
        if (updatedSelectedTrip) {
          setSelectedTrip(updatedSelectedTrip);
        }
      }
      
      console.log(`✅ Project data loaded successfully: ${transformedTrips.length} trips`);
      
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setErrorMessage(`Failed to load project data: ${error}`);
      showError('Failed to load project data');
    } finally {
      setLoading(false);
      console.log('🏁 Loading completed, setting loading to false');
    }
  }, []);

  // Initial data load only
  useEffect(() => {
    loadAllRealTimeData();
  }, []);

  // Separate effect for real-time updates
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    if (isRealTimeEnabled) {
      refreshInterval = setInterval(() => {
        console.log('🔄 Real-time refresh triggered');
        loadAllRealTimeData();
      }, REAL_TIME_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [isRealTimeEnabled, loadAllRealTimeData]);

  // Load agent profits when switching to agents tab
  useEffect(() => {
    if (selectedTrip && selectedTripTab === 'agents') {
      console.log('🎯 Loading agent profits for selected trip:', {
        tripId: selectedTrip.id,
        tripName: selectedTrip.name,
        customers: selectedTrip.customers,
        agents: selectedTrip.agents
      });
      loadAgentProfits(selectedTrip.id);
    }
  }, [selectedTrip, selectedTripTab]);

  // Get filtered trips based on user role
  const getFilteredTrips = () => {
    if (user.role === 'agent' && user.agentId) {
      return trips.filter(trip => 
        trip.agents?.some(agent => agent.agentId === user.agentId) || 
        trip.agentId === user.agentId
      );
    }
    return trips;
  };

  // Save trips to database
  const saveTrips = async (updatedTrips: Trip[]) => {
    try {
      setSaving(true);
      await db.save('trips', updatedTrips);
      setTrips(updatedTrips);
      setLastSyncTime(new Date());
      console.log('✅ Trips saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving trips:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save trips: ${errorMessage}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Create new trip
  const handleCreateTrip = async () => {
    if (!newTrip.name.trim() || !newTrip.date) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const trip: Trip = {
        id: Date.now().toString(),
        name: newTrip.name,
        description: newTrip.description || '',
        date: newTrip.date,
        status: newTrip.status,
        agents: user.role === 'agent' && user.agentId ? [{
          agentId: user.agentId,
          agentName: user.username || 'admin',
          sharePercentage: 100,
          calculatedShare: 0
        }] : [],
        customers: [],
        expenses: [],
        totalRolling: 0,
        totalWinLoss: 0,
        totalBuyIn: 0,
        totalBuyOut: 0,
        calculatedTotalRolling: 0,
        sharing: {
          totalWinLoss: 0,
          totalExpenses: 0,
          totalRollingCommission: 0,
          totalBuyIn: 0,
          totalBuyOut: 0,
          netCashFlow: 0,
          netResult: 0,
          totalAgentShare: 0,
          companyShare: 0,
          agentSharePercentage: 0,
          companySharePercentage: 100,
          agentBreakdown: []
        },
        createdAt: new Date().toISOString(),
        attachments: [],
        lastDataUpdate: new Date().toISOString(),
        activeCustomersCount: 0,
        recentActivityCount: 0,
        totalExpenses: 0
      };

      const updatedTrips = [...trips, trip];
      await saveTrips(updatedTrips);
      
      setShowCreateTrip(false);
      setNewTrip({
        name: '',
        description: '',
        date: '',
        endDate: '',
        venue: '',
        status: 'planned'
      });
      
      console.log('✅ Trip created successfully:', trip.name);
      
    } catch (error) {
      console.error('❌ Error creating trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to create trip: ${errorMessage}`);
    }
  };

  // Select trip for detailed view with comprehensive backend data
  const selectTrip = async (trip: Trip) => {
    console.log('🎯 Selecting trip for details:', trip.name);
    
    try {
      setLoading(true);
      
      // Load comprehensive trip data from backend API
      const [customersResponse, expensesResponse, sharingResponse, statisticsResponse, transactionsResponse, agentsResponse] = await Promise.all([
        apiClient.get(`/trips/${trip.id}/customer-stats`),
        apiClient.get(`/trips/${trip.id}/expenses`),
        apiClient.get(`/trips/${trip.id}/sharing`),
        apiClient.get(`/trips/${trip.id}/statistics`),
        apiClient.get(`/trips/${trip.id}/transactions`),
        apiClient.get(`/trips/${trip.id}/agents`)
      ]);
      
      console.log('📊 Backend API responses:', {
        customers: customersResponse,
        expenses: expensesResponse,
        sharing: sharingResponse,
        statistics: statisticsResponse,
        transactions: transactionsResponse,
        agents: agentsResponse
      });
      
      // Create enriched trip object with actual backend data
      const enrichedTrip = {
        ...trip,
        customers: customersResponse.success ? customersResponse.data : [],
        expenses: expensesResponse.success ? (expensesResponse.data?.expenses || []) : [],
        agents: agentsResponse.success ? agentsResponse.data : [],
        sharing: sharingResponse.success ? sharingResponse.data : trip.sharing,
        statistics: statisticsResponse.success ? statisticsResponse.data : null,
        transactions: transactionsResponse.success ? transactionsResponse.data : [],
        activeCustomersCount: customersResponse.success ? customersResponse.data?.length || 0 : trip.activeCustomersCount || 0,
        backendData: {
          totalBuyIn: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_buy_in || 0 : 0,
          totalCashOut: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_cash_out || 0 : 0,
          totalWin: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_win || 0 : 0,
          totalLoss: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_loss || 0 : 0,
          netProfit: statisticsResponse.success ? statisticsResponse.data?.statistics?.net_profit || 0 : 0,
          profitMargin: statisticsResponse.success ? statisticsResponse.data?.statistics?.profit_margin || 0 : 0,
          customerStatsLoaded: customersResponse.success,
          expensesLoaded: expensesResponse.success,
          agentsLoaded: agentsResponse.success,
          sharingLoaded: sharingResponse.success,
          statisticsLoaded: statisticsResponse.success,
          transactionsLoaded: transactionsResponse.success
        }
      };
      
      // Calculate financial totals from actual backend data
      if (enrichedTrip.customers && enrichedTrip.customers.length > 0) {
        enrichedTrip.totalBuyIn = enrichedTrip.customers.reduce((sum: number, c: any) => sum + safeNumber(c.total_buy_in), 0);
        enrichedTrip.totalBuyOut = enrichedTrip.customers.reduce((sum: number, c: any) => sum + safeNumber(c.total_cash_out), 0);
        enrichedTrip.totalRolling = enrichedTrip.customers.reduce((sum: number, c: any) => sum + safeNumber(c.rolling_amount), 0);
        enrichedTrip.totalWinLoss = enrichedTrip.customers.reduce((sum: number, c: any) => sum + safeNumber(c.net_result), 0);
      }
      
      if (enrichedTrip.expenses && enrichedTrip.expenses.length > 0) {
        enrichedTrip.totalExpenses = enrichedTrip.expenses.reduce((sum: number, e: any) => sum + safeNumber(e.amount), 0);
      }
      
      console.log('📊 Enriched trip with backend data:', enrichedTrip);
      
      // Update state variables for tabs to display backend data
      setTripExpenses(enrichedTrip.expenses || []);
      setTripSharing(enrichedTrip.sharing || null);
      
      // Load agent profits for the selected trip
      await loadAgentProfits(trip.id);
      
      // Backend data status is already included in the initial backendData object
      
      setSelectedTrip(enrichedTrip);
      setActiveTab('trip-details');
      setSelectedTripTab('overview');
      
    } catch (error) {
      console.error('❌ Error loading trip details:', error);
      setSelectedTrip(trip); // Fallback to original trip data
      setActiveTab('trip-details');
      setSelectedTripTab('overview');
    } finally {
      setLoading(false);
    }
  };

  // Add customer to trip
  const handleAddCustomerToTrip = async (customerId: string) => {
    if (!selectedTrip) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    if (selectedTrip.customers.some(tc => tc.customerId === customerId || (tc as any).customer_id === customerId)) {
      showError('Customer is already added to this trip');
      return;
    }

    setSaving(true);
    try {
      // Make API call to add customer to trip
      const response = await apiClient.post(`/trips/${selectedTrip.id}/customers`, {
        customer_id: customerId
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to add customer to trip');
      }

      console.log('✅ Customer added to trip via API:', customer.name);
      
      // Refresh trip data to get updated customer list
      await selectTrip(selectedTrip);
      setShowAddCustomer(false);
      
    } catch (error) {
      console.error('❌ Error adding customer to trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to add customer to trip: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Remove customer from trip
  const handleRemoveCustomerFromTrip = async (customerId: string) => {
    if (!selectedTrip) return;

    console.log('🔄 Starting delete customer process:', { customerId, tripId: selectedTrip.id });

    setSaving(true);
    try {
      // Make API call to remove customer from trip
      console.log('📡 Making API call to delete customer...');
      const response = await apiClient.delete(`/trips/${selectedTrip.id}/customers/${customerId}`);

      console.log('📨 API Response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Failed to remove customer from trip');
      }

      console.log('✅ Customer removed from trip via API successfully');
      
      // Refresh trip data to get updated customer list
      console.log('🔄 Refreshing trip data...');
      await selectTrip(selectedTrip);
      console.log('✅ Trip data refreshed after customer removal');
      
    } catch (error) {
      console.error('❌ Error removing customer from trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to remove customer from trip: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Add agent to trip
  const handleAddAgentToTrip = async (agentId: string) => {
    if (!selectedTrip) return;

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    if (selectedTrip.agents.some(ta => ta.agentId === agentId || (ta as any).agent_id === agentId)) {
      showError('Agent is already added to this trip');
      return;
    }

    setSaving(true);
    try {
      // Make API call to add agent to trip
      const response = await apiClient.post(`/trips/${selectedTrip.id}/agents`, {
        agent_id: agentId
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to add agent to trip');
      }

      console.log('✅ Agent added to trip via API:', agent.name);
      
      // Refresh trip data to get updated agent list
      await selectTrip(selectedTrip);
      setShowAddAgent(false);
      setNewAgentShare(25);
      
    } catch (error) {
      console.error('❌ Error adding agent to trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to add agent to trip: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Edit agent share
  const handleEditAgentShare = async () => {
    if (!selectedTrip || !editingAgent) return;

    if (editAgentShare <= 0 || editAgentShare > 100) {
      showError('Please enter a valid share percentage between 1 and 100');
      return;
    }

    try {
      const updatedTrip = {
        ...selectedTrip,
        agents: (selectedTrip.agents || []).map(agent => 
          agent.agentId === editingAgent.agentId 
            ? { ...agent, sharePercentage: editAgentShare }
            : agent
        ),
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = (trips || []).map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowEditAgent(false);
      setEditingAgent(null);
      setEditAgentShare(25);
      
      console.log('✅ Agent share updated:', editingAgent.agentName);
    } catch (error) {
      console.error('❌ Error updating agent share:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to update agent share: ${errorMessage}`);
    }
  };

  // Delete agent from trip
  const handleDeleteAgentFromTrip = async () => {
    if (!selectedTrip || !deletingAgent) return;

    setSaving(true);
    try {
      // Make API call to remove agent from trip
      const agentIdToRemove = deletingAgent.agentId || deletingAgent.agent_id;
      console.log('🗑️ Attempting to delete agent:', {
        tripId: selectedTrip.id,
        agentIdToRemove,
        deletingAgent,
        url: `/trips/${selectedTrip.id}/agents/${agentIdToRemove}`
      });
      
      const response = await apiClient.delete(`/trips/${selectedTrip.id}/agents/${agentIdToRemove}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to remove agent from trip');
      }

      console.log('✅ Agent removed from trip via API:', deletingAgent.agentName);
      
      // Refresh trip data to get updated agent list
      await selectTrip(selectedTrip);
      setShowDeleteAgent(false);
      setDeletingAgent(null);
      
    } catch (error) {
      console.error('❌ Error removing agent from trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to remove agent from trip: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Open edit agent dialog
  const openEditAgentDialog = (agent: TripAgent) => {
    setEditingAgent(agent);
    setEditAgentShare(agent.sharePercentage || 0);
    setShowEditAgent(true);
  };

  // Open delete agent dialog
  const openDeleteAgentDialog = (agent: TripAgent) => {
    setDeletingAgent(agent);
    setShowDeleteAgent(true);
  };

  // Add expense to trip using API
  const handleAddExpense = async () => {
    if (!selectedTrip || !newExpense.description.trim() || newExpense.amount <= 0) {
      showError('Please fill in all expense fields');
      return;
    }

    const expenseData = {
      expense_type: newExpense.category,
      amount: newExpense.amount,
      description: newExpense.description
    };

    const success = await addTripExpense(selectedTrip.id, expenseData);
    if (success) {
      setShowAddExpense(false);
      setNewExpense({
        description: '',
        amount: 0,
        category: 'flight'
      });
      console.log('✅ Expense added to trip via API');
    }
  };


  const filteredTrips = getFilteredTrips();
  
  // Debug logging
  useEffect(() => {
    const debugInfo = async () => {
      const hasToken = await tokenManager.getToken();
      console.log('📊 Debug info:', {
        trips: trips?.length,
        filteredTrips: filteredTrips?.length,
        dataLoaded,
        loading,
        userRole: user.role,
        agentId: user.agentId,
        hasToken: hasToken ? 'YES' : 'NO'
      });
    };
    debugInfo();
  }, [trips, filteredTrips, dataLoaded, loading, user.role, user.agentId]);

  // Loading state
  if (loading && !dataLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Project Data</h3>
          <p className="text-sm text-gray-600">Connecting to Supabase and loading trips, customers, and agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                🎯 Project Management - Agent Share CRUD Added
              </p>
              <p className="text-xs text-blue-600">
                Full CRUD functionality for agent shares now available in trip details
                {lastSyncTime && ` • Last sync: ${lastSyncTime.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {saving && (
              <div className="flex items-center text-blue-600">
                <Activity className="w-4 h-4 mr-1 animate-pulse" />
                <span className="text-xs">Saving...</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadAllRealTimeData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              className="text-xs"
            >
              <Zap className={`w-3 h-3 mr-1 ${isRealTimeEnabled ? 'text-green-500' : 'text-gray-500'}`} />
              {isRealTimeEnabled ? 'Live' : 'Manual'}
            </Button>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              <CheckCircle className="w-2 h-2 mr-1" />
              CRUD Ready
            </Badge>
          </div>
        </div>
      </div>

      {/* Data Loading Status */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Trips Loaded</p>
                <p className="text-2xl font-bold text-blue-600">{trips?.length || 0}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Customers Available</p>
                <p className="text-2xl font-bold text-green-600">{customers?.length || 0}</p>
              </div>
              <Users className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agents Available</p>
                <p className="text-2xl font-bold text-purple-600">{agents?.length || 0}</p>
              </div>
              <UserCheck className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {errorMessage}
            <Button
              onClick={loadAllRealTimeData}
              size="sm"
              variant="outline"
              className="ml-3 text-red-800 border-red-300 hover:bg-red-100"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            All Trips
          </TabsTrigger>
          <TabsTrigger value="trip-details" disabled={!selectedTrip} className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Trip Details {selectedTrip && `- ${selectedTrip.name}`}
          </TabsTrigger>
        </TabsList>

        {/* All Trips Tab */}
        <TabsContent value="trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Project Management</h2>
              <p className="text-gray-600">
                Manage trips and project data with full CRUD functionality
                {user.role === 'agent' && ' (Your trips only)'}
              </p>
            </div>
            {(isAdmin || isAgent) && (
              <Dialog open={showCreateTrip} onOpenChange={setShowCreateTrip}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Trip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Trip</DialogTitle>
                    <DialogDescription>
                      Create a new trip that will be saved to Supabase database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tripName">Trip Name *</Label>
                      <Input
                        id="tripName"
                        value={newTrip.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, name: e.target.value})}
                        placeholder="Enter trip name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tripDescription">Description</Label>
                      <Textarea
                        id="tripDescription"
                        value={newTrip.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTrip({...newTrip, description: e.target.value})}
                        placeholder="Trip description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newTrip.date}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={newTrip.endDate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, endDate: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="venue">Venue</Label>
                      <Input
                        id="venue"
                        value={newTrip.venue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, venue: e.target.value})}
                        placeholder="Casino venue"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={newTrip.status} 
                        onValueChange={(value) => 
                          setNewTrip({...newTrip, status: value as 'planned' | 'ongoing' | 'completed'})
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateTrip(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTrip} disabled={saving}>
                        {saving ? 'Creating...' : 'Create Trip'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Trips List */}
          {loading ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading trips...</p>
              </CardContent>
            </Card>
          ) : (filteredTrips?.length || 0) === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {!dataLoaded ? 'Loading trips...' : 'No trips found'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {!dataLoaded 
                    ? 'Please wait while we load your trip data from Supabase.'
                    : 'Create your first trip to start managing projects and customer rolling amounts.'
                  }
                </p>
                {dataLoaded && (isAdmin || isAgent) && (
                  <Button onClick={() => setShowCreateTrip(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Trip
                  </Button>
                )}
                {!dataLoaded && (
                  <Button onClick={loadAllRealTimeData} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Loading
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(() => {
                console.log('🔍 Rendering trips:', filteredTrips?.length, filteredTrips);
                return null;
              })()}
              {(filteredTrips || []).map((trip) => {
                // Use loaded statistics data
                const totalBuyIn = trip.totalBuyIn || 0;
                const totalCashOut = trip.totalBuyOut || 0;
                const netProfit = trip.totalWinLoss || 0;
                const totalWinLoss = trip.totalWinLoss || 0;
                
                return (
                  <Card key={trip.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{trip.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {trip.description} • {trip.date}
                          </CardDescription>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            trip.status === 'completed' ? 'default' : 
                            trip.status === 'ongoing' ? 'secondary' : 'outline'
                          }>
                            {trip.status?.charAt(0).toUpperCase() + trip.status?.slice(1)}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => selectTrip(trip)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                      
                      {/* Trip Summary Metrics using Backend Data */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                        {(() => {
                          console.log(`🎯 UI Values for trip ${trip.id}:`, {
                            'trip.activeCustomersCount': trip.activeCustomersCount,
                            'trip.totalBuyIn': trip.totalBuyIn,
                            'trip.totalBuyOut': trip.totalBuyOut,
                            'trip.totalWinLoss': trip.totalWinLoss,
                            'totalBuyIn': totalBuyIn,
                            'totalCashOut': totalCashOut,
                            'totalWinLoss': totalWinLoss,
                            'netProfit': netProfit,
                            'trip.customers?.length': trip.customers?.length,
                            'trip object keys': Object.keys(trip)
                          });
                          return null;
                        })()}
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Customers</div>
                          <div className="font-medium">{trip.activeCustomersCount || trip.customers?.length || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Total Win</div>
                          <div className="font-medium text-green-600">HK${safeFormatNumber(totalBuyIn)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Total Loss</div>
                          <div className="font-medium text-red-600">HK${safeFormatNumber(totalCashOut)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Win/Loss</div>
                          <div className={`font-medium ${totalWinLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            HK${safeFormatNumber(totalWinLoss)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Net Profit</div>
                          <div className={`font-medium ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            HK${safeFormatNumber(netProfit)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Trip Details Tab */}
        <TabsContent value="trip-details" className="space-y-4">
          {selectedTrip ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrip.name}</h2>
                  <p className="text-gray-600">{selectedTrip.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <Badge variant={
                      selectedTrip.status === 'completed' ? 'default' : 
                      selectedTrip.status === 'ongoing' ? 'secondary' : 'outline'
                    }>
                      {selectedTrip.status?.charAt(0).toUpperCase() + selectedTrip.status?.slice(1)}
                    </Badge>
                    <span className="text-sm text-gray-500">{selectedTrip.date}</span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setActiveTab('trips')}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Back to Trips
                </Button>
              </div>

              {/* Trip Details Tabs */}
              <Tabs value={selectedTripTab} onValueChange={setSelectedTripTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" className="flex items-center gap-1">
                    <BarChart className="w-3 h-3" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Customers
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Agents
                  </TabsTrigger>
                  <TabsTrigger value="expenses" className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Expenses
                  </TabsTrigger>
                  <TabsTrigger value="sharing" className="flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    Financials
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="space-y-6">
                    {(() => {
                      // Use backend data directly - no local calculation needed
                      const backendData = (selectedTrip as any)?.backendData || {};
                      const totalExpenses = (selectedTrip?.expenses || []).reduce((sum: number, e: any) => sum + safeNumber(e.amount), 0);
                      return (
                        <>
                          {/* Enhanced Trip Metrics with Backend Data Integration */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Buy-in Total</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                  HK${safeFormatNumber((selectedTrip as any)?.backendData?.totalBuyIn || 0)}
                                </div>
                                <p className="text-xs text-gray-500">{selectedTrip?.activeCustomersCount || selectedTrip?.customers?.length || 0} customers</p>
                                <p className="text-xs text-blue-500">From transactions</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Cash-out Total</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-purple-600">
                                  HK${safeFormatNumber((selectedTrip as any)?.backendData?.totalCashOut || 0)}
                                </div>
                                <p className="text-xs text-gray-500">Customer withdrawals</p>
                                <p className="text-xs text-purple-500">From transactions</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Win/Loss</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className={`text-2xl font-bold ${
                                  ((selectedTrip as any)?.backendData?.totalWin - (selectedTrip as any)?.backendData?.totalLoss) >= 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  HK${safeFormatNumber(((selectedTrip as any)?.backendData?.totalWin || 0) - ((selectedTrip as any)?.backendData?.totalLoss || 0))}
                                </div>
                                <p className="text-xs text-gray-500">Customer perspective</p>
                                <p className="text-xs text-orange-500">From rolling records</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Net Profit</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className={`text-2xl font-bold ${
                                  ((selectedTrip as any)?.backendData?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  HK${safeFormatNumber((selectedTrip as any)?.backendData?.netProfit || 0)}
                                </div>
                                <p className="text-xs text-gray-500">House perspective</p>
                                <p className="text-xs text-green-500">After all expenses</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Quick Actions */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-3">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedTripTab('expenses')}
                                >
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Manage Expenses
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedTripTab('sharing')}
                                >
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Manage Sharing
                                </Button>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Backend Data Verification Panel */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Backend Data Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>Customer Stats:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.customerStatsLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.customerStatsLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Agents:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.agentsLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.agentsLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Expenses:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.expensesLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.expensesLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Sharing:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.sharingLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.sharingLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Statistics:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.statisticsLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.statisticsLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Transactions:</span>
                                  <span className={`font-medium ${(selectedTrip as any)?.backendData?.transactionsLoaded ? 'text-green-600' : 'text-red-600'}`}>
                                    {(selectedTrip as any)?.backendData?.transactionsLoaded ? '✓ Loaded' : '✗ Missing'}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Customers ({selectedTrip?.activeCustomersCount || selectedTrip?.customers?.length || 0})</h3>
                    <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Customer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Customer to Trip</DialogTitle>
                          <DialogDescription>
                            Select from available customers ({(customers || []).filter(c => !(selectedTrip?.customers || []).some(tc => tc.customerId === c.id)).length} total)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {(customers || [])
                            .filter(c => !(selectedTrip?.customers || []).some(tc => tc.customerId === c.id))
                            .map(customer => (
                              <div key={customer.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-sm text-gray-500">{customer.email}</div>
                                  <div className="text-xs text-gray-400">Agent: {customer.agentName}</div>
                                </div>
                                <Button size="sm" onClick={() => handleAddCustomerToTrip(customer.id)} disabled={saving}>
                                  {saving ? 'Adding...' : 'Add'}
                                </Button>
                              </div>
                            ))}
                          {(customers || []).filter(c => !(selectedTrip?.customers || []).some(tc => tc.customerId === c.id)).length === 0 && (
                            <p className="text-center text-gray-500 py-8">All customers are already added to this trip</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {(selectedTrip?.customers?.length || 0) === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No customers added to this trip</p>
                        <Button className="mt-4" onClick={() => setShowAddCustomer(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Customer
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(selectedTrip?.customers || []).map((tripCustomer: any) => (
                        <Card key={tripCustomer.customerId || tripCustomer.customer_id}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium">{tripCustomer.customerName || tripCustomer.customer?.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    VIP: {tripCustomer.customer?.vip_level || 'Standard'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                                  <div>
                                    <span className="text-sm text-gray-500">Buy-in:</span>
                                    <div className="font-medium text-blue-600">
                                      HK${safeFormatNumber(tripCustomer.total_buy_in || tripCustomer.buyInAmount || 0)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Cash-out:</span>
                                    <div className="font-medium text-purple-600">
                                      HK${safeFormatNumber(tripCustomer.total_cash_out || tripCustomer.buyOutAmount || 0)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Rolling:</span>
                                    <div className="font-medium text-orange-600">
                                      HK${safeFormatNumber(tripCustomer.rolling_amount || tripCustomer.rollingAmount || 0)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Win/Loss:</span>
                                    <div className={`font-medium ${
                                      (tripCustomer.total_win - tripCustomer.total_loss || tripCustomer.winLoss || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                      HK${safeFormatNumber((tripCustomer.total_win || 0) - (tripCustomer.total_loss || 0) || tripCustomer.winLoss || 0)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Net Result:</span>
                                    <div className={`font-medium ${
                                      (tripCustomer.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      HK${safeFormatNumber(tripCustomer.net_result || 0)}
                                    </div>
                                  </div>
                                </div>
                                {/* Commission Info */}
                                {tripCustomer.commission_earned && (
                                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                                    <span className="text-yellow-700">Commission Earned: HK${safeFormatNumber(tripCustomer.commission_earned)}</span>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveCustomerFromTrip(tripCustomer.customerId || tripCustomer.customer_id)}
                                disabled={saving}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Agent Profits Tab */}
                <TabsContent value="agents" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Agent Individual Profits</h3>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        if (selectedTrip) {
                          console.log('🔄 Manual refresh clicked for trip:', selectedTrip.id);
                          loadAgentProfits(selectedTrip.id);
                        }
                      }}
                      disabled={loading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  {false ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading agent profits...</p>
                      </CardContent>
                    </Card>
                  ) : !agentProfits || agentProfits.length === 0 ? (
                    <div className="space-y-4">
                      <Card>
                        <CardContent className="text-center py-8">
                          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No agents with customers in this trip</p>
                          <p className="text-xs text-gray-400 mt-2">Agents are automatically added when their customers join the trip</p>
                        </CardContent>
                      </Card>
                      
                      {/* Debug info */}
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="pt-4">
                          <h4 className="font-medium text-yellow-800 mb-2">Debug Information</h4>
                          <div className="text-sm text-yellow-700 space-y-1">
                            <div>Trip ID: {selectedTrip?.id}</div>
                            <div>Customers in trip: {selectedTrip?.customers?.length || 0}</div>
                            <div>Agents in trip: {selectedTrip?.agents?.length || 0}</div>
                            <div>Agent profits loaded: {agentProfits?.length || 0}</div>
                            <div>Agent profits state: {JSON.stringify(agentProfits)}</div>
                          </div>
                          {selectedTrip?.customers && selectedTrip.customers.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-yellow-800">Customers:</div>
                              {selectedTrip.customers.map((customer: any, index: number) => (
                                <div key={index} className="text-xs text-yellow-600">
                                  {customer.customerName || customer.customer?.name || 'Unknown'} (ID: {customer.customerId || customer.customer_id})
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {agentProfits.map((agentProfit: any) => (
                        <Card key={agentProfit.agent_id}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{agentProfit.agent_name}</CardTitle>
                                <CardDescription>{agentProfit.agent_email}</CardDescription>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                  HK${safeFormatNumber(agentProfit.total_agent_commission || agentProfit.total_commission || 0)}
                                </div>
                                <p className="text-sm text-gray-500">Total Commission</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-3 bg-blue-50 rounded">
                                  <div className="text-sm text-gray-600">Customer Net Result</div>
                                  <div className={`text-lg font-bold ${
                                    agentProfit.total_customer_net >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    HK${safeFormatNumber(agentProfit.total_customer_net)}
                                  </div>
                                </div>
                                <div className="p-3 bg-green-50 rounded">
                                  <div className="text-sm text-gray-600">Total Customers</div>
                                  <div className="text-lg font-bold text-gray-800">
                                    {agentProfit.customers.length}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-3">Customer Breakdown</h4>
                                <div className="space-y-3">
                                  {agentProfit.customers.map((customer: any) => (
                                    <div key={customer.customer_id} className="border rounded p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <div className="font-medium">{customer.customer_name}</div>
                                          <div className="text-sm text-gray-500">
                                            Buy-in: HK${safeFormatNumber(customer.buy_in)} | 
                                            Cash-out: HK${safeFormatNumber(customer.cash_out)}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className={`font-bold ${
                                            customer.net_result >= 0 ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            HK${safeFormatNumber(customer.net_result)}
                                          </div>
                                          <div className="text-sm text-gray-500">Net Result</div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex justify-between items-center pt-2 border-t">
                                        <div className="flex items-center space-x-4">
                                          <div className="text-sm">
                                            <span className="text-gray-500">Rolling:</span>
                                            <span className="font-medium ml-1">HK${safeFormatNumber(customer.rolling_amount)}</span>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm text-gray-500">Commission Rate:</span>
                                            <Input
                                              type="number"
                                              value={customer.commission_rate}
                                              onChange={(e) => {
                                                const newRate = parseFloat(e.target.value) || 0;
                                                console.log('🔄 Commission rate changed:', { agentId: agentProfit.agent_id, customerId: customer.customer_id, newRate });
                                                updateCommissionRate(agentProfit.agent_id, customer.customer_id, newRate);
                                              }}
                                              className="w-20 h-8 text-sm"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                            />
                                            <span className="text-sm text-gray-500">%</span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-blue-600">
                                            HK${safeFormatNumber(customer.agent_commission || customer.commission_earned || 0)}
                                          </div>
                                          <div className="text-xs text-gray-500">Commission</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Edit Agent Dialog */}
                  <Dialog open={showEditAgent} onOpenChange={setShowEditAgent}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Agent Share</DialogTitle>
                        <DialogDescription>
                          Update {editingAgent?.agentName}'s share percentage
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="editSharePercentage">Share Percentage *</Label>
                          <Input
                            id="editSharePercentage"
                            type="number"
                            value={editAgentShare}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditAgentShare(parseFloat(e.target.value) || 0)}
                            placeholder="Enter percentage (e.g., 25)"
                            min="0.1"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter a value between 0.1 and 100</p>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowEditAgent(false)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleEditAgentShare} disabled={saving}>
                            {saving ? 'Updating...' : 'Update Share'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Delete Agent Confirmation Dialog */}
                  <AlertDialog open={showDeleteAgent} onOpenChange={setShowDeleteAgent}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Agent from Trip</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove <strong>{deletingAgent?.agentName}</strong> from this trip? 
                          This will remove their {deletingAgent?.sharePercentage}% share allocation.
                          <br /><br />
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAgentFromTrip}
                          disabled={saving}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {saving ? 'Removing...' : 'Remove Agent'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Expenses ({tripExpenses?.length || 0})</h3>
                    <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Expense
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Expense</DialogTitle>
                          <DialogDescription>
                            Record a new expense for this trip
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="expenseDescription">Description</Label>
                            <Input
                              id="expenseDescription"
                              value={newExpense.description}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpense({...newExpense, description: e.target.value})}
                              placeholder="Expense description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="expenseAmount">Amount (HKD)</Label>
                            <Input
                              id="expenseAmount"
                              type="number"
                              value={newExpense.amount}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                              placeholder="0.00"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="expenseCategory">Category</Label>
                            <Select 
                              value={newExpense.category} 
                              onValueChange={(value: any) => setNewExpense({...newExpense, category: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="accommodation">Accommodation</SelectItem>
                                <SelectItem value="transportation">Transportation</SelectItem>
                                <SelectItem value="entertainment">Entertainment</SelectItem>
                                <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setShowAddExpense(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddExpense}>
                              Add Expense
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {expensesLoading ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading expenses...</p>
                      </CardContent>
                    </Card>
                  ) : (tripExpenses?.length || 0) === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No expenses recorded for this trip</p>
                        <Button className="mt-4" onClick={() => setShowAddExpense(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Expense
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {/* Expenses Summary */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Expenses Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-orange-600">
                            HK${safeFormatNumber((tripExpenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0))}
                          </div>
                          <p className="text-sm text-gray-500">{tripExpenses?.length || 0} expense items</p>
                        </CardContent>
                      </Card>
                      
                      {/* Expenses Table */}
                      <Card>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(tripExpenses || []).map(expense => (
                                <TableRow key={expense.id}>
                                  <TableCell className="font-medium">{expense.description}</TableCell>
                                  <TableCell className="capitalize">{expense.expense_type?.replace('_', ' ')}</TableCell>
                                  <TableCell>{expense.expense_date}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    HK${safeFormatNumber(expense.amount)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Trip Sharing Tab */}
                <TabsContent value="sharing" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Financial Overview & Profit Sharing</h3>
                    {tripSharing && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => selectedTrip && loadTripSharing(selectedTrip.id)}
                        disabled={sharingLoading}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                    )}
                  </div>

                  {sharingLoading ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading sharing data...</p>
                      </CardContent>
                    </Card>
                  ) : !tripSharing ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No sharing data available</p>
                        <p className="text-xs text-gray-400 mt-2">Sharing data will be calculated automatically when trip has transactions</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {/* Sharing Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Net Result</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${
                              tripSharing.net_result >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              HK${safeFormatNumber(tripSharing.net_result)}
                            </div>
                            <p className="text-xs text-gray-500">After all expenses and commissions</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Agent Share</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                              HK${safeFormatNumber(tripSharing.total_agent_share)}
                            </div>
                            <p className="text-xs text-gray-500">{tripSharing.agent_share_percentage}% of net result</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Company Share</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-purple-600">
                              HK${safeFormatNumber(tripSharing.company_share)}
                            </div>
                            <p className="text-xs text-gray-500">{tripSharing.company_share_percentage}% of net result</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Detailed Breakdown */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Financial Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                              <span className="font-medium">Total Buy-in</span>
                              <span className="text-blue-600 font-bold">HK${safeFormatNumber(tripSharing.total_buy_in)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span className="font-medium">Total Cash-out</span>
                              <span className="text-red-600 font-bold">HK${safeFormatNumber(tripSharing.total_buy_out)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span className="font-medium">Net Cash Flow</span>
                              <span className={`font-bold ${
                                tripSharing.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                HK${safeFormatNumber(tripSharing.net_cash_flow)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                              <span className="font-medium">Customer Win/Loss</span>
                              <span className={`font-bold ${
                                tripSharing.total_win_loss >= 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                HK${safeFormatNumber(tripSharing.total_win_loss)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                              <span className="font-medium">Rolling Commission</span>
                              <span className="text-purple-600 font-bold">HK${safeFormatNumber(tripSharing.total_rolling_commission)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                              <span className="font-medium">Total Expenses</span>
                              <span className="text-orange-600 font-bold">HK${safeFormatNumber(tripSharing.total_expenses)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Agent Breakdown */}
                      {tripSharing.agent_breakdown && Object.keys(tripSharing.agent_breakdown).length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Agent Share Breakdown</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(tripSharing?.agent_breakdown || {}).map(([agentId, agentData]: [string, any]) => (
                                <div key={agentId} className="flex justify-between items-center p-3 border rounded">
                                  <div>
                                    <div className="font-medium">{agentData.agent_name}</div>
                                    <div className="text-sm text-gray-500">Commission Rate: {agentData.commission_rate}%</div>
                                  </div>
                                  <div className={`font-bold ${
                                    agentData.share_amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    HK${safeFormatNumber(agentData.share_amount)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Sharing Configuration */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Sharing Configuration</CardTitle>
                          <CardDescription>
                            Adjust the profit sharing percentages between agents and company
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Agent Share Percentage</Label>
                                <div className="text-2xl font-bold text-blue-600">
                                  {tripSharing.agent_share_percentage}%
                                </div>
                              </div>
                              <div>
                                <Label>Company Share Percentage</Label>
                                <div className="text-2xl font-bold text-purple-600">
                                  {tripSharing.company_share_percentage}%
                                </div>
                              </div>
                            </div>
                            <div className="pt-4 border-t">
                              <p className="text-sm text-gray-600 mb-4">
                                Current sharing model: {tripSharing.agent_share_percentage}% to agents, {tripSharing.company_share_percentage}% to company
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  // TODO: Add sharing configuration dialog
                                  showError('Sharing configuration will be available in the next update');
                                }}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Configure Sharing
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

              </Tabs>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Trip Selected</h3>
                <p className="text-gray-500 mb-4">
                  Please select a trip from the trips list to view detailed information.
                </p>
                <Button onClick={() => setActiveTab('trips')}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Go to Trips List
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectManagementComponent;