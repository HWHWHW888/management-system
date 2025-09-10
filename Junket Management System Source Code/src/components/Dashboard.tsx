import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Users, UserCheck, TrendingUp, TrendingDown, DollarSign, Receipt, Trophy, Target, 
  MapPin, PieChart, Percent, Building, Calendar, UserPlus, Activity, Database, 
  RefreshCw, CheckCircle, AlertTriangle, Clock, Wifi, WifiOff, ArrowUpCircle, ArrowDownCircle,
  Coffee, Zap, BarChart3, Gamepad2
} from 'lucide-react';
import { db } from '../utils/supabase/supabaseClients';
import { apiClient } from '../utils/api/apiClient';

// Type definitions
interface User {
  id: string;
  role: string;
  agentId?: string;
}

interface Agent {
  id: string;
  status: string;
}

interface Customer {
  id: string;
  customerId?: string;
  customer_id?: string;
  name?: string;
  agentName?: string;
  isActive: boolean;
  agentId?: string;
  totalRolling?: number;
  totalWinLoss?: number;
  totalBuyIn?: number;
  totalBuyOut?: number;
  attachments?: any[];
  isAgent?: boolean;
  rollingPercentage?: number;
  creditLimit?: number;
  availableCredit?: number;
}

interface Trip {
  id: string;
  status: string;
  agentId?: string;
  agents?: any[];
  customers?: any[];
  expenses?: any[];
  totalRolling?: number;
  totalWinLoss?: number;
  totalBuyIn?: number;
  totalBuyOut?: number;
  calculatedTotalRolling?: number;
  attachments?: any[];
  // Trip details
  trip_name?: string;
  name?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  sharing?: {
    // Support both camelCase (fallback) and snake_case (API response) formats
    totalWinLoss?: number;
    total_win_loss?: number;
    totalExpenses?: number;
    total_expenses?: number;
    netResult?: number;
    net_result?: number;
    companyShare?: number;
    company_share?: number;
    agentShare?: number;
    total_agent_share?: number;
    totalRollingCommission?: number;
    total_rolling_commission?: number;
    totalBuyIn?: number;
    total_buy_in?: number;
    totalBuyOut?: number;
    total_buy_out?: number;
    netCashFlow?: number;
    net_cash_flow?: number;
    totalAgentShare?: number;
    agentSharePercentage?: number;
    agent_share_percentage?: number;
    companySharePercentage?: number;
    company_share_percentage?: number;
    agentBreakdown?: any[];
    agent_breakdown?: any[];
  };
}

interface RollingRecord {
  id: string;
  customerId?: string;
  customer_id?: string;
  tripId?: string;
  trip_id?: string;
  recordedAt: string;
  rollingAmount?: number;
  rolling_amount?: number;
  winLoss?: number;
  win_loss?: number;
}

interface BuyInOutRecord {
  id: string;
  customerId?: string;
  customer_id?: string;
  tripId?: string;
  trip_id?: string;
  timestamp: string;
  transactionType?: string;
  transaction_type?: string;
  amount: number;
}

interface DashboardProps {
  user: User;
}

// Real-time refresh interval (30 seconds)
const REAL_TIME_REFRESH_INTERVAL = 30000;

export function Dashboard({ user }: DashboardProps) {
  // Data states with real-time updates
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rollingRecords, setRollingRecords] = useState<RollingRecord[]>([]);
  const [buyInOutRecords, setBuyInOutRecords] = useState<BuyInOutRecord[]>([]);
  
  // Loading and sync states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);

  // Helper functions
  const safeFormatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    return value.toLocaleString();
  };

  const safeNumber = (value: number | undefined | null): number => {
    if (value === undefined || value === null || isNaN(value)) {
      return 0;
    }
    return value;
  };

  // Real-time data loading from Supabase with API integration
  const loadRealTimeData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMessage('');
      
      console.log('🔄 Loading real-time dashboard data from API...');
      
      // Load all required data from API in parallel
      const [agentsData, customersData, transactionsData, tripsApiResponse] = await Promise.all([
        db.get('agents', []),
        db.get('customers', []),
        db.get('transactions', []),
        apiClient.getTripsWithSharing()
      ]);

      const tripsData = tripsApiResponse.data || [];

      console.log('📊 Dashboard data loaded:', {
        agents: Array.isArray(agentsData) ? agentsData.length : 0,
        customers: Array.isArray(customersData) ? customersData.length : 0,
        trips: Array.isArray(tripsData) ? tripsData.length : 0,
        transactions: Array.isArray(transactionsData) ? transactionsData.length : 0
      });

      // Debug: Log sample data
      if (Array.isArray(customersData) && customersData.length > 0) {
        console.log('🔍 Sample customer data:', customersData[0]);
      }
      if (Array.isArray(tripsData) && tripsData.length > 0) {
        console.log('🔍 Sample trip data with sharing:', tripsData[0]);
      }
      if (Array.isArray(transactionsData) && transactionsData.length > 0) {
        console.log('🔍 Sample transaction data:', transactionsData[0]);
      }

      // Process customers - use database totals directly
      const processedCustomers = (Array.isArray(customersData) ? customersData : []).map((customer: any) => {
        return {
          ...customer,
          id: customer.id,
          name: customer.name,
          agentName: customer.agent_name,
          isActive: customer.status === 'active',
          totalRolling: parseFloat(customer.total_rolling) || 0,
          totalWinLoss: parseFloat(customer.total_win_loss) || 0,
          totalBuyIn: parseFloat(customer.total_buy_in) || 0,
          totalBuyOut: parseFloat(customer.total_buy_out) || 0,
          attachments: customer.attachments || [],
          isAgent: customer.is_agent || false,
          rollingPercentage: parseFloat(customer.rolling_percentage) || 1.4,
          creditLimit: parseFloat(customer.credit_limit) || 0,
          availableCredit: parseFloat(customer.available_credit) || 0
        };
      });

      // Process trips - preserve sharing data from API directly
      const processedTrips = (Array.isArray(tripsData) ? tripsData : []).map((trip: any) => {
        console.log('🔍 Processing trip:', trip.trip_name, 'sharing data:', trip.sharing);
        return {
          ...trip,
          attachments: trip.attachments || []
          // Don't override sharing - keep original API data
        };
      });

      // Set processed data
      setAgents(agentsData);
      setCustomers(processedCustomers);
      setTrips(processedTrips);
      setRollingRecords([]); // No longer extracting from trips
      setBuyInOutRecords(transactionsData || []);
      setLastSyncTime(new Date());
      setConnectionStatus('connected');
      
      console.log(`✅ Real-time dashboard data loaded: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips with sharing data`);
      
    } catch (error) {
      console.error('❌ Error loading real-time dashboard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Failed to load dashboard data: ${errorMessage}`);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Real-time data sync with automatic refresh
  useEffect(() => {
    loadRealTimeData();
    
    // Set up real-time refresh interval
    let refreshInterval: NodeJS.Timeout;
    if (isRealTimeEnabled) {
      refreshInterval = setInterval(() => {
        console.log('🔄 Real-time dashboard refresh triggered');
        loadRealTimeData();
      }, REAL_TIME_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [loadRealTimeData, isRealTimeEnabled]);

  // Toggle real-time updates
  const toggleRealTime = () => {
    setIsRealTimeEnabled(!isRealTimeEnabled);
    if (!isRealTimeEnabled) {
      loadRealTimeData(); // Refresh immediately when re-enabling
    }
  };

  // Filter data based on user role
  const getFilteredData = () => {
    let filteredCustomers = customers;
    let filteredTrips = trips;

    if (user.role === 'agent' && user.agentId) {
      filteredCustomers = customers.filter(c => c.agentId === user.agentId);
      filteredTrips = trips.filter(t => 
        (t.agents && t.agents.some(agent => agent.agentId === user.agentId)) ||
        t.agentId === user.agentId
      );
    }

    return { filteredCustomers, filteredTrips };
  };

  const { filteredCustomers, filteredTrips } = getFilteredData();

  // Calculate comprehensive metrics from real-time data
  const calculateMetrics = () => {
    // Trip-based financial metrics
    const tripTotalRolling = filteredTrips.reduce((sum, trip) => sum + safeNumber(trip.totalRolling), 0);
    const tripTotalWinLoss = filteredTrips.reduce((sum, trip) => sum + safeNumber(trip.totalWinLoss), 0);
    const totalRollingCommission = filteredTrips.reduce((sum, trip) => sum + safeNumber(trip.calculatedTotalRolling), 0);
    const totalExpenses = filteredTrips.reduce((sum, trip) => 
      sum + (trip.expenses || []).reduce((expSum, exp) => expSum + safeNumber(exp.amount), 0), 0
    );

    // Customer metrics
    const totalCustomers = filteredCustomers.length;
    const activeCustomers = filteredCustomers.filter(c => c.isActive).length;
    const customerTotalRolling = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalRolling), 0);
    const customerTotalWinLoss = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalWinLoss), 0);
    const customerTotalBuyIn = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalBuyIn), 0);
    const customerTotalBuyOut = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalBuyOut), 0);

    // Agent metrics
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.status === 'active').length;

    // Trip metrics
    const totalTrips = filteredTrips.length;
    const completedTrips = filteredTrips.filter(t => t.status === 'completed').length;
    const ongoingTrips = filteredTrips.filter(t => t.status === 'ongoing').length;
    const plannedTrips = filteredTrips.filter(t => t.status === 'planned').length;

    // Calculate metrics from trip_sharing table data (all trips, no filtering)
    console.log('🔍 Debug trips data for calculations:', trips.length);
    trips.forEach((trip, index) => {
      console.log(`Trip ${index + 1} (${trip.trip_name}):`, {
        hasSharing: !!trip.sharing,
        sharingKeys: trip.sharing ? Object.keys(trip.sharing) : 'no sharing',
        sharingData: trip.sharing
      });
    });
    
    const tripSharingGrossProfit = trips.reduce((sum, trip) => {
      const value = Math.abs(safeNumber(trip.sharing?.total_win_loss || trip.sharing?.totalWinLoss));
      console.log(`Trip ${trip.trip_name}: total_win_loss = ${trip.sharing?.total_win_loss}, contributing ${value} to gross profit`);
      return sum + value;
    }, 0);
    
    const tripSharingExpenses = trips.reduce((sum, trip) => {
      const value = Math.abs(safeNumber(trip.sharing?.total_expenses || trip.sharing?.totalExpenses));
      console.log(`Trip ${trip.trip_name}: total_expenses = ${trip.sharing?.total_expenses}, contributing ${value} to expenses`);
      return sum + value;
    }, 0);
    
    const tripSharingNetProfit = trips.reduce((sum, trip) => {
      const value = safeNumber(trip.sharing?.company_share || trip.sharing?.companyShare);
      console.log(`Trip ${trip.trip_name}: company_share = ${trip.sharing?.company_share}, contributing ${value} to net profit`);
      return sum + value;
    }, 0);
    
    console.log('📊 Final calculations:', {
      tripSharingGrossProfit,
      tripSharingExpenses, 
      tripSharingNetProfit
    });

    // House performance calculations (using trip_sharing data)
    const houseGrossWin = tripSharingGrossProfit;
    const houseNetWin = houseGrossWin - totalRollingCommission;
    const houseFinalProfit = tripSharingNetProfit;

    // Performance ratios
    const profitMargin = customerTotalRolling > 0 ? ((houseFinalProfit / customerTotalRolling) * 100) : 0;
    const expenseRatio = customerTotalRolling > 0 ? ((totalExpenses / customerTotalRolling) * 100) : 0;
    const commissionRatio = customerTotalRolling > 0 ? ((totalRollingCommission / customerTotalRolling) * 100) : 0;

    // Recent activity metrics
    const recentRollingRecords = rollingRecords.filter(record => 
      (Date.now() - new Date(record.recordedAt).getTime()) < 24 * 60 * 60 * 1000
    ).length;

    const recentBuyInOutRecords = buyInOutRecords.filter(record => 
      (Date.now() - new Date(record.timestamp).getTime()) < 24 * 60 * 60 * 1000
    ).length;

    return {
      // Trip metrics
      tripTotalRolling,
      tripTotalWinLoss,
      totalRollingCommission,
      totalExpenses: tripSharingExpenses,
      
      // Customer metrics
      totalCustomers,
      activeCustomers,
      customerTotalRolling,
      customerTotalWinLoss,
      customerTotalBuyIn,
      customerTotalBuyOut,
      
      // Agent metrics
      totalAgents,
      activeAgents,
      
      // Trip counts
      totalTrips,
      completedTrips,
      ongoingTrips,
      plannedTrips,
      
      // House performance
      houseGrossWin,
      houseNetWin,
      houseFinalProfit,
      
      // Ratios
      profitMargin,
      expenseRatio,
      commissionRatio,
      
      // Activity
      recentRollingRecords,
      recentBuyInOutRecords,
      totalRollingRecords: rollingRecords.length,
      totalBuyInOutRecords: buyInOutRecords.length
    };
  };

  const metrics = calculateMetrics();

  // Filter active trips with real-time data enrichment
  const activeTrips = filteredTrips.filter(trip => 
    trip.status && ['active', 'in-progress', 'ongoing'].includes(trip.status.toLowerCase())
  ).map(trip => {
    // Enrich trip data with real-time calculations
    const tripTransactions = buyInOutRecords.filter(t => t.trip_id === trip.id);
    const tripCustomers = filteredCustomers.filter(c => 
      trip.customers?.some(tc => tc.customerId === c.id || tc.customer_id === c.id)
    );
    
    // Calculate real-time totals from transactions
    const buyInTotal = tripTransactions
      .filter(t => t.transaction_type === 'buy-in')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const buyOutTotal = tripTransactions
      .filter(t => t.transaction_type === 'cash-out')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Get rolling data from rolling records
    const tripRollingRecords = rollingRecords.filter(r => r.trip_id === trip.id);
    const totalRollingFromRecords = tripRollingRecords
      .reduce((sum, r) => sum + (r.rolling_amount || 0), 0);
    const totalWinLossFromRecords = tripRollingRecords
      .reduce((sum, r) => sum + (r.win_loss || 0), 0);
    
    return {
      ...trip,
      customers: tripCustomers,
      totalBuyIn: Math.max(trip.totalBuyIn || 0, buyInTotal),
      totalBuyOut: Math.max(trip.totalBuyOut || 0, buyOutTotal),
      totalRolling: Math.max(trip.totalRolling || 0, totalRollingFromRecords),
      totalWinLoss: totalWinLossFromRecords !== 0 ? totalWinLossFromRecords : (trip.totalWinLoss || 0),
      // Update sharing data with real-time values
      sharing: {
        ...trip.sharing,
        totalBuyIn: Math.max(trip.sharing?.totalBuyIn || 0, buyInTotal),
        totalBuyOut: Math.max(trip.sharing?.totalBuyOut || 0, buyOutTotal),
        totalRollingCommission: Math.max(trip.sharing?.totalRollingCommission || 0, totalRollingFromRecords),
        totalWinLoss: totalWinLossFromRecords !== 0 ? totalWinLossFromRecords : (trip.sharing?.totalWinLoss || 0),
        netCashFlow: Math.max(trip.sharing?.totalBuyOut || 0, buyOutTotal) - Math.max(trip.sharing?.totalBuyIn || 0, buyInTotal)
      }
    };
  });

  const getWinLossStatus = (winLoss: number) => {
    if (winLoss === 0) {
      return { text: 'Break Even', icon: Target, color: 'text-gray-600' };
    } else if (winLoss > 0) {
      return { text: 'Junket Loss', icon: TrendingDown, color: 'text-red-600' };
    } else {
      return { text: 'Junket Profit', icon: Trophy, color: 'text-green-600' };
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading real-time dashboard data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Real-time Status Header */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="w-5 h-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-green-800">
                ✅ Real-time Dashboard - Live Data from Supabase
              </p>
              <p className="text-xs text-green-600">
                Dashboard automatically updates every 30 seconds with live rolling amounts, customer data, and trip information.
                {lastSyncTime && ` • Last sync: ${lastSyncTime.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {refreshing && (
              <div className="flex items-center text-blue-600">
                <Activity className="w-4 h-4 mr-1 animate-pulse" />
                <span className="text-xs">Syncing...</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadRealTimeData}
              disabled={refreshing}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleRealTime}
              className="text-xs"
            >
              <Zap className={`w-3 h-3 mr-1 ${isRealTimeEnabled ? 'text-green-500' : 'text-gray-500'}`} />
              {isRealTimeEnabled ? 'Live' : 'Manual'}
            </Button>
            <Badge variant="outline" className={`text-xs ${connectionStatus === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full mr-1 ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              {connectionStatus === 'connected' ? 'Connected' : 'Error'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Connection Error:</strong> {errorMessage}
            <Button
              onClick={loadRealTimeData}
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

      {/* Key Performance Metrics - Real-time Customer Data */}
      <div>
        <h3 className="text-lg font-medium mb-4">Real-time Financial Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Total Rolling Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">HK${safeFormatNumber(metrics.customerTotalRolling)}</div>
              <p className="text-xs text-blue-600">
                From {metrics.totalRollingRecords} rolling records across {metrics.totalCustomers} customers
              </p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-r ${metrics.houseGrossWin >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metrics.houseGrossWin >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                Company Gross Profit
              </CardTitle>
              {metrics.houseGrossWin >= 0 ? (
                <Trophy className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.houseGrossWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                HK${safeFormatNumber(metrics.houseGrossWin)}
              </div>
              <p className={`text-xs ${metrics.houseGrossWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                From trip sharing win/loss data
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">HK${safeFormatNumber(metrics.totalExpenses)}</div>
              <p className="text-xs text-red-600">
                Total operational expenses from trip sharing
              </p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-r ${metrics.houseFinalProfit >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metrics.houseFinalProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                Company Net Profit
              </CardTitle>
              {metrics.houseFinalProfit >= 0 ? (
                <Trophy className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.houseFinalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                HK${safeFormatNumber(metrics.houseFinalProfit)}
              </div>
              <p className={`text-xs ${metrics.houseFinalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Company share from trip sharing
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Secondary Metrics - Operations Overview */}
      <div>
        <h3 className="text-lg font-medium mb-4">Operations Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCustomers}</div>
              <p className="text-xs text-muted-foreground">
                of {metrics.totalCustomers} total customers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeAgents}</div>
              <p className="text-xs text-muted-foreground">
                of {metrics.totalAgents} total agents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trip Summary</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTrips}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.completedTrips} completed, {metrics.ongoingTrips} ongoing, {metrics.plannedTrips} planned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.recentRollingRecords + metrics.recentBuyInOutRecords}</div>
              <p className="text-xs text-muted-foreground">
                Transactions in last 24 hours
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Trips */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Active Trips</CardTitle>
          <CardDescription>
            Current ongoing trips with real-time performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTrips.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No active trips found</p>
              <p className="text-xs text-gray-400 mt-1">Active trips will appear here when trips are in progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTrips
                .slice(0, 5) // Show up to 5 trips to match customer performance section
                .map((trip) => {
                  const totalRolling = trip.sharing?.totalRollingCommission || trip.totalRolling || 0;
                  const winLoss = trip.sharing?.totalWinLoss || trip.totalWinLoss || 0;
                  const expenses = trip.sharing?.totalExpenses || trip.sharing?.total_expenses || 0;
                  const cashFlow = (trip.sharing?.totalBuyOut || trip.totalBuyOut || 0) - (trip.sharing?.totalBuyIn || trip.totalBuyIn || 0);
                  
                  // Calculate progress based on dates
                  const startDate = trip.start_date ? new Date(trip.start_date) : null;
                  const endDate = trip.end_date ? new Date(trip.end_date) : null;
                  const now = new Date();
                  let progress = 0;
                  
                  if (startDate && endDate) {
                    const totalDuration = endDate.getTime() - startDate.getTime();
                    const elapsed = now.getTime() - startDate.getTime();
                    progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                  }
                  
                  return (
                    <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                            {trip.status === 'active' ? 'Active' : 'Ongoing'}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-medium">{trip.trip_name || trip.name || 'Unnamed Trip'}</p>
                          <p className="text-sm text-gray-500 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {trip.destination || 'Unknown Destination'} • {trip.customers?.length || 0} customers
                          </p>
                          <p className="text-xs text-blue-600">
                            Progress: {Math.round(progress)}% • {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'TBD'} - {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'TBD'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-right text-xs">
                        <div>
                          <div className="text-gray-500">Rolling</div>
                          <div className="font-medium text-blue-600">HK${safeFormatNumber(totalRolling)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Win/Loss</div>
                          <div className={`font-medium ${
                            winLoss <= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber(Math.abs(winLoss))}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Expenses</div>
                          <div className="font-medium text-red-600">HK${safeFormatNumber(expenses)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Cash Flow</div>
                          <div className={`font-medium ${
                            cashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber(cashFlow)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Customer Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Customer Performance</CardTitle>
          <CardDescription>
            Top performing customers based on live rolling data {user.role === 'agent' ? 'you manage' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customer data found</p>
              <p className="text-xs text-gray-400 mt-1">Customer performance will appear here once rolling records are created</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers
                .sort((a, b) => safeNumber(b.totalRolling) - safeNumber(a.totalRolling))
                .slice(0, 5)
                .map((customer) => {
                  const indicator = getWinLossStatus(customer.totalWinLoss || 0);
                  const Icon = indicator.icon;
                  const commission = (customer.totalRolling || 0) * ((customer.rollingPercentage || 0) / 100);
                  
                  return (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <Icon className={`h-5 w-5 ${indicator.color}`} />
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-500">
                            Agent: {customer.agentName} • {customer.isActive ? 'Active' : 'Inactive'}
                          </p>
                          <p className="text-xs text-purple-600">
                            Commission Rate: {customer.rollingPercentage}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-right text-xs">
                        <div>
                          <div className="text-gray-500">Rolling</div>
                          <div className="font-medium text-blue-600">HK${safeFormatNumber(customer.totalRolling)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Win/Loss</div>
                          <div className={`font-medium ${
                            (customer.totalWinLoss || 0) <= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber(Math.abs(customer.totalWinLoss || 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Commission</div>
                          <div className="font-medium text-purple-600">HK${safeFormatNumber(commission)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Cash Flow</div>
                          <div className={`font-medium ${
                            ((customer.totalBuyOut || 0) - (customer.totalBuyIn || 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber((customer.totalBuyOut || 0) - (customer.totalBuyIn || 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}