import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { tokenManager } from '../utils/auth/tokenManager';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Trip, Customer, Agent } from '../types';
import { db } from '../utils/supabase/supabaseClients';
import { apiClient } from '../utils/api/apiClient';
import { useLanguage } from '../contexts/LanguageContext';
import { isReadOnlyRole, canViewFinancialData } from '../utils/permissions';
import { PhotoDisplay } from './common/PhotoDisplay';
import { 
  SUPPORTED_CURRENCIES, 
  formatCurrency, 
  formatCurrencyWithSign, 
  getCurrencySymbol
} from '../utils/currency';
import { 
  MapPin, RefreshCw, Users, DollarSign, Settings, Plus, Trash2, Eye,
  BarChart, UserCheck, X, Share2, AlertTriangle, Camera, Image, CheckCircle, ChevronDown
} from 'lucide-react';



interface ProjectManagementProps {
  user?: { role: string; agentId?: string | null; username: string };
}

function ProjectManagementComponent({ user }: ProjectManagementProps) {
  // Default user if not provided
  const currentUser = user || { role: 'admin', agentId: null, username: 'admin' };
  const clearError = useCallback(() => {}, []);
  const showError = useCallback((message: string) => console.error(message), []);
  const { t } = useLanguage();
  const isReadOnly = isReadOnlyRole(currentUser.role);
  const canSeeFinancials = canViewFinancialData(currentUser.role);
  
  // Utility function for safe number conversion
  const safeNumber = (value: any): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };
  // Data states
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState('trips');
  const [selectedTripTab, setSelectedTripTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Trip expenses and sharing states
  const [tripExpenses, setTripExpenses] = useState<any[]>([]);
  const [tripSharing, setTripSharing] = useState<any>(null);
  const [agentSummary, setAgentSummary] = useState<any[]>([]);
  
  // Form states
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [showDeleteAgent, setShowDeleteAgent] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddRolling, setShowAddRolling] = useState(false);
  const [selectedCustomerForTransaction, setSelectedCustomerForTransaction] = useState<any>(null);
  const [selectedCustomerForRolling, setSelectedCustomerForRolling] = useState<any>(null);
  
  // Edit transaction/rolling states
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showEditRolling, setShowEditRolling] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editingRolling, setEditingRolling] = useState<any>(null);
  const [showHistory, setShowHistory] = useState<{[key: string]: boolean}>({});
  const [customerTransactions, setCustomerTransactions] = useState<{[key: string]: any[]}>({});
  const [customerRollings, setCustomerRollings] = useState<{[key: string]: any[]}>({});
  
  // Profit sharing rate edit states
  const [showEditProfitSharing, setShowEditProfitSharing] = useState(false);
  const [editingProfitSharing, setEditingProfitSharing] = useState<any>(null);
  const [newProfitSharingRate, setNewProfitSharingRate] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showDeleteExpense, setShowDeleteExpense] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<any>(null);
  const [showCustomerPhotos, setShowCustomerPhotos] = useState(false);
  const [selectedCustomerForPhotos, setSelectedCustomerForPhotos] = useState<any>(null);
  const [customerPhotos, setCustomerPhotos] = useState<any[]>([]);
  const [showDeleteCustomer, setShowDeleteCustomer] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  
  // Transaction and Rolling form states
  const [transactionForm, setTransactionForm] = useState({
    type: 'buy-in', // buy-in, cash-out (database format)
    amount: '',
    venue: '',
    datetime: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm format
  });
  const [rollingForm, setRollingForm] = useState({
    amount: '',
    staff_id: '',
    game_type: 'baccarat',
    venue: '',
    datetime: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm format
  });

  // Form data states
  const [newTrip, setNewTrip] = useState({
    name: '',
    description: '',
    date: '',
    endDate: '',
    venue: '',
    budget: '',
    status: 'active' as 'active' | 'in-progress' | 'completed' | 'cancelled',
    currency: 'HKD',
    exchange_rate_peso: 1.0000,
    exchange_rate_hkd: 1.0000,
    exchange_rate_myr: 1.0000
  });

  // Dynamic currency viewing state - initialize with trip's default currency
  const [viewingCurrency, setViewingCurrency] = useState<string>('HKD');
  
  // Customer search state for Add Customer dialog
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Clear customer search term when Add Customer dialog is closed
  useEffect(() => {
    if (!showAddCustomer) {
      setCustomerSearchTerm('');
    }
  }, [showAddCustomer]);

  // Update viewing currency when selected trip changes
  useEffect(() => {
    if (selectedTrip?.currency) {
      setViewingCurrency(selectedTrip.currency);
      console.log('🔄 Trip changed, updating viewing currency:', {
        tripId: selectedTrip.id,
        tripCurrency: selectedTrip.currency,
        exchangeRates: {
          peso: selectedTrip.exchange_rate_peso,
          hkd: selectedTrip.exchange_rate_hkd,
          myr: selectedTrip.exchange_rate_myr
        }
      });
    }
  }, [selectedTrip]);
  
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'flight' as const,
    datetime: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm format
  });
  const [editAgentShare, setEditAgentShare] = useState(25);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [deletingAgent, setDeletingAgent] = useState<any>(null);

  // Helper functions
  const safeFormatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString();
  };

  // Filter customers by search term for Add Customer dialog
  const filterCustomersBySearch = (customers: Customer[], searchTerm: string) => {
    if (!searchTerm.trim()) return customers;
    
    const term = searchTerm.toLowerCase().trim();
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.agentName?.toLowerCase().includes(term)
    );
  };

  // Permissions
  const isAdmin = currentUser.role === 'admin';
  const isAgent = currentUser.role === 'agent' && currentUser.agentId;

  const loadTripExpenses = useCallback(async (tripId: string) => {
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
  }, [showError]);

  const loadTripSharing = useCallback(async (tripId: string) => {
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
  }, [showError]);


  // Load agent summary data from trip_agent_summary table
  const loadAgentSummary = useCallback(async (tripId: string) => {
    try {
      console.log('📊 Loading agent summary for trip:', tripId);
      const response = await apiClient.getTripAgentSummary(tripId);
      console.log('📊 Agent summary API response:', response);
      if (response.success) {
        console.log('✅ Agent summary data:', response.data);
        setAgentSummary(Array.isArray(response.data) ? response.data : []);
      } else {
        console.log('❌ Agent summary API failed:', response);
        setAgentSummary([]);
      }
    } catch (error) {
      console.error('Error loading agent summary:', error);
      showError('Failed to load agent summary');
      setAgentSummary([]);
    }
  }, [showError]);

  // Load customer photos (transaction and rolling photos)
  const loadCustomerPhotos = useCallback(async (customerId: string, tripId: string) => {
    try {
      console.log('🔍 Loading customer photos for:', { customerId, tripId });
      const response = await apiClient.get(`/trips/${tripId}/customers/${customerId}/photos`);
      
      if (response.success) {
        console.log('📸 Customer photos loaded:', response.data);
        setCustomerPhotos(response.data || []);
      } else {
        console.log('❌ Failed to load customer photos:', response.error);
        setCustomerPhotos([]);
      }
    } catch (error) {
      console.error('❌ Error loading customer photos:', error);
      setCustomerPhotos([]);
    }
  }, []);

  // Handle viewing customer photos
  const handleViewCustomerPhotos = async (tripCustomer: any) => {
    if (!selectedTrip) return;
    
    const customerId = tripCustomer.customerId || tripCustomer.customer_id;
    setSelectedCustomerForPhotos(tripCustomer);
    setShowCustomerPhotos(true);
    
    // Load photos for this customer
    await loadCustomerPhotos(customerId, selectedTrip.id);
  };

  const updateCommissionRate = async (agentId: string, customerId: string, commissionRate: number) => {
    try {
      if (!selectedTrip) return;
      
      setSaving(true);
      const response = await apiClient.put(`/trips/${selectedTrip.id}/agents/${agentId}/commission`, {
        customer_id: customerId,
        profit_sharing_rate: commissionRate
      });
      
      if (response.success) {
        // Reload agent summary to reflect the change
        await loadAgentSummary(selectedTrip.id);
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

  // Handle opening profit sharing rate edit dialog
  const handleEditProfitSharing = (agentId: string, customer: any, agentName: string) => {
    setEditingProfitSharing({
      agentId,
      customerId: customer.customer_id,
      customerName: customer.customer_name,
      agentName,
      currentRate: customer.profit_sharing_rate || 0,
      customerNetResult: 0 // Will be calculated from customer stats
    });
    setNewProfitSharingRate(customer.profit_sharing_rate || 0);
    setShowEditProfitSharing(true);
  };

  // Handle updating profit sharing rate from dialog
  const handleUpdateProfitSharing = async () => {
    if (!editingProfitSharing) return;
    
    await updateCommissionRate(
      editingProfitSharing.agentId,
      editingProfitSharing.customerId,
      newProfitSharingRate
    );
    
    setShowEditProfitSharing(false);
    setEditingProfitSharing(null);
    setNewProfitSharingRate(0);
  };

  // Calculate projected profit share based on customer net result and sharing rate
  const calculateProjectedProfitShare = (customerNetResult: number, sharingRate: number) => {
    if (customerNetResult <= 0) return 0; // Only positive net results generate profit share
    return (customerNetResult * sharingRate) / 100;
  };

  const addTripExpense = async (tripId: string, expenseData: any) => {
    try {
      setSaving(true);
      const response = await apiClient.post(`/trips/${tripId}/expenses`, expenseData);
      if (response.success && selectedTrip) {
        await selectTrip(selectedTrip);
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


  // Enhanced data loading with better error handling and caching
  const loadAllRealTimeData = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh && dataLoaded && trips.length > 0) {
        console.log('📋 Using cached data, skipping reload');
        return;
      }
      
      setLoading(true);
      setErrorMessage('');
      clearError();
      
      // First ensure we have authentication
      const token = await tokenManager.getToken();
      if (!token) {
        console.log('❌ No authentication token available, attempting auto-login...');
        
        // Try to auto-login with admin credentials
        try {
          const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
          const loginResponse = await fetch(`${apiUrl}/auth/login`, {
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
      
      // Load basic data first (fast) - no role filtering at database level
      console.log('🔍 Loading data for user role:', currentUser.role);
      const [tripsData, customersData, agentsData, staffResponse] = await Promise.all([
        db.get('trips', []),
        db.get('customers', []),
        db.get('agents', []),
        apiClient.get('/staffs')
      ]);
      
      console.log('📊 Raw data loaded:', {
        trips: tripsData?.length || 0,
        customers: customersData?.length || 0,
        agents: agentsData?.length || 0,
        userRole: currentUser.role
      });
      
      // Extract staff data from API response
      const staffData = staffResponse.success ? staffResponse.data : [];

      // Transform trips with basic data only (no heavy API calls)
      const transformedTrips = (tripsData || []).map((trip: any) => {
        return {
          id: trip.id,
          name: trip.trip_name || trip.name || 'Unnamed Trip',
          description: trip.description || '',
          date: trip.start_date || trip.date,
          startDate: trip.start_date || trip.date,
          endDate: trip.end_date || trip.endDate,
          status: trip.status || 'active',
          budget: trip.total_budget || 0,
          createdAt: trip.created_at || new Date().toISOString(),
          currency: trip.currency || 'HKD',
          exchange_rate_peso: trip.exchange_rate_peso || 1.0,
          exchange_rate_hkd: trip.exchange_rate_hkd || 1.0,
          exchange_rate_myr: trip.exchange_rate_myr || (trip.name?.toLowerCase().includes('manila') || trip.trip_name?.toLowerCase().includes('manila') ? 0.6 : 1.0),
          customers: [],
          agents: [],
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
            netResult: 0,
            netCashFlow: 0,
            totalAgentShare: 0,
            companyShare: 0,
            agentSharePercentage: 0,
            companySharePercentage: 100,
            agentShares: [],
            agentBreakdown: []
          },
          attachments: [],
          lastDataUpdate: new Date().toISOString(),
          activeCustomersCount: 0,
          recentActivityCount: 0,
          totalExpenses: 0,
          _dataLoaded: false
        } as unknown as Trip;
      });

      // Set state with basic data immediately for fast UI response
      setTrips(transformedTrips);
      setCustomers(customersData || []);
      setAgents(agentsData || []);
      setStaff(staffData || []);
      setDataLoaded(true);
      
      console.log(`✅ Basic project data loaded quickly: ${transformedTrips.length} trips`);
      
      // Load detailed trip data in background (lazy loading)
      if (transformedTrips.length > 0) {
        setTimeout(async () => {
          try {
            const enrichedTrips = await Promise.all(transformedTrips.map(async (trip: any) => {
              try {
                const [statsResponse, sharingResponse, customersResponse] = await Promise.all([
                  apiClient.get(`/trips/${trip.id}/statistics`),
                  apiClient.get(`/trips/${trip.id}/sharing`),
                  apiClient.get(`/trips/${trip.id}/customer-stats`)
                ]);
                
                const tripStats = statsResponse.success ? statsResponse.data : null;
                const tripSharing = sharingResponse.success ? sharingResponse.data : null;
                const tripCustomers = customersResponse.success ? customersResponse.data : [];
                
                const statsRoot = tripStats?.statistics || tripStats;
                
                return {
                  ...trip,
                  customers: tripCustomers,
                  totalRolling: statsRoot?.total_rolling || tripStats?.total_rolling || 0,
                  totalWinLoss: statsRoot?.net_profit || tripStats?.net_profit || 0,
                  totalBuyIn: statsRoot?.total_buy_in || tripStats?.total_buy_in || 0,
                  totalBuyOut: statsRoot?.total_cash_out || tripStats?.total_cash_out || 0,
                  calculatedTotalRolling: statsRoot?.total_rolling || tripStats?.total_rolling || 0,
                  sharing: {
                    total_rolling: tripSharing?.total_rolling || 0,
                    total_expenses: tripSharing?.total_expenses || 0,
                    net_result: tripSharing?.net_result || 0,
                    totalWinLoss: tripSharing?.total_win_loss || 0,
                    totalRollingCommission: tripSharing?.total_rolling_commission || 0,
                    totalBuyIn: tripSharing?.total_buy_in || 0,
                    totalBuyOut: tripSharing?.total_buy_out || 0,
                    netCashFlow: tripSharing?.net_cash_flow || 0,
                    totalAgentShare: tripSharing?.total_agent_share || 0,
                    companyShare: tripSharing?.company_share || 0,
                    agentSharePercentage: tripSharing?.agent_share_percentage || 0,
                    companySharePercentage: tripSharing?.company_share_percentage || 100,
                    agentShares: [],
                    agentBreakdown: tripSharing?.agent_breakdown || []
                  },
                  totalExpenses: tripSharing?.total_expenses || 0,
                  _dataLoaded: true
                };
              } catch (error) {
                console.warn(`Failed to load detailed data for trip ${trip.id}:`, error);
                return { ...trip, _dataLoaded: false };
              }
            }));
            
            // Update trips with detailed data
            setTrips(enrichedTrips);
            console.log('✅ Detailed trip data loaded in background');
          } catch (error) {
            console.warn('Background data loading failed:', error);
          }
        }, 100); // Load detailed data after 100ms
      }
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setErrorMessage(`Failed to load project data: ${error}`);
      showError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, [dataLoaded, trips.length, showError, clearError, currentUser.role]);

  // Initial data load only
  useEffect(() => {
    loadAllRealTimeData(true);
  }, [loadAllRealTimeData]);


  // Load detailed data when trip is selected
  useEffect(() => {
    if (selectedTrip) {
      console.log('🎯 Loading detailed data for selected trip:', {
        tripId: selectedTrip.id,
        tripName: selectedTrip.name,
        customers: selectedTrip.customers,
        agents: selectedTrip.agents
      });
      loadTripExpenses(selectedTrip.id);
      loadTripSharing(selectedTrip.id);
    }
  }, [selectedTrip, loadTripExpenses, loadTripSharing]);

  // Filter trips based on user role
  const getFilteredTrips = () => {
    if (currentUser.role === 'agent' && currentUser.agentId) {
      return trips.filter(trip => 
        trip.agents && trip.agents.some(agent => agent.agentId === currentUser.agentId)
      );
    }
    // Boss and admin roles can see all trips
    return trips;
  };

  // Save trips to database
  const saveTrips = async (updatedTrips: Trip[]) => {
    try {
      setSaving(true);
      await db.save('trips', updatedTrips);
      setTrips(updatedTrips);
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
    if (!newTrip.name.trim() || !newTrip.date || !newTrip.venue) {
      showError('Please fill in all required fields (Name, Date, Venue)');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare data for backend API
      const tripData = {
        trip_name: newTrip.name,
        destination: newTrip.venue,
        start_date: newTrip.date,
        end_date: newTrip.endDate || newTrip.date,
        total_budget: parseFloat(newTrip.budget) || 0,
        description: newTrip.description || '',
        status: newTrip.status,
        currency: newTrip.currency,
        exchange_rate_peso: newTrip.exchange_rate_peso,
        exchange_rate_hkd: newTrip.exchange_rate_hkd,
        exchange_rate_myr: newTrip.exchange_rate_myr
      };

      console.log('Creating trip with data:', tripData);

      // Call backend API to create trip
      const response = await apiClient.post('/trips', tripData);
      
      if (response.success) {
        console.log('✅ Trip created successfully:', response.data);
        
        // Refresh trips list
        await loadAllRealTimeData();
        
        setShowCreateTrip(false);
        setNewTrip({
          name: '',
          description: '',
          date: '',
          endDate: '',
          venue: '',
          budget: '',
          status: 'active',
          currency: 'HKD',
          exchange_rate_peso: 1.0000,
          exchange_rate_hkd: 1.0000,
          exchange_rate_myr: 1.0000
        });
        
        console.log('✅ Trip created successfully:', response.data.trip_name);
      } else {
        throw new Error(response.error || 'Failed to create trip');
      }
      
    } catch (error) {
      console.error('❌ Error creating trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to create trip: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Select trip for detailed view with comprehensive backend data
  const selectTrip = async (trip: Trip) => {
    console.log('🎯 Selecting trip for details:', trip.name);
    
    try {
      setLoading(true);
      
      // Load comprehensive trip data from backend API
      const [customersResponse, expensesResponse, sharingResponse, statisticsResponse, transactionsResponse, agentsResponse, staffResponse] = await Promise.all([
        apiClient.get(`/trips/${trip.id}/customer-stats`),
        apiClient.get(`/trips/${trip.id}/expenses`),
        apiClient.get(`/trips/${trip.id}/sharing`),
        apiClient.get(`/trips/${trip.id}/statistics`),
        apiClient.get(`/trips/${trip.id}/transactions`),
        apiClient.get(`/trips/${trip.id}/agents`),
        apiClient.get(`/trips/${trip.id}/staff`)
      ]);
      
      console.log('📊 Backend API responses:', {
        customers: customersResponse,
        expenses: expensesResponse,
        sharing: sharingResponse,
        statistics: statisticsResponse,
        transactions: transactionsResponse,
        agents: agentsResponse,
        staff: staffResponse
      });
      
      // Create enriched trip object with actual backend data
      const enrichedTrip = {
        ...trip,
        customers: customersResponse.success ? customersResponse.data : [],
        expenses: expensesResponse.success ? (expensesResponse.data?.expenses || []) : [],
        agents: agentsResponse.success ? agentsResponse.data : [],
        staff: staffResponse.success ? staffResponse.data : [],
        sharing: sharingResponse.success ? sharingResponse.data : trip.sharing,
        statistics: statisticsResponse.success ? statisticsResponse.data : null,
        transactions: transactionsResponse.success ? transactionsResponse.data : [],
        activeCustomersCount: customersResponse.success ? customersResponse.data?.length || 0 : trip.activeCustomersCount || 0,
        backendData: {
          totalBuyIn: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_buy_in || 0 : 0,
          totalCashOut: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_cash_out || 0 : 0,
          totalWinLoss: statisticsResponse.success ? statisticsResponse.data?.statistics?.total_win_loss || 0 : 0,
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
      
      // Load agent summary data from trip_agent_summary table
      await loadAgentSummary(trip.id);
      
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
      
      // Refresh trip data completely to show new customer
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

  // Confirm and remove customer from trip
  const confirmRemoveCustomerFromTrip = async () => {
    if (!deletingCustomer) return;
    
    const customerId = deletingCustomer.customerId || deletingCustomer.customer_id;
    setShowDeleteCustomer(false);
    setDeletingCustomer(null);
    
    await handleRemoveCustomerFromTrip(customerId);
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


  // Add staff to trip
  const handleAddStaffToTrip = async (staffId: string) => {
    if (!selectedTrip) {
      showError('No trip selected');
      return;
    }

    try {
      setSaving(true);
      
      const response = await apiClient.post(`/trips/${selectedTrip.id}/staff`, {
        staff_id: staffId
      });
      
      if (response.success) {
        console.log(' Staff added to trip via API');
        
        // Refresh trip data to get updated staff list
        await selectTrip(selectedTrip);
        setShowAddStaff(false);
        
      } else {
        showError(response.error || 'Failed to add staff to trip');
      }
    } catch (error) {
      console.error('Error adding staff to trip:', error);
      showError('Failed to add staff to trip');
    } finally {
      setSaving(false);
    }
  };

  // Remove staff from trip
  const handleRemoveStaffFromTrip = async (staffId: string) => {
    if (!selectedTrip) {
      showError('No trip selected');
      return;
    }

    try {
      setSaving(true);
      
      const response = await apiClient.delete(`/trips/${selectedTrip.id}/staff/${staffId}`);
      
      if (response.success) {
        console.log(' Staff removed from trip via API');
        
        // Refresh trip data to get updated staff list
        await selectTrip(selectedTrip);
        
      } else {
        showError(response.error || 'Failed to remove staff from trip');
      }
    } catch (error) {
      console.error('Error removing staff from trip:', error);
      showError('Failed to remove staff from trip');
    } finally {
      setSaving(false);
    }
  };


  // Load customer transaction history
  const loadCustomerTransactions = async (customerId: string, tripId: string) => {
    try {
      const response = await apiClient.getCustomerTransactions(customerId, tripId);
      if (response.success) {
        setCustomerTransactions(prev => ({
          ...prev,
          [customerId]: Array.isArray(response.data) ? response.data : []
        }));
      }
    } catch (error) {
      console.error('Error loading customer transactions:', error);
    }
  };

  // Load customer rolling history
  const loadCustomerRollings = async (customerId: string, tripId: string) => {
    try {
      const response = await apiClient.getCustomerRollings(customerId, tripId);
      if (response.success) {
        setCustomerRollings(prev => ({
          ...prev,
          [customerId]: Array.isArray(response.data) ? response.data : []
        }));
      }
    } catch (error) {
      console.error('Error loading customer rollings:', error);
    }
  };

  // Toggle history visibility (both transaction and rolling)
  const toggleHistoryVisibility = async (customerId: string) => {
    const isCurrentlyShown = showHistory[customerId];
    setShowHistory(prev => ({
      ...prev,
      [customerId]: !isCurrentlyShown
    }));
    
    if (!isCurrentlyShown && selectedTrip) {
      // Load both transaction and rolling history when expanding
      await loadCustomerTransactions(customerId, selectedTrip.id);
      await loadCustomerRollings(customerId, selectedTrip.id);
    }
  };

  // Handle edit transaction
  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      type: transaction.transaction_type || transaction.type,
      amount: String(transaction.amount || ''),
      venue: transaction.venue || '',
      datetime: transaction.created_at ? new Date(transaction.created_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
    setShowEditTransaction(true);
  };

  // Handle update transaction
  const handleUpdateTransaction = async () => {
    if (!editingTransaction || !selectedTrip) return;
    
    setSaving(true);
    try {
      const transactionData = {
        transaction_type: transactionForm.type,
        amount: parseFloat(transactionForm.amount),
        venue: transactionForm.venue || null,
        updated_at: new Date().toISOString()
      };

      const response = await apiClient.updateTransaction(editingTransaction.id, transactionData);
      if (response.success) {
        // Refresh data
        await selectTrip(selectedTrip);
        const customerId = editingTransaction.customer_id || editingTransaction.customerId;
        if (customerId) {
          await loadCustomerTransactions(customerId, selectedTrip.id);
        }
        setShowEditTransaction(false);
        setEditingTransaction(null);
        setTransactionForm({ type: 'buy-in', amount: '', venue: '', datetime: new Date().toISOString().slice(0, 16) });
      } else {
        showError('Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      showError('Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete transaction
  const handleDeleteTransaction = async (transaction: any) => {
    if (!selectedTrip || !window.confirm('Are you sure you want to delete this transaction?')) return;
    
    setSaving(true);
    try {
      const response = await apiClient.deleteTransaction(transaction.id);
      if (response.success) {
        // Refresh data
        await selectTrip(selectedTrip);
        const customerId = transaction.customer_id || transaction.customerId;
        if (customerId) {
          await loadCustomerTransactions(customerId, selectedTrip.id);
        }
      } else {
        showError('Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showError('Failed to delete transaction');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit rolling
  const handleEditRolling = (rolling: any) => {
    setEditingRolling(rolling);
    setRollingForm({
      amount: String(rolling.rolling_amount || rolling.amount || ''),
      staff_id: rolling.staff_id || '',
      game_type: rolling.game_type || 'baccarat',
      venue: rolling.venue || '',
      datetime: rolling.created_at ? new Date(rolling.created_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
    setShowEditRolling(true);
  };

  // Handle update rolling
  const handleUpdateRolling = async () => {
    if (!editingRolling || !selectedTrip) return;
    
    setSaving(true);
    try {
      const rollingData = {
        rolling_amount: parseFloat(rollingForm.amount),
        staff_id: rollingForm.staff_id,
        game_type: rollingForm.game_type,
        venue: rollingForm.venue || null,
        updated_at: new Date().toISOString()
      };

      const response = await apiClient.updateRolling(editingRolling.id, rollingData);
      if (response.success) {
        // Refresh data
        await selectTrip(selectedTrip);
        const customerId = editingRolling.customer_id || editingRolling.customerId;
        if (customerId) {
          await loadCustomerRollings(customerId, selectedTrip.id);
        }
        setShowEditRolling(false);
        setEditingRolling(null);
        setRollingForm({ 
          amount: '', 
          staff_id: '', 
          game_type: 'baccarat', 
          venue: '', 
          datetime: new Date().toISOString().slice(0, 16) 
        });
      } else {
        showError('Failed to update rolling');
      }
    } catch (error) {
      console.error('Error updating rolling:', error);
      showError('Failed to update rolling');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete rolling
  const handleDeleteRolling = async (rolling: any) => {
    if (!selectedTrip || !window.confirm('Are you sure you want to delete this rolling record?')) return;
    
    setSaving(true);
    try {
      const response = await apiClient.deleteRolling(rolling.id);
      if (response.success) {
        // Refresh data
        await selectTrip(selectedTrip);
        const customerId = rolling.customer_id || rolling.customerId;
        if (customerId) {
          await loadCustomerRollings(customerId, selectedTrip.id);
        }
      } else {
        showError('Failed to delete rolling');
      }
    } catch (error) {
      console.error('Error deleting rolling:', error);
      showError('Failed to delete rolling');
    } finally {
      setSaving(false);
    }
  };

  // Handle transaction operations
  const handleAddTransaction = async () => {
    if (!selectedTrip || !selectedCustomerForTransaction) return;
    
    setSaving(true);
    try {
      // Check authentication first
      const userData = localStorage.getItem('casinoUser');
      if (!userData) {
        showError('Please login first to add transactions');
        return;
      }

      // Fix transaction type mapping: buy_in -> buy-in, cash_out -> cash-out
      const transactionTypeMapping: { [key: string]: string } = {
        'buy_in': 'buy-in',
        'cash_out': 'cash-out',
        'buy-in': 'buy-in',
        'cash-out': 'cash-out'
      };

      const mappedTransactionType = transactionTypeMapping[transactionForm.type] || transactionForm.type;

      // Ensure we have proper customer_id
      const customerId = selectedCustomerForTransaction.customerId || 
                        selectedCustomerForTransaction.customer_id || 
                        selectedCustomerForTransaction.id;

      if (!customerId) {
        showError('Customer ID is required for transaction');
        return;
      }

      const transactionData = {
        customer_id: customerId,
        transaction_type: mappedTransactionType, // Must be 'buy-in' or 'cash-out'
        amount: parseFloat(transactionForm.amount),
        status: 'completed', // Add required status field
        venue: transactionForm.venue || null,
        updated_at: new Date(transactionForm.datetime).toISOString()
      };

      console.log('🔄 Adding transaction:', transactionData);
      
      const response = await apiClient.post(`/trips/${selectedTrip.id}/transactions`, transactionData);
      
      if (response.success) {
        // Refresh the selected trip data
        await selectTrip(selectedTrip);
        setShowAddTransaction(false);
        setTransactionForm({ type: 'buy-in', amount: '', venue: '', datetime: new Date().toISOString().slice(0, 16) });
        setSelectedCustomerForTransaction(null);
      } else {
        showError('Failed to add transaction');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      showError('Failed to add transaction');
    } finally {
      setSaving(false);
    }
  };

  // Handle rolling operations
  const handleAddRolling = async () => {
    if (!selectedTrip || !selectedCustomerForRolling) return;
    
    setSaving(true);
    try {
      console.log('🎯 Rolling request data:', {
        customer_id: selectedCustomerForRolling.customerId || selectedCustomerForRolling.customer_id,
        staff_id: rollingForm.staff_id,
        game_type: rollingForm.game_type,
        rolling_amount: parseFloat(rollingForm.amount),
        venue: rollingForm.venue
      });
      
      const response = await apiClient.post(`/trips/${selectedTrip.id}/rolling-records`, {
        customer_id: selectedCustomerForRolling.customerId || selectedCustomerForRolling.customer_id,
        staff_id: rollingForm.staff_id,
        game_type: rollingForm.game_type,
        rolling_amount: parseFloat(rollingForm.amount),
        venue: rollingForm.venue,
        updated_at: new Date(rollingForm.datetime).toISOString()
      });
      
      if (response.success) {
        // Refresh the selected trip data completely to show new rolling record
        await selectTrip(selectedTrip);
        setShowAddRolling(false);
        setRollingForm({ amount: '', staff_id: '', game_type: 'baccarat', venue: '', datetime: new Date().toISOString().slice(0, 16) });
        setSelectedCustomerForRolling(null);
      } else {
        showError('Failed to add rolling');
      }
    } catch (error) {
      console.error('Error adding rolling:', error);
      showError('Failed to add rolling');
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


  // Add expense to trip using API
  const handleAddExpense = async () => {
    if (!selectedTrip || !newExpense.description.trim() || newExpense.amount <= 0) {
      showError('Please fill in all expense fields');
      return;
    }

    const expenseData = {
      expense_type: newExpense.category,
      amount: newExpense.amount,
      description: newExpense.description,
      updated_at: new Date(newExpense.datetime).toISOString()
    };

    const success = await addTripExpense(selectedTrip.id, expenseData);
    if (success) {
      setShowAddExpense(false);
      setNewExpense({
        description: '',
        amount: 0,
        category: 'flight',
        datetime: new Date().toISOString().slice(0, 16)
      });
      console.log('✅ Expense added to trip via API');
    }
  };

  // Edit expense
  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setNewExpense({
      description: expense.description,
      amount: expense.amount,
      category: expense.expense_type,
      datetime: expense.expense_date ? new Date(expense.expense_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
    setShowEditExpense(true);
  };

  // Update expense
  const handleUpdateExpense = async () => {
    if (!selectedTrip || !editingExpense || !newExpense.description.trim() || newExpense.amount <= 0) {
      showError('Please fill in all expense fields');
      return;
    }

    try {
      setSaving(true);
      const expenseData = {
        expense_type: newExpense.category,
        amount: newExpense.amount,
        description: newExpense.description,
        expense_date: new Date(newExpense.datetime).toISOString()
      };

      const response = await apiClient.put(`/trips/${selectedTrip.id}/expenses/${editingExpense.id}`, expenseData);
      
      if (response.success) {
        await selectTrip(selectedTrip);
        setShowEditExpense(false);
        setEditingExpense(null);
        setNewExpense({
          description: '',
          amount: 0,
          category: 'flight',
          datetime: new Date().toISOString().slice(0, 16)
        });
        console.log('✅ Expense updated successfully');
      } else {
        showError('Failed to update expense');
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      showError('Failed to update expense');
    } finally {
      setSaving(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = (expense: any) => {
    setDeletingExpense(expense);
    setShowDeleteExpense(true);
  };

  // Confirm delete expense
  const confirmDeleteExpense = async () => {
    if (!selectedTrip || !deletingExpense) return;

    try {
      setSaving(true);
      const response = await apiClient.delete(`/trips/${selectedTrip.id}/expenses/${deletingExpense.id}`);
      
      if (response.success) {
        await selectTrip(selectedTrip);
        setShowDeleteExpense(false);
        setDeletingExpense(null);
        console.log('✅ Expense deleted successfully');
      } else {
        showError('Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      showError('Failed to delete expense');
    } finally {
      setSaving(false);
    }
  };

  const filteredTrips = getFilteredTrips();
  

  // Loading state
  if (loading && !dataLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading Project Data</p>
          <p className="text-xs text-gray-500">Connecting to Supabase and loading trips, customers, and agents...</p>
          <div className="mt-3 w-48 bg-gray-200 rounded-full h-2 mx-auto">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Data Loading Status */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('trips_loaded')}</p>
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
                <p className="text-sm text-gray-600">{t('customers_available')}</p>
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
                <p className="text-sm text-gray-600">{t('agents_available')}</p>
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
            <strong>{t('error')}:</strong> {errorMessage}
            <Button
              onClick={() => loadAllRealTimeData(true)}
              size="sm"
              variant="outline"
              className="ml-3 text-red-800 border-red-300 hover:bg-red-100"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips">{t('trips')}</TabsTrigger>
          <TabsTrigger value="trip-details" disabled={!selectedTrip}>
            {t('trip_details')}
          </TabsTrigger>
        </TabsList>

        {/* All Trips Tab */}
        <TabsContent value="trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{t('project_management')}</h2>
              <p className="text-gray-600">
                Manage trips and project data with full CRUD functionality
                {currentUser.role === 'agent' && ' (Your trips only)'}
              </p>
            </div>
            {!isReadOnly && (
              <Dialog open={showCreateTrip} onOpenChange={setShowCreateTrip}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
{t('create_trip')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('create_new_trip')}</DialogTitle>
                    <DialogDescription>
                      {t('create_trip_desc')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tripName">{t('trip_name')} *</Label>
                      <Input
                        id="tripName"
                        value={newTrip.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, name: e.target.value})}
                        placeholder="Enter trip name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tripDescription">{t('description')}</Label>
                      <Textarea
                        id="tripDescription"
                        value={newTrip.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTrip({...newTrip, description: e.target.value})}
                        placeholder="Trip description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">{t('start_date')} *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newTrip.date}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">{t('end_date')}</Label>
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
                      <Label htmlFor="budget">Budget (HK$)</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={newTrip.budget}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTrip({...newTrip, budget: e.target.value})}
                        placeholder="Enter trip budget"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={newTrip.status} 
                        onValueChange={(value) => 
                          setNewTrip({...newTrip, status: value as 'active' | 'in-progress' | 'completed' | 'cancelled'})
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Currency Selection */}
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select 
                        value={newTrip.currency} 
                        onValueChange={(value) => setNewTrip({...newTrip, currency: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Exchange Rates */}
                    <div className="space-y-3">
                      <Label>Exchange Rates (Manual Input)</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="ratePeso" className="text-sm">Peso Rate</Label>
                          <Input
                            id="ratePeso"
                            type="number"
                            step="0.0001"
                            value={newTrip.exchange_rate_peso}
                            onChange={(e) => setNewTrip({...newTrip, exchange_rate_peso: parseFloat(e.target.value) || 1.0000})}
                            placeholder="1.0000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rateHKD" className="text-sm">HKD Rate</Label>
                          <Input
                            id="rateHKD"
                            type="number"
                            step="0.0001"
                            value={newTrip.exchange_rate_hkd}
                            onChange={(e) => setNewTrip({...newTrip, exchange_rate_hkd: parseFloat(e.target.value) || 1.0000})}
                            placeholder="1.0000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rateMYR" className="text-sm">MYR Rate</Label>
                          <Input
                            id="rateMYR"
                            type="number"
                            step="0.0001"
                            value={newTrip.exchange_rate_myr}
                            onChange={(e) => setNewTrip({...newTrip, exchange_rate_myr: parseFloat(e.target.value) || 1.0000})}
                            placeholder="1.0000"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Set exchange rates for currency conversion. Current selection: {getCurrencySymbol(newTrip.currency)}
                      </p>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateTrip(false)}
                        disabled={saving}
                      >
                        {t('cancel')}
                      </Button>
                      <Button onClick={handleCreateTrip} disabled={saving}>
                        {saving ? t('creating') : t('create_trip')}
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
                <p className="text-gray-500">{t('loading_trips')}</p>
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
                  <Button onClick={() => loadAllRealTimeData(true)} variant="outline">
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
                            trip.status === 'in-progress' ? 'secondary' : 'outline'
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="text-center">
                          <div className="text-gray-500 text-xs">Customers</div>
                          <div className="font-medium">{trip.customers?.length || 0}</div>
                        </div>
                        {canSeeFinancials && (
                          <>
                            <div className="text-center">
                              <div className="text-gray-500 text-xs">Total Rolling</div>
                              <div className="font-medium text-blue-600">HK${safeFormatNumber(trip.sharing?.total_rolling || 0)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-500 text-xs">Expenses</div>
                              <div className="font-medium text-red-600">HK${safeFormatNumber(Math.abs(trip.sharing?.total_expenses || 0))}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-500 text-xs">Profit</div>
                              <div className={`font-medium ${(trip.sharing?.net_result || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                HK${safeFormatNumber(Math.abs(trip.sharing?.net_result || 0))}
                              </div>
                            </div>
                          </>
                        )}
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
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrip.name}</h2>
                  <p className="text-gray-600">{selectedTrip.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Currency Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{t('view_in')}</span>
                    <Select value={viewingCurrency} onValueChange={(newCurrency) => {
                      console.log('🔄 Currency selector changed:', {
                        from: viewingCurrency,
                        to: newCurrency,
                        tripData: selectedTrip ? {
                          id: selectedTrip.id,
                          currency: selectedTrip.currency,
                          rates: {
                            peso: selectedTrip.exchange_rate_peso,
                            hkd: selectedTrip.exchange_rate_hkd,
                            myr: selectedTrip.exchange_rate_myr
                          }
                        } : null
                      });
                      setViewingCurrency(newCurrency);
                    }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab('trips')}>
                    <MapPin className="w-4 h-4 mr-2" />
                    {t('back_to_trips')}
                  </Button>
                </div>
              </div>

              {/* Trip Details Tabs */}
              <Tabs value={selectedTripTab} onValueChange={setSelectedTripTab} className="space-y-4">
                <TabsList className="w-full flex flex-wrap sm:grid sm:grid-cols-6 gap-1 sm:gap-0 h-auto sm:h-10 p-1">
                  <TabsTrigger value="overview" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <BarChart className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Overview</span>
                    <span className="sm:hidden">Over</span>
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Customers</span>
                    <span className="sm:hidden">Cust</span>
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <UserCheck className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Agents</span>
                    <span className="sm:hidden">Agt</span>
                  </TabsTrigger>
                  <TabsTrigger value="staff" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Staff</span>
                    <span className="sm:hidden">Staff</span>
                  </TabsTrigger>
                  <TabsTrigger value="expenses" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <DollarSign className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Expenses</span>
                    <span className="sm:hidden">Exp</span>
                  </TabsTrigger>
                  <TabsTrigger value="sharing" className="flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0 flex-shrink-0">
                    <Settings className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">Financials</span>
                    <span className="sm:hidden">Fin</span>
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="space-y-6">
                    {(() => {
                      // Use backend data directly - no local calculation needed
                      const totalExpenses = (selectedTrip?.expenses || []).reduce((sum: number, e: any) => sum + safeNumber(e.amount), 0);
                      return (
                        <>
                          {/* Enhanced Trip Metrics with Backend Data Integration */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Buy-in</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                  {formatCurrency((selectedTrip as any)?.backendData?.totalBuyIn || 0, viewingCurrency, selectedTrip)}
                                </div>
                                <p className="text-xs text-gray-500">{selectedTrip?.activeCustomersCount || selectedTrip?.customers?.length || 0} customers</p>
                                <p className="text-xs text-green-500">From transactions</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Buy-out</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                  {formatCurrency(Math.abs((selectedTrip as any)?.backendData?.totalCashOut || 0), viewingCurrency, selectedTrip)}
                                </div>
                                <p className="text-xs text-gray-500">Customer withdrawals</p>
                                <p className="text-xs text-red-500">From transactions</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Expenses</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                  {formatCurrency(Math.abs(totalExpenses), viewingCurrency, selectedTrip)}
                                </div>
                                <p className="text-xs text-gray-500">After all expenses</p>
                                <p className="text-xs text-red-500">House perspective</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-600">Profit</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className={`text-2xl font-bold ${
                                  ((selectedTrip as any)?.sharing?.net_result || (selectedTrip as any)?.backendData?.netProfit || 0) > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(Math.abs((selectedTrip as any)?.sharing?.net_result || (selectedTrip as any)?.backendData?.netProfit || 0), viewingCurrency, selectedTrip)}
                                </div>
                                <p className="text-xs text-gray-500">House perspective</p>
                                <p className={`text-xs ${((selectedTrip as any)?.sharing?.net_result || (selectedTrip as any)?.backendData?.netProfit || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>After all expenses</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Quick Actions */}
                          {!isReadOnly && (
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
                          )}

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
                    {!isReadOnly && (
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
                            Search and select from available customers
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* Search Input */}
                          <div className="space-y-2">
                            <Label htmlFor="customer-search">Search Customers</Label>
                            <Input
                              id="customer-search"
                              type="text"
                              placeholder="Search by name, email, or agent..."
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              className="w-full"
                            />
                          </div>
                          
                          {/* Customer List */}
                          <div className="space-y-4 max-h-80 overflow-y-auto">
                            {(() => {
                              const availableCustomers = (customers || []).filter(c => 
                                !(selectedTrip?.customers || []).some(tc => 
                                  tc.customerId === c.id || (tc as any).customer_id === c.id
                                )
                              );
                              const filteredCustomers = filterCustomersBySearch(availableCustomers, customerSearchTerm);
                              
                              return (
                                <>
                                  <div className="text-sm text-gray-500 px-1">
                                    Showing {filteredCustomers.length} of {availableCustomers.length} available customers
                                  </div>
                                  {filteredCustomers.map(customer => (
                                    <div key={customer.id} className="flex items-center justify-between p-3 border rounded">
                                      <div>
                                        <div className="font-medium">{customer.name}</div>
                                        <div className="text-sm text-gray-500">{customer.email}</div>
                                        <div className="text-xs text-gray-400">Agent: {customer.agentName}</div>
                                      </div>
                                      {!isReadOnly && (
                                        <Button size="sm" onClick={() => handleAddCustomerToTrip(customer.id)} disabled={saving}>
                                          {saving ? 'Adding...' : 'Add'}
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                  {filteredCustomers.length === 0 && availableCustomers.length > 0 && (
                                    <p className="text-center text-gray-500 py-8">No customers match your search</p>
                                  )}
                                  {availableCustomers.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">All customers are already added to this trip</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}
                  </div>

                  {(selectedTrip?.customers?.length || 0) === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No customers added to this trip</p>
                        {!isReadOnly && (
                          <Button className="mt-4" onClick={() => setShowAddCustomer(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Customer
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(selectedTrip?.customers || []).map((tripCustomer: any) => (
                        <Card key={tripCustomer.customerId || tripCustomer.customer_id}>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              {/* 客户信息头部 */}
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-base">{tripCustomer.customerName || tripCustomer.customer?.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  VIP: {tripCustomer.customer?.vip_level || 'Standard'}
                                </Badge>
                              </div>
                              
                              {/* 财务数据 - 移动端优化布局 */}
                              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
                                <div className="flex justify-between sm:block">
                                  <span className="text-sm text-gray-500">Buy-in:</span>
                                  <div className="font-medium text-blue-600 text-right sm:text-left">
                                    {formatCurrency(tripCustomer.total_buy_in || tripCustomer.buyInAmount || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="text-sm text-gray-500">Cash-out:</span>
                                  <div className="font-medium text-purple-600 text-right sm:text-left">
                                    {formatCurrency(tripCustomer.total_cash_out || tripCustomer.buyOutAmount || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="text-sm text-gray-500">Rolling:</span>
                                  <div className="font-medium text-orange-600 text-right sm:text-left">
                                    {formatCurrency(tripCustomer.rolling_amount || tripCustomer.rollingAmount || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="text-sm text-gray-500">Win/Loss:</span>
                                  <div className={`font-medium text-right sm:text-left ${
                                    (tripCustomer.total_buy_in || 0) - (tripCustomer.total_cash_out || 0) > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(Math.abs((tripCustomer.total_buy_in || 0) - (tripCustomer.total_cash_out || 0)), viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="text-sm text-gray-500">Net Result:</span>
                                  <div className={`font-medium text-right sm:text-left ${
                                    (tripCustomer.net_result || 0) > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(Math.abs(tripCustomer.net_result || 0), viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                              </div>
                              
                              {/* 操作按钮 - 移动端优化 */}
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                                <div className="flex gap-2 flex-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => {
                                      setSelectedCustomerForTransaction(tripCustomer);
                                      setShowAddTransaction(true);
                                    }}
                                    disabled={saving}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Transaction
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => {
                                      setSelectedCustomerForRolling(tripCustomer);
                                      setShowAddRolling(true);
                                    }}
                                    disabled={saving}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Rolling
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => toggleHistoryVisibility(tripCustomer.customerId || tripCustomer.customer_id)}
                                    disabled={saving}
                                  >
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showHistory[tripCustomer.customerId || tripCustomer.customer_id] ? 'rotate-180' : ''}`} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => handleViewCustomerPhotos(tripCustomer)}
                                    disabled={saving}
                                  >
                                    <Camera className="w-3 h-3 mr-1" />
                                    Photos
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => {
                                      setDeletingCustomer(tripCustomer);
                                      setShowDeleteCustomer(true);
                                    }}
                                    disabled={saving}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Combined History (Transaction & Rolling) */}
                            {showHistory[tripCustomer.customerId || tripCustomer.customer_id] && (
                              <div className="mt-4 border-t pt-4">
                                {/* Transaction History Section */}
                                <div className="mb-4">
                                  <h5 className="font-medium mb-2 text-blue-600">Transaction History</h5>
                                  {customerTransactions[tripCustomer.customerId || tripCustomer.customer_id]?.map((transaction: any) => (
                                    <div key={transaction.id} className="flex items-center justify-between p-2 bg-blue-50 rounded border mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <Badge variant={transaction.transaction_type === 'buy-in' ? 'default' : 'secondary'}>
                                            {transaction.transaction_type === 'buy-in' ? 'Buy-in' : 'Cash-out'}
                                          </Badge>
                                          <span className="font-medium">
                                            {formatCurrency(transaction.amount, viewingCurrency, selectedTrip)}
                                          </span>
                                          <span className="text-sm text-gray-500">{transaction.venue}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          {new Date(transaction.created_at).toLocaleString()}
                                        </div>
                                      </div>
                                      {!isReadOnly && (
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(transaction)}>
                                            <Settings className="w-3 h-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(transaction)} className="text-red-600">
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Rolling History Section */}
                                <div>
                                  <h5 className="font-medium mb-2 text-orange-600">Rolling History</h5>
                                  {customerRollings[tripCustomer.customerId || tripCustomer.customer_id]?.map((rolling: any) => (
                                    <div key={rolling.id} className="flex items-center justify-between p-2 bg-orange-50 rounded border mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="outline" className="bg-orange-100 text-orange-700">Rolling</Badge>
                                          <span className="font-medium">
                                            {formatCurrency(rolling.rolling_amount || rolling.amount, viewingCurrency, selectedTrip)}
                                          </span>
                                          <span className="text-sm text-gray-500">{rolling.venue}</span>
                                          <span className="text-xs text-gray-400">({rolling.game_type})</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          {new Date(rolling.created_at).toLocaleString()}
                                        </div>
                                      </div>
                                      {!isReadOnly && (
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleEditRolling(rolling)}>
                                            <Settings className="w-3 h-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRolling(rolling)} className="text-red-600">
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Delete Customer Confirmation Dialog */}
                  {!isReadOnly && (
                    <AlertDialog open={showDeleteCustomer} onOpenChange={setShowDeleteCustomer}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Customer from Trip</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove <strong>{deletingCustomer?.customerName || deletingCustomer?.customer?.name}</strong> from this trip?
                            <br /><br />
                            This will permanently remove all their transaction history, rolling records, and financial data associated with this trip.
                            <br /><br />
                            <strong>This action cannot be undone.</strong>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel 
                            onClick={() => {
                              setShowDeleteCustomer(false);
                              setDeletingCustomer(null);
                            }}
                            disabled={saving}
                          >
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={confirmRemoveCustomerFromTrip}
                            disabled={saving}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {saving ? 'Removing...' : 'Remove Customer'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TabsContent>

                {/* Agent Profits Tab */}
                <TabsContent value="agents" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Agent Profit Sharing Summary</h3>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        if (selectedTrip) {
                          console.log('🔄 Manual refresh clicked for trip:', selectedTrip.id);
                          loadAgentSummary(selectedTrip.id);
                        }
                      }}
                      disabled={loading}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  {loading ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading agent summary...</p>
                      </CardContent>
                    </Card>
                  ) : !agentSummary || agentSummary.length === 0 ? (
                    <div className="space-y-4">
                      <Card>
                        <CardContent className="text-center py-8">
                          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No agent profit sharing data available</p>
                          <p className="text-xs text-gray-400 mt-2">Agent summaries are created when trip sharing is calculated</p>
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
                            <div>Agent summary loaded: {agentSummary?.length || 0}</div>
                            <div>Agent summary state: {JSON.stringify(agentSummary)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {agentSummary.map((summary: any) => (
                        <Card key={summary.agent_id}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{summary.agent_name}</CardTitle>
                                <CardDescription>
                                  Base Commission Rate: {summary.agent_commission_rate}%
                                </CardDescription>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                  {formatCurrency(summary.agent_profit_share || 0, viewingCurrency, selectedTrip)}
                                </div>
                                <p className="text-sm text-gray-500">Agent Profit Share</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Summary Statistics */}
                              <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="p-3 bg-blue-50 rounded">
                                  <div className="text-sm text-gray-600">Total Win/Loss</div>
                                  <div className={`text-lg font-bold ${
                                    summary.total_win_loss >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrencyWithSign(summary.total_win_loss || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="p-3 bg-green-50 rounded">
                                  <div className="text-sm text-gray-600">Total Commission</div>
                                  <div className="text-lg font-bold text-gray-800">
                                    {formatCurrency(summary.total_commission || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                                <div className="p-3 bg-purple-50 rounded">
                                  <div className="text-sm text-gray-600">Total Profit</div>
                                  <div className={`text-lg font-bold ${
                                    summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrencyWithSign(summary.total_profit || 0, viewingCurrency, selectedTrip)}
                                  </div>
                                </div>
                              </div>

                              {/* Customer Details */}
                              <div>
                                <h4 className="font-medium mb-3">
                                  Customer Details ({summary.customer_count || summary.customers?.length || 0} customers)
                                </h4>
                                <div className="space-y-3">
                                  {summary.customers && summary.customers.map((customer: any) => (
                                    <div key={customer.customer_id} className="border rounded p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <div className="font-medium">{customer.customer_name}</div>
                                          <div className="text-sm text-gray-500">
                                            Net Result: <span className={`font-medium ${
                                              (customer.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                              {formatCurrency(Math.abs(customer.net_result || 0), viewingCurrency, selectedTrip)}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-blue-600">
                                            {customer.profit_sharing_rate}%
                                          </div>
                                          <div className="text-sm text-gray-500">Profit Sharing Rate</div>
                                        </div>
                                      </div>
                                      
                                      {!isReadOnly && (
                                        <div className="flex justify-center pt-2 border-t">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditProfitSharing(summary.agent_id, customer, summary.agent_name)}
                                            className="text-sm"
                                          >
                                            <Settings className="w-4 h-4 mr-1" />
                                            Edit Profit Sharing Rate
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Summary Information */}
                              <div className="bg-gray-50 p-3 rounded">
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>Created: {new Date(summary.created_at).toLocaleDateString()}</div>
                                  <div>Last Updated: {new Date(summary.updated_at).toLocaleDateString()}</div>
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
                          {!isReadOnly && (
                            <Button onClick={handleEditAgentShare} disabled={saving}>
                              {saving ? 'Updating...' : 'Update Share'}
                            </Button>
                          )}
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

                {/* Staff Tab */}
                <TabsContent value="staff" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Staff ({(selectedTrip as any)?.staff?.length || 0})</h3>
                    {!isReadOnly && (
                      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Staff
                          </Button>
                        </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Staff to Trip</DialogTitle>
                          <DialogDescription>
                            Select from available staff members ({(staff || []).filter(s => !((selectedTrip as any)?.staff || []).some((ts: any) => ts.staffId === s.id || ts.staff_id === s.id)).length} available)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {(() => {
                            console.log('🔍 Debug staff filtering:', {
                              allStaff: staff,
                              tripStaff: (selectedTrip as any)?.staff,
                              staffCount: staff?.length || 0,
                              tripStaffCount: ((selectedTrip as any)?.staff || []).length
                            });
                            
                            const availableStaff = (staff || [])
                              .filter(s => !((selectedTrip as any)?.staff || []).some((ts: any) => {
                                // Check multiple possible ID fields from the backend response
                                const tripStaffId = ts.staffId || ts.staff_id || ts.id;
                                const match = tripStaffId === s.id;
                                console.log('🔍 Checking staff match:', { 
                                  staffId: s.id, 
                                  staffName: s.name,
                                  tripStaffId, 
                                  tripStaff: ts,
                                  match 
                                });
                                return match;
                              }));
                              
                            console.log('✅ Available staff after filtering:', availableStaff);
                            
                            return availableStaff.map(staffMember => (
                              <div key={staffMember.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <div className="font-medium">{staffMember.name}</div>
                                  <div className="text-sm text-gray-500">{staffMember.email}</div>
                                  <div className="text-xs text-gray-400">Position: {staffMember.position}</div>
                                </div>
                                <Button size="sm" onClick={() => handleAddStaffToTrip(staffMember.id)} disabled={saving}>
                                  {saving ? 'Adding...' : 'Add'}
                                </Button>
                              </div>
                            ));
                          })()}
                          {(() => {
                            const availableStaff = (staff || [])
                              .filter(s => !((selectedTrip as any)?.staff || []).some((ts: any) => {
                                const tripStaffId = ts.staffId || ts.staff_id || ts.id;
                                return tripStaffId === s.id;
                              }));
                            return availableStaff.length === 0 && (
                              <p className="text-center text-gray-500 py-8">All staff members are already assigned to this trip</p>
                            );
                          })()}
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}
                  </div>

                  {(!selectedTrip || !(selectedTrip as any).staff || !Array.isArray((selectedTrip as any).staff) || (selectedTrip as any).staff.length === 0) ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No staff assigned to this trip</p>
                        <p className="text-xs text-gray-400 mt-2">Add staff members to help manage this trip</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {((selectedTrip as any).staff || []).map((staffMember: any) => (
                        <Card key={staffMember.id || staffMember.staff_id}>
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium">{staffMember.name || staffMember.staffName}</div>
                                    <div className="text-sm text-gray-500">{staffMember.email || staffMember.staffEmail}</div>
                                    <div className="text-xs text-gray-400">
                                      Position: {staffMember.position || staffMember.staffPosition}
                                    </div>
                                    {staffMember.created_at && (
                                      <div className="text-xs text-gray-400">
                                        Added: {new Date(staffMember.created_at).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {!isReadOnly && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRemoveStaffFromTrip(staffMember.staff_id || staffMember.id)}
                                      disabled={saving}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Staff Shift Photos - Using same logic as StaffManagement */}
                              {(() => {
                                // Load shifts for this staff member if not already loaded
                                const loadShifts = async () => {
                                  try {
                                    const shiftsResponse = await apiClient.get(`/staffs/${staffMember.staff_id || staffMember.staffId}/shifts`);
                                    if (shiftsResponse.success) {
                                      // Store shifts data in staffMember for display
                                      staffMember.shifts = shiftsResponse.data || [];
                                    }
                                  } catch (error) {
                                    console.error('❌ Error loading staff shifts:', error);
                                  }
                                };
                                
                                // Load shifts if not already loaded
                                if (!staffMember.shifts) {
                                  loadShifts();
                                }
                                
                                const shifts = staffMember.shifts || [];
                                
                                // Collect all check-in/out photos from shifts (same as StaffManagement)
                                const shiftPhotos: Array<{type: string, photo: string, date: string, shift_id: string, timestamp: number}> = [];
                                shifts.forEach((shift: any) => {
                                  if (shift.check_in_photo) {
                                    shiftPhotos.push({
                                      type: 'Check-in Photo',
                                      photo: shift.check_in_photo,
                                      date: new Date(shift.check_in_time).toLocaleString(),
                                      shift_id: shift.id,
                                      timestamp: new Date(shift.check_in_time).getTime()
                                    });
                                  }
                                  if (shift.check_out_photo) {
                                    shiftPhotos.push({
                                      type: 'Check-out Photo',
                                      photo: shift.check_out_photo,
                                      date: new Date(shift.check_out_time).toLocaleString(),
                                      shift_id: shift.id,
                                      timestamp: new Date(shift.check_out_time).getTime()
                                    });
                                  }
                                });
                                
                                // Sort photos by timestamp (newest first)
                                shiftPhotos.sort((a, b) => b.timestamp - a.timestamp);
                                
                                if (shiftPhotos.length === 0) {
                                  return (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                      <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Check-in/out Photos (0)
                                      </h5>
                                      <div className="text-center py-4 text-gray-500">
                                        <p className="text-sm">No check-in/out photos available</p>
                                        <p className="text-xs mt-1">Photos will appear here when staff check in/out</p>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Check-in/out Photos ({shiftPhotos.length})
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {shiftPhotos.map((item, index) => (
                                        <Card key={`photo-${item.shift_id}-${index}`} className="overflow-hidden">
                                          <CardContent className="p-3">
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <Badge variant={item.type.includes('Check-in') ? 'default' : 'secondary'} className="text-xs">
                                                  {item.type}
                                                </Badge>
                                                <Eye className="w-3 h-3 text-gray-400" />
                                              </div>
                                              
                                              <div className="aspect-square relative">
                                                <img
                                                  src={item.photo}
                                                  alt={item.type}
                                                  className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-80"
                                                  onClick={() => window.open(item.photo, '_blank')}
                                                />
                                              </div>
                                              
                                              <div>
                                                <p className="text-xs text-gray-500">{item.date}</p>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Expenses ({tripExpenses?.length || 0})</h3>
                    {!isReadOnly && (
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
                            <Label htmlFor="expenseAmount">Amount ({getCurrencySymbol(selectedTrip?.currency || 'HKD')})</Label>
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
                            <Label htmlFor="expenseDateTime">Date & Time</Label>
                            <Input
                              id="expenseDateTime"
                              type="datetime-local"
                              value={newExpense.datetime}
                              onChange={(e) => setNewExpense({...newExpense, datetime: e.target.value})}
                              required
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
                            {!isReadOnly && (
                              <Button onClick={handleAddExpense}>
                                Add Expense
                              </Button>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}
                  </div>

                  {/* Edit Expense Dialog */}
                  {!isReadOnly && (
                    <Dialog open={showEditExpense} onOpenChange={setShowEditExpense}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Expense</DialogTitle>
                          <DialogDescription>
                            Update the expense details
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="editExpenseDescription">Description</Label>
                            <Input
                              id="editExpenseDescription"
                              value={newExpense.description}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpense({...newExpense, description: e.target.value})}
                              placeholder="Expense description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="editExpenseAmount">Amount ({getCurrencySymbol(selectedTrip?.currency || 'HKD')})</Label>
                            <Input
                              id="editExpenseAmount"
                              type="number"
                              value={newExpense.amount}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                              placeholder="0.00"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="editExpenseDateTime">Date & Time</Label>
                            <Input
                              id="editExpenseDateTime"
                              type="datetime-local"
                              value={newExpense.datetime}
                              onChange={(e) => setNewExpense({...newExpense, datetime: e.target.value})}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="editExpenseCategory">Category</Label>
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
                            <Button variant="outline" onClick={() => {
                              setShowEditExpense(false);
                              setEditingExpense(null);
                              setNewExpense({
                                description: '',
                                amount: 0,
                                category: 'flight',
                                datetime: new Date().toISOString().slice(0, 16)
                              });
                            }}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateExpense} disabled={saving}>
                              {saving ? 'Updating...' : 'Update Expense'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Delete Expense Confirmation Dialog */}
                  {!isReadOnly && (
                    <AlertDialog open={showDeleteExpense} onOpenChange={setShowDeleteExpense}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this expense? This action cannot be undone.
                            <br /><br />
                            <strong>Expense:</strong> {deletingExpense?.description}
                            <br />
                            <strong>Amount:</strong> {deletingExpense && formatCurrency(deletingExpense.amount, viewingCurrency, selectedTrip)}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => {
                            setShowDeleteExpense(false);
                            setDeletingExpense(null);
                          }}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={confirmDeleteExpense}
                            disabled={saving}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {saving ? 'Deleting...' : 'Delete Expense'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

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
                        {!isReadOnly && (
                          <Button className="mt-4" onClick={() => setShowAddExpense(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Expense
                          </Button>
                        )}
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
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency((tripExpenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0), viewingCurrency, selectedTrip)}
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
                                {!isReadOnly && <TableHead className="text-center">Actions</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(tripExpenses || []).map(expense => (
                                <TableRow key={expense.id}>
                                  <TableCell className="font-medium">{expense.description}</TableCell>
                                  <TableCell className="capitalize">{expense.expense_type?.replace('_', ' ')}</TableCell>
                                  <TableCell>{expense.expense_date}</TableCell>
                                  <TableCell className="text-right font-medium text-red-600">
                                    {formatCurrency(expense.amount, viewingCurrency, selectedTrip)}
                                  </TableCell>
                                  {!isReadOnly && (
                                    <TableCell className="text-center">
                                      <div className="flex justify-center space-x-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditExpense(expense)}
                                          disabled={saving}
                                        >
                                          <Settings className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteExpense(expense)}
                                          disabled={saving}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
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
                              {formatCurrency(Math.abs(tripSharing.net_result), viewingCurrency, selectedTrip)}
                            </div>
                            <p className="text-xs text-gray-500">After all expenses and commissions</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Agent Share</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${
                              tripSharing.total_agent_share >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(Math.abs(tripSharing.total_agent_share), viewingCurrency, selectedTrip)}
                            </div>
                            <p className="text-xs text-gray-500">{tripSharing.agent_share_percentage}% of net result</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Company Share</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${
                              tripSharing.company_share >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(Math.abs(tripSharing.company_share), viewingCurrency, selectedTrip)}
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
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                              <span className="font-medium">Total Buy-in</span>
                              <span className="text-green-600 font-bold">{formatCurrency(tripSharing.total_buy_in, viewingCurrency, selectedTrip)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span className="font-medium">Total Cash-out</span>
                              <span className="text-red-600 font-bold">{formatCurrency(Math.abs(tripSharing.total_buy_out), viewingCurrency, selectedTrip)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-100 rounded">
                              <span className="font-medium">Gross Profit</span>
                              <span className={`font-bold ${
                                tripSharing.total_win_loss > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(Math.abs(tripSharing.total_win_loss), viewingCurrency, selectedTrip)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                              <span className="font-medium">Rolling Commission</span>
                              <span className="text-purple-600 font-bold">{formatCurrency(Math.abs(tripSharing.total_rolling_commission), viewingCurrency, selectedTrip)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span className="font-medium">Total Expenses</span>
                              <span className="text-red-600 font-bold">{formatCurrency(Math.abs(tripSharing.total_expenses), viewingCurrency, selectedTrip)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                              <span className="font-medium">Net Result</span>
                              <span className={`font-bold ${
                                tripSharing.net_result >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(Math.abs(tripSharing.net_result), viewingCurrency, selectedTrip)}
                              </span>
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
                                    <div className="text-sm text-gray-500">Profit Sharing Rate: {agentData.profit_sharing_rate}%</div>
                                  </div>
                                  <div className={`font-bold ${
                                    agentData.share_amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    HK${safeFormatNumber(Math.abs(agentData.share_amount))}
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

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction for {selectedCustomerForTransaction?.customerName || selectedCustomerForTransaction?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="transactionType">Transaction Type</Label>
              <Select
                value={transactionForm.type}
                onValueChange={(value) => setTransactionForm({...transactionForm, type: value})}
              >
                <SelectTrigger id="transactionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy-in">Buy In</SelectItem>
                  <SelectItem value="cash-out">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transactionAmount">Amount (HK$)</Label>
              <Input
                id="transactionAmount"
                type="number"
                placeholder="Enter amount"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                required
              />
              {!transactionForm.amount && (
                <p className="text-xs text-red-500 mt-1">Amount is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="transactionVenue" className="flex items-center">
                Venue <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={transactionForm.venue}
                onValueChange={(value) => setTransactionForm({...transactionForm, venue: value})}
                required
              >
                <SelectTrigger id="transactionVenue" className={!transactionForm.venue ? "border-red-300" : ""}>
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hoe Win VIP">Hoe Win VIP</SelectItem>
                  <SelectItem value="House Casino">House Casino</SelectItem>
                  <SelectItem value="Competition">Competition</SelectItem>
                </SelectContent>
              </Select>
              {!transactionForm.venue && (
                <p className="text-xs text-red-500 mt-1">Venue is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="transactionDateTime">Date & Time</Label>
              <Input
                id="transactionDateTime"
                type="datetime-local"
                value={transactionForm.datetime}
                onChange={(e) => setTransactionForm({...transactionForm, datetime: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setShowAddTransaction(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTransaction} 
              disabled={saving || !transactionForm.amount || !transactionForm.venue}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                'Add Transaction'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Rolling Dialog */}
      <Dialog open={showAddRolling} onOpenChange={setShowAddRolling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rolling</DialogTitle>
            <DialogDescription>
              Add rolling amount for {selectedCustomerForRolling?.customerName || selectedCustomerForRolling?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="staffMember">Staff Member <span className="text-red-500">*</span></Label>
              <Select
                value={rollingForm.staff_id}
                onValueChange={(value) => setRollingForm({...rollingForm, staff_id: value})}
              >
                <SelectTrigger id="staffMember" className={!rollingForm.staff_id ? "border-red-300" : ""}>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedTrip as any)?.staff?.map((staffMember: any) => (
                    <SelectItem 
                      key={staffMember.staffId || staffMember.staff_id} 
                      value={staffMember.staffId || staffMember.staff_id}
                    >
                      {staffMember.staffName || staffMember.staff?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!rollingForm.staff_id && (
                <p className="text-xs text-red-500 mt-1">Staff member is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="gameType">Game Type <span className="text-red-500">*</span></Label>
              <Select
                value={rollingForm.game_type}
                onValueChange={(value) => setRollingForm({...rollingForm, game_type: value})}
              >
                <SelectTrigger id="gameType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baccarat">Baccarat</SelectItem>
                  <SelectItem value="blackjack">Blackjack</SelectItem>
                  <SelectItem value="roulette">Roulette</SelectItem>
                  <SelectItem value="poker">Poker</SelectItem>
                  <SelectItem value="slots">Slots</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rollingAmount">Rolling Amount (HK$) <span className="text-red-500">*</span></Label>
              <Input
                id="rollingAmount"
                type="number"
                placeholder="Enter rolling amount"
                value={rollingForm.amount}
                onChange={(e) => setRollingForm({...rollingForm, amount: e.target.value})}
                className={!rollingForm.amount ? "border-red-300" : ""}
                required
              />
              {!rollingForm.amount && (
                <p className="text-xs text-red-500 mt-1">Rolling amount is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="rollingDateTime">Date & Time</Label>
              <Input
                id="rollingDateTime"
                type="datetime-local"
                value={rollingForm.datetime}
                onChange={(e) => setRollingForm({...rollingForm, datetime: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="rollingVenue" className="flex items-center">
                Venue <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={rollingForm.venue}
                onValueChange={(value) => setRollingForm({...rollingForm, venue: value})}
                required
              >
                <SelectTrigger id="rollingVenue" className={!rollingForm.venue ? "border-red-300" : ""}>
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hoe Win VIP">Hoe Win VIP</SelectItem>
                  <SelectItem value="House Casino">House Casino</SelectItem>
                  <SelectItem value="Competition">Competition</SelectItem>
                </SelectContent>
              </Select>
              {!rollingForm.venue && (
                <p className="text-xs text-red-500 mt-1">Venue is required</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowAddRolling(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddRolling} 
              disabled={saving || !rollingForm.amount || !rollingForm.staff_id || !rollingForm.venue}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                'Add Rolling'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Photos Dialog */}
      <Dialog open={showCustomerPhotos} onOpenChange={setShowCustomerPhotos}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Customer Photos - {selectedCustomerForPhotos?.customerName || selectedCustomerForPhotos?.customer?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Transaction and Rolling photos uploaded by staff
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {customerPhotos.length === 0 ? (
              <div className="text-center py-8">
                <Image className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No photos available for this customer</p>
                <p className="text-sm text-gray-400 mt-2">
                  Staff can upload transaction and rolling photos during operations
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Transaction Photos */}
                {customerPhotos.filter((photo: any) => photo.type === 'transaction' || photo.photo_type === 'transaction').length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium mb-3 flex items-center">
                      <span className="mr-2">💰</span>
                      Transaction Photos
                    </h4>
                    <PhotoDisplay
                      photos={customerPhotos
                        .filter((photo: any) => photo.type === 'transaction' || photo.photo_type === 'transaction')
                        .map((photo: any) => ({
                          id: photo.id,
                          photo: {
                            data: photo.file_data || photo.photo?.data,
                            filename: photo.file_name || photo.photo?.filename,
                            size: photo.file_size || photo.photo?.size,
                            type: photo.file_type || photo.photo?.type
                          },
                          status: photo.status,
                          upload_date: photo.uploaded_at || photo.upload_date,
                          transaction_date: photo.transaction_date
                        }))
                      }
                      type="transaction"
                      size="large"
                      maxPhotos={6}
                      showDownload={true}
                      userRole={currentUser.role}
                      customerName={selectedCustomerForPhotos?.customerName || selectedCustomerForPhotos?.customer?.name || selectedCustomerForPhotos?.name}
                    />
                  </div>
                )}

                {/* Rolling Photos */}
                {customerPhotos.filter((photo: any) => photo.type === 'rolling' || photo.photo_type === 'rolling').length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium mb-3 flex items-center">
                      <span className="mr-2">🎲</span>
                      Rolling Photos
                    </h4>
                    <PhotoDisplay
                      photos={customerPhotos
                        .filter((photo: any) => photo.type === 'rolling' || photo.photo_type === 'rolling')
                        .map((photo: any) => ({
                          id: photo.id,
                          photo: {
                            data: photo.file_data || photo.photo?.data,
                            filename: photo.file_name || photo.photo?.filename,
                            size: photo.file_size || photo.photo?.size,
                            type: photo.file_type || photo.photo?.type
                          },
                          status: photo.status,
                          upload_date: photo.uploaded_at || photo.upload_date,
                          transaction_date: photo.transaction_date
                        }))
                      }
                      type="rolling"
                      size="large"
                      maxPhotos={6}
                      showDownload={true}
                      userRole={currentUser.role}
                      customerName={selectedCustomerForPhotos?.customerName || selectedCustomerForPhotos?.customer?.name || selectedCustomerForPhotos?.name}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowCustomerPhotos(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={showEditTransaction} onOpenChange={setShowEditTransaction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Edit transaction details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTransactionType">Transaction Type</Label>
              <Select
                value={transactionForm.type}
                onValueChange={(value) => setTransactionForm({...transactionForm, type: value})}
              >
                <SelectTrigger id="editTransactionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy-in">Buy In</SelectItem>
                  <SelectItem value="cash-out">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editTransactionAmount">Amount (HK$)</Label>
              <Input
                id="editTransactionAmount"
                type="number"
                placeholder="Enter amount"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="editTransactionVenue">Venue</Label>
              <Select
                value={transactionForm.venue}
                onValueChange={(value) => setTransactionForm({...transactionForm, venue: value})}
              >
                <SelectTrigger id="editTransactionVenue">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hoe Win VIP">Hoe Win VIP</SelectItem>
                  <SelectItem value="House Casino">House Casino</SelectItem>
                  <SelectItem value="Competition">Competition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editTransactionDateTime">Date & Time</Label>
              <Input
                id="editTransactionDateTime"
                type="datetime-local"
                value={transactionForm.datetime}
                onChange={(e) => setTransactionForm({...transactionForm, datetime: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setShowEditTransaction(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTransaction} disabled={saving || !transactionForm.amount}>
              {saving ? 'Updating...' : 'Update Transaction'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rolling Dialog */}
      <Dialog open={showEditRolling} onOpenChange={setShowEditRolling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rolling</DialogTitle>
            <DialogDescription>
              Edit rolling record details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editRollingAmount">Amount (HK$)</Label>
              <Input
                id="editRollingAmount"
                type="number"
                placeholder="Enter amount"
                value={rollingForm.amount}
                onChange={(e) => setRollingForm({...rollingForm, amount: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="editRollingStaff">Staff Member</Label>
              <Select
                value={rollingForm.staff_id}
                onValueChange={(value) => setRollingForm({...rollingForm, staff_id: value})}
              >
                <SelectTrigger id="editRollingStaff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedTrip as any)?.staff?.map((staffMember: any) => (
                    <SelectItem 
                      key={staffMember.staffId || staffMember.staff_id} 
                      value={staffMember.staffId || staffMember.staff_id}
                    >
                      {staffMember.staffName || staffMember.staff?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editRollingGameType">Game Type</Label>
              <Select
                value={rollingForm.game_type}
                onValueChange={(value) => setRollingForm({...rollingForm, game_type: value})}
              >
                <SelectTrigger id="editRollingGameType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baccarat">Baccarat</SelectItem>
                  <SelectItem value="blackjack">Blackjack</SelectItem>
                  <SelectItem value="roulette">Roulette</SelectItem>
                  <SelectItem value="poker">Poker</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editRollingVenue">Venue</Label>
              <Select
                value={rollingForm.venue}
                onValueChange={(value) => setRollingForm({...rollingForm, venue: value})}
              >
                <SelectTrigger id="editRollingVenue">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hoe Win VIP">Hoe Win VIP</SelectItem>
                  <SelectItem value="House Casino">House Casino</SelectItem>
                  <SelectItem value="Competition">Competition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editRollingDateTime">Date & Time</Label>
              <Input
                id="editRollingDateTime"
                type="datetime-local"
                value={rollingForm.datetime}
                onChange={(e) => setRollingForm({...rollingForm, datetime: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setShowEditRolling(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRolling} disabled={saving || !rollingForm.amount}>
              {saving ? 'Updating...' : 'Update Rolling'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profit Sharing Rate Dialog */}
      <Dialog open={showEditProfitSharing} onOpenChange={setShowEditProfitSharing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profit Sharing Rate</DialogTitle>
            <DialogDescription>
              Adjust the profit sharing rate for this agent-customer relationship
            </DialogDescription>
          </DialogHeader>
          
          {editingProfitSharing && (
            <div className="space-y-4">
              {/* Agent and Customer Info */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Agent:</span>
                    <div>{editingProfitSharing.agentName}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Customer:</span>
                    <div>{editingProfitSharing.customerName}</div>
                  </div>
                </div>
              </div>

              {/* Current Rate */}
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="font-medium text-blue-800">Current Rate:</span>
                <span className="text-xl font-bold text-blue-600">{editingProfitSharing.currentRate}%</span>
              </div>

              {/* New Rate Input */}
              <div className="space-y-2">
                <Label htmlFor="newRate">New Profit Sharing Rate (%)</Label>
                <Input
                  id="newRate"
                  type="number"
                  value={newProfitSharingRate}
                  onChange={(e) => setNewProfitSharingRate(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  className="text-lg"
                />
              </div>

              {/* Customer Net Result and Projected Share */}
              {(() => {
                // Find customer stats for this customer
                const customerStats = selectedTrip?.customers?.find((c: any) => 
                  c.customer_id === editingProfitSharing.customerId || c.customerId === editingProfitSharing.customerId
                );
                const netResult = (customerStats as any)?.net_result || 0;
                const projectedShare = calculateProjectedProfitShare(netResult, newProfitSharingRate);

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Customer Net Result</div>
                        <div className={`text-lg font-bold ${
                          netResult >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrencyWithSign(netResult, viewingCurrency, selectedTrip)}
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <div className="text-sm text-gray-600">Projected Profit Share</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(projectedShare, viewingCurrency, selectedTrip)}
                        </div>
                      </div>
                    </div>
                    
                    {netResult <= 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="text-sm text-yellow-800">
                          <strong>Note:</strong> Customer has negative or zero net result. 
                          Profit sharing only applies to positive customer profits.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Rate Change Summary */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
                <div className="text-sm text-indigo-800">
                  <strong>Rate Change:</strong> {editingProfitSharing.currentRate}% → {newProfitSharingRate}%
                  <span className="ml-2">
                    ({newProfitSharingRate > editingProfitSharing.currentRate ? '+' : ''}
                    {(newProfitSharingRate - editingProfitSharing.currentRate).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditProfitSharing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProfitSharing}
              disabled={saving || !editingProfitSharing}
            >
              {saving ? 'Updating...' : 'Update Rate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default ProjectManagementComponent;