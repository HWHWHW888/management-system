import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { User, Agent, Customer, Trip, RollingRecord, BuyInOutRecord } from '../types';
import { 
  Users, UserCheck, TrendingUp, TrendingDown, DollarSign, Receipt, Trophy, Target, 
  MapPin, PieChart, Percent, Building, Calendar, UserPlus, Activity, Database, 
  RefreshCw, CheckCircle, AlertTriangle, Clock, Wifi, ArrowUpCircle, ArrowDownCircle,
  Coffee, Zap, BarChart3, TrendingUp as TrendingUpIcon, Gamepad2
} from 'lucide-react';
import { db } from '../utils/supabase/supabaseClients';

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

  // Real-time data loading from Supabase
  const loadRealTimeData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMessage('');
      
      console.log('🔄 Loading real-time dashboard data from Supabase...');
      
      // Load all required data from Supabase in parallel
      const [agentsData, customersData, tripsData, rollingData, buyInOutData] = await Promise.all([
        db.get('agents', []),
        db.get('customers', []),
        db.get('trips', []),
        db.get('rolling_records', []),
        db.get('buy_in_out_records', [])
      ]);

      // Process customers with real-time rolling calculations
      const processedCustomers = customersData.map((customer: Customer) => {
        // Calculate real-time totals from rolling records
        const customerRollingRecords = rollingData.filter((record: any) => record.customerId === customer.id);
        const customerBuyInOutRecords = buyInOutData.filter((record: any) => record.customerId === customer.id);
        
        const realTimeRolling = customerRollingRecords.reduce((sum: number, record: any) => sum + (record.rollingAmount || 0), 0);
        const realTimeWinLoss = customerRollingRecords.reduce((sum: number, record: any) => sum + (record.winLoss || 0), 0);
        const realTimeBuyIn = customerBuyInOutRecords
          .filter((record: any) => record.transactionType === 'buy-in')
          .reduce((sum: number, record: any) => sum + record.amount, 0);
        const realTimeBuyOut = customerBuyInOutRecords
          .filter((record: any) => record.transactionType === 'buy-out')
          .reduce((sum: number, record: any) => sum + record.amount, 0);

        return {
          ...customer,
          // Real-time financial calculations
          totalRolling: realTimeRolling,
          totalWinLoss: realTimeWinLoss,
          totalBuyIn: realTimeBuyIn,
          totalBuyOut: realTimeBuyOut,
          // Ensure backward compatibility
          attachments: customer.attachments || [],
          isAgent: customer.isAgent || false,
          rollingPercentage: customer.rollingPercentage || 1.4,
          creditLimit: customer.creditLimit || 0,
          availableCredit: customer.availableCredit || 0
        };
      });

      // Process trips with real-time calculations
      const processedTrips = tripsData.map((trip: Trip) => {
        // Calculate trip totals from rolling records for this trip's customers
        const tripCustomerIds = trip.customers?.map(c => c.customerId) || [];
        const tripRollingRecords = rollingData.filter((record: any) => 
          tripCustomerIds.includes(record.customerId)
        );
        const tripBuyInOutRecords = buyInOutData.filter((record: any) => 
          tripCustomerIds.includes(record.customerId)
        );

        const tripTotalRolling = tripRollingRecords.reduce((sum: number, record: any) => sum + (record.rollingAmount || 0), 0);
        const tripTotalWinLoss = tripRollingRecords.reduce((sum: number, record: any) => sum + (record.winLoss || 0), 0);
        const tripTotalBuyIn = tripBuyInOutRecords
          .filter((record: any) => record.transactionType === 'buy-in')
          .reduce((sum: number, record: any) => sum + record.amount, 0);
        const tripTotalBuyOut = tripBuyInOutRecords
          .filter((record: any) => record.transactionType === 'buy-out')
          .reduce((sum: number, record: any) => sum + record.amount, 0);

        const calculatedTotalRolling = tripTotalRolling * 0.014; // Default 1.4% commission

        return {
          ...trip,
          totalRolling: tripTotalRolling,
          totalWinLoss: tripTotalWinLoss,
          totalBuyIn: tripTotalBuyIn,
          totalBuyOut: tripTotalBuyOut,
          calculatedTotalRolling,
          attachments: trip.attachments || [],
          sharing: trip.sharing || {
            totalWinLoss: tripTotalWinLoss,
            totalExpenses: 0,
            totalRollingCommission: calculatedTotalRolling,
            totalBuyIn: tripTotalBuyIn,
            totalBuyOut: tripTotalBuyOut,
            netCashFlow: tripTotalBuyOut - tripTotalBuyIn,
            netResult: 0,
            totalAgentShare: 0,
            companyShare: 0,
            agentSharePercentage: 0,
            companySharePercentage: 100,
            agentBreakdown: []
          }
        };
      });

      // Set processed data
      setAgents(agentsData);
      setCustomers(processedCustomers);
      setTrips(processedTrips);
      setRollingRecords(rollingData);
      setBuyInOutRecords(buyInOutData);
      setLastSyncTime(new Date());
      setConnectionStatus('connected');
      
      console.log(`✅ Real-time dashboard data loaded: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips, ${rollingData.length} rolling records`);
      
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
    const activeAgents = agents.filter(a => a.isActive).length;

    // Trip metrics
    const totalTrips = filteredTrips.length;
    const completedTrips = filteredTrips.filter(t => t.status === 'completed').length;
    const ongoingTrips = filteredTrips.filter(t => t.status === 'ongoing').length;
    const plannedTrips = filteredTrips.filter(t => t.status === 'planned').length;

    // House performance calculations
    const houseGrossWin = -customerTotalWinLoss; // Customer loss = House win
    const houseNetWin = houseGrossWin - totalRollingCommission;
    const houseFinalProfit = houseNetWin - totalExpenses;

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
      totalExpenses,
      
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

  const getWinLossIndicator = (winLoss: number) => {
    if (winLoss === 0) {
      return { text: 'Break Even', icon: Target, color: 'text-gray-600' };
    } else if (winLoss > 0) {
      return { text: 'Customer Win', icon: TrendingUp, color: 'text-red-600' };
    } else {
      return { text: 'House Win', icon: Trophy, color: 'text-green-600' };
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

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Customer Win/Loss</CardTitle>
              {metrics.customerTotalWinLoss >= 0 ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : (
                <Trophy className="h-4 w-4 text-green-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.customerTotalWinLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                HK${safeFormatNumber(metrics.customerTotalWinLoss)}
              </div>
              <p className="text-xs text-green-600">
                {metrics.customerTotalWinLoss <= 0 ? 'House Win' : 'Customer Win'} • {metrics.activeCustomers} active customers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">House Gross Win</CardTitle>
              <Trophy className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.houseGrossWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                HK${safeFormatNumber(metrics.houseGrossWin)}
              </div>
              <p className="text-xs text-purple-600">
                {metrics.profitMargin.toFixed(1)}% profit margin on rolling
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Buy-in/Buy-out Flow</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                HK${safeFormatNumber(metrics.customerTotalBuyOut - metrics.customerTotalBuyIn)}
              </div>
              <p className="text-xs text-orange-600">
                Net cash flow • {metrics.totalBuyInOutRecords} transactions
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

      {/* House Performance Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-indigo-800">House Performance Flow</CardTitle>
            <CardDescription className="text-indigo-600">
              Real-time calculation from customer data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="text-sm text-gray-600">Customer Win/Loss</span>
                  <span className={`font-semibold ${metrics.customerTotalWinLoss <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    HK${safeFormatNumber(metrics.customerTotalWinLoss)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm text-green-700 font-medium">= House Gross Win</span>
                  <span className="font-bold text-green-700">
                    HK${safeFormatNumber(metrics.houseGrossWin)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="text-sm text-gray-600">- Rolling Commission</span>
                  <span className="font-semibold text-purple-600">
                    HK${safeFormatNumber(metrics.totalRollingCommission)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span className="text-sm text-orange-700 font-medium">= House Net Win</span>
                  <span className="font-bold text-orange-700">
                    HK${safeFormatNumber(metrics.houseNetWin)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                  <span className="text-sm text-gray-600">- Trip Expenses</span>
                  <span className="font-semibold text-red-600">
                    HK${safeFormatNumber(metrics.totalExpenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg border-2 border-indigo-300">
                  <span className="text-sm text-indigo-700 font-bold">House Final Profit</span>
                  <span className={`text-xl font-bold ${metrics.houseFinalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    HK${safeFormatNumber(metrics.houseFinalProfit)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Activity Monitor */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Real-time Activity Monitor</CardTitle>
            <CardDescription className="text-green-600">
              Live transaction data and performance ratios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Recent Activity */}
              <div>
                <h4 className="font-semibold text-green-800 mb-3">24 Hour Activity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center p-2 bg-white rounded border">
                    <span className="text-xs text-gray-600">Rolling Records</span>
                    <span className="font-medium text-blue-600">{metrics.recentRollingRecords}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded border">
                    <span className="text-xs text-gray-600">Buy-in/Out</span>
                    <span className="font-medium text-green-600">{metrics.recentBuyInOutRecords}</span>
                  </div>
                </div>
              </div>

              {/* Buy-in/Buy-out Breakdown */}
              <div>
                <h4 className="font-semibold text-green-800 mb-3">Cash Flow Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg">
                    <span className="text-sm text-blue-800 font-medium">Total Buy-in</span>
                    <span className="font-bold text-blue-700">
                      HK${safeFormatNumber(metrics.customerTotalBuyIn)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-100 rounded-lg">
                    <span className="text-sm text-purple-800 font-medium">Total Buy-out</span>
                    <span className="font-bold text-purple-700">
                      HK${safeFormatNumber(metrics.customerTotalBuyOut)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
                    <span className="text-sm text-green-800 font-medium">Net Cash Flow</span>
                    <span className={`font-bold ${(metrics.customerTotalBuyOut - metrics.customerTotalBuyIn) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      HK${safeFormatNumber(metrics.customerTotalBuyOut - metrics.customerTotalBuyIn)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Ratios */}
              <div>
                <h4 className="font-semibold text-green-800 mb-3">Performance Ratios</h4>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">Profit Margin</span>
                    <span className="font-medium">{metrics.profitMargin.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">Commission Rate</span>
                    <span className="font-medium">{metrics.commissionRatio.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">Expense Ratio</span>
                    <span className="font-medium">{metrics.expenseRatio.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  const indicator = getWinLossIndicator(customer.totalWinLoss);
                  const Icon = indicator.icon;
                  const commission = customer.totalRolling * (customer.rollingPercentage / 100);
                  
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
                            customer.totalWinLoss >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {customer.totalWinLoss >= 0 ? '+' : ''}HK${safeFormatNumber(customer.totalWinLoss)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Commission</div>
                          <div className="font-medium text-purple-600">HK${safeFormatNumber(commission)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Cash Flow</div>
                          <div className={`font-medium ${
                            (customer.totalBuyOut - customer.totalBuyIn) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber(customer.totalBuyOut - customer.totalBuyIn)}
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