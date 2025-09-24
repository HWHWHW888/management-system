import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, AreaChart, Area, Line } from 'recharts';
import { TrendingDown, Users, DollarSign, Activity, RefreshCw, Download, BarChart3, Zap, AlertTriangle, Percent, Trophy, ArrowUpCircle, ArrowUpDown } from 'lucide-react';
import { tokenManager } from '../utils/auth/tokenManager';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { User, Agent, Customer, Trip, RollingRecord, BuyInOutRecord } from '../types';

// Real-time refresh interval (30 seconds)
const REAL_TIME_REFRESH_INTERVAL = 30000;

interface ReportsProps {
  user: User;
}


export function Reports({ user }: ReportsProps) {
  // Data states with real-time updates
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [, setRollingRecords] = useState<RollingRecord[]>([]);
  const [, setBuyInOutRecords] = useState<BuyInOutRecord[]>([]);
  
  // Filter states
  const [dateRange, setDateRange] = useState('30'); // days
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [reportType, setReportType] = useState('overview'); // overview, financial, customer, agent, operational
  
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

  // Real-time data loading from backend API with trip_sharing data
  const loadRealTimeReportsData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMessage('');
      
      console.log('📊 Loading real-time reports data from backend API...');
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const token = await tokenManager.getToken();
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      // Load all required data from backend API in parallel
      const [agentsResponse, customersResponse, tripsResponse] = await Promise.all([
        fetch(`${API_URL}/agents`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/customers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/trips`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!agentsResponse.ok || !customersResponse.ok || !tripsResponse.ok) {
        throw new Error('Failed to fetch data from backend API');
      }
      
      const [agentsResult, customersResult, tripsResult] = await Promise.all([
        agentsResponse.json(),
        customersResponse.json(),
        tripsResponse.json()
      ]);
      
      const agentsData = agentsResult.data || [];
      const customersData = customersResult.data || [];
      const tripsData = tripsResult.data || []; // This includes trip_sharing data


      // Process customers with data from backend (already includes totals)
      const processedCustomers = customersData.map((customer: Customer) => {
        return {
          ...customer,
          totalRolling: customer.totalRolling || 0,
          totalWinLoss: customer.totalWinLoss || 0,
          totalBuyIn: customer.totalBuyIn || 0,
          totalBuyOut: customer.totalBuyOut || 0,
          attachments: customer.attachments || [],
          isAgent: customer.isAgent || false,
          rollingPercentage: customer.rollingPercentage || 1.4,
          creditLimit: customer.creditLimit || 0,
          availableCredit: customer.availableCredit || 0
        };
      });

      // Process trips with trip_sharing data from backend API
      const processedTrips = tripsData.map((trip: Trip) => {
        // Use trip_sharing data from backend API (now in camelCase)
        const sharing = trip.sharing || {
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
        };

        // Calculate total rolling from commission (reverse calculation)
        const totalRolling = sharing?.totalRollingCommission ? (sharing.totalRollingCommission / 0.014) : 0;


        return {
          ...trip,
          totalRolling: totalRolling,
          totalWinLoss: sharing?.totalWinLoss || 0,
          totalBuyIn: sharing?.totalBuyIn || 0,
          totalBuyOut: sharing?.totalBuyOut || 0,
          calculatedTotalRolling: sharing?.totalRollingCommission || 0,
          attachments: trip.attachments || [],
          sharing: {
            totalWinLoss: sharing?.totalWinLoss || 0,
            totalExpenses: sharing?.totalExpenses || 0,
            totalRollingCommission: sharing?.totalRollingCommission || 0,
            totalBuyIn: sharing?.totalBuyIn || 0,
            totalBuyOut: sharing?.totalBuyOut || 0,
            netCashFlow: sharing?.netCashFlow || 0,
            netResult: sharing?.netResult || 0,
            totalAgentShare: sharing?.totalAgentShare || 0,
            companyShare: sharing?.companyShare || 0,
            agentSharePercentage: sharing?.agentSharePercentage || 0,
            companySharePercentage: sharing?.companySharePercentage || 100,
            agentBreakdown: sharing?.agentBreakdown || []
          }
        };
      });

      // Set processed data
      setAgents(agentsData);
      setCustomers(processedCustomers);
      setTrips(processedTrips);
      setRollingRecords([]); // Not used anymore
      setBuyInOutRecords([]); // Not used anymore
      setLastSyncTime(new Date());
      setConnectionStatus('connected');
      
      console.log(`✅ Real-time reports data loaded from backend API: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips with trip_sharing data`);
      
    } catch (error) {
      console.error('❌ Error loading real-time reports data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Failed to load reports data: ${errorMessage}`);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Real-time data sync with automatic refresh
  useEffect(() => {
    loadRealTimeReportsData();
    
    // Set up real-time refresh interval
    let refreshInterval: NodeJS.Timeout;
    if (isRealTimeEnabled) {
      refreshInterval = setInterval(() => {
        console.log('📊 Real-time reports refresh triggered');
        loadRealTimeReportsData();
      }, REAL_TIME_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [loadRealTimeReportsData, isRealTimeEnabled]);

  // Toggle real-time updates
  const toggleRealTime = () => {
    setIsRealTimeEnabled(!isRealTimeEnabled);
    if (!isRealTimeEnabled) {
      loadRealTimeReportsData(); // Refresh immediately when re-enabling
    }
  };

  // Filter data based on user role and filters
  const getFilteredData = () => {
    let filteredCustomers = customers;
    let filteredTrips = trips;
    let filteredRollingRecords: any[] = []; // Not used anymore
    let filteredBuyInOutRecords: any[] = []; // Not used anymore

    // Apply user role filter
    if (user.role === 'agent' && user.agentId) {
      filteredCustomers = customers.filter(c => c.agentId === user.agentId);
      filteredTrips = trips.filter(t => 
        (t.agents && t.agents.some(agent => agent.agentId === user.agentId)) ||
        t.agentId === user.agentId
      );
    } else if (user.role === 'staff' && user.staffId) {
      // Staff can only see trips they are assigned to
      filteredTrips = trips.filter(t => (t as any).staffId === user.staffId);
      // Filter customers based on trips
      const tripCustomerIds = Array.from(new Set(
        filteredTrips.flatMap(t => t.customers?.map(tc => tc.customerId) || [])
      ));
      filteredCustomers = customers.filter(c => tripCustomerIds.includes(c.id));
    }

    // Apply agent filter (admin only)
    if (user.role === 'admin' && selectedAgent !== 'all') {
      filteredCustomers = filteredCustomers.filter(c => c.agentId === selectedAgent);
      filteredTrips = filteredTrips.filter(t => 
        (t.agents && t.agents.some(agent => agent.agentId === selectedAgent)) ||
        t.agentId === selectedAgent
      );
    }

  // Apply date range filter - but show ALL data regardless of date for now
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
  
  // Show all trips regardless of date to display the data
  const showAllData = true;

  filteredCustomers = filteredCustomers.filter(c => 
    new Date((c as any).createdAt || (c as any).created_at) >= cutoffDate
  );
  
  filteredTrips = filteredTrips.filter(t => {
    if (showAllData) {
      return true; // Show all trips regardless of date
    }
    const tripDate = t.date || (t as any).start_date || (t as any).created_at;
    return tripDate && !isNaN(new Date(tripDate).getTime()) && new Date(tripDate) >= cutoffDate;
  });

    return { filteredCustomers, filteredTrips, filteredRollingRecords, filteredBuyInOutRecords };
  };

  const { filteredCustomers, filteredTrips, filteredRollingRecords, filteredBuyInOutRecords } = getFilteredData();

  // Calculate comprehensive metrics from trip_sharing data
  const calculateMetrics = () => {
    // Calculate aggregated metrics from filtered trips
    const totalWinLoss = filteredTrips.reduce((sum: number, trip: any) => sum + (trip.totalWinLoss || 0), 0);
    const totalRolling = filteredTrips.reduce((sum: number, trip: any) => sum + (trip.totalRolling || 0), 0);
    const totalBuyIn = filteredTrips.reduce((sum: number, trip: any) => sum + (trip.totalBuyIn || 0), 0);
    const totalBuyOut = filteredTrips.reduce((sum: number, trip: any) => sum + (trip.totalBuyOut || 0), 0);
    
    // Calculate company profit/loss from trip_sharing data
    const companyProfitLoss = filteredTrips.reduce((sum: number, trip: any) => {
      return sum + (trip.sharing?.companyShare || 0);
    }, 0);
    
    const isCompanyProfitable = companyProfitLoss > 0;

    // 🔍 DEBUG: Log calculated aggregated metrics
    console.group('📊 Calculated Aggregated Metrics');
    console.log('💰 Total Win/Loss:', totalWinLoss);
    console.log('🎲 Total Rolling:', totalRolling);
    console.log('💵 Total Buy-In:', totalBuyIn);
    console.log('💸 Total Buy-Out:', totalBuyOut);
    console.log('🏢 Company Profit/Loss:', companyProfitLoss);
    console.log('📈 Is Company Profitable:', isCompanyProfitable);
    console.log('🔢 Filtered Trips Count:', filteredTrips.length);
    console.groupEnd();

    // Company totals from trip_sharing data
    const companyTotalRolling = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalRollingCommission), 0);
    const companyTotalWinLoss = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalWinLoss), 0);
    const companyTotalBuyIn = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalBuyIn), 0);
    const companyTotalBuyOut = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalBuyOut), 0);
    const companyTotalExpenses = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalExpenses), 0);
    const companyNetResult = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.netResult), 0);
    const companyShare = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.companyShare), 0);


    // Trip totals for display
    const tripTotalRolling = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.totalRolling), 0);
    const tripTotalWinLoss = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.totalWinLoss), 0);
    const totalRollingCommission = companyTotalRolling;
    const totalExpenses = companyTotalExpenses;

    // House performance from company perspective (trip_sharing data)
    const houseGrossWin = Math.abs(companyTotalWinLoss); // Always show absolute value
    const houseNetWin = Math.abs(companyNetResult - totalExpenses); // Company net after expenses
    const houseFinalProfit = Math.abs(companyShare); // Final company share

    // Customer metrics
    const totalCustomers = filteredCustomers.length;
    const activeCustomers = filteredCustomers.filter((c: any) => c.isActive).length;

    // Agent metrics
    const totalAgents = agents.length;
    const activeAgents = agents.filter((a: any) => a.status === 'active').length;

    // Trip metrics
    const totalTrips = filteredTrips.length;
    const completedTrips = filteredTrips.filter((t: any) => t.status === 'completed').length;
    const ongoingTrips = filteredTrips.filter((t: any) => t.status === 'in-progress').length;

    // Performance ratios
    const profitMargin = companyTotalRolling > 0 ? ((houseFinalProfit / companyTotalRolling) * 100) : 0;
    const averageRollingPercentage = filteredCustomers.length > 0 
      ? filteredCustomers.reduce((sum: number, c: any) => sum + c.rollingPercentage, 0) / filteredCustomers.length
      : 1.4;

    return {
      customerTotalRolling: companyTotalRolling,
      customerTotalWinLoss: companyTotalWinLoss,
      customerTotalBuyIn: companyTotalBuyIn,
      customerTotalBuyOut: companyTotalBuyOut,
      tripTotalRolling,
      tripTotalWinLoss,
      totalRollingCommission,
      totalExpenses,
      houseGrossWin,
      houseNetWin,
      houseFinalProfit,
      totalCustomers,
      activeCustomers,
      totalAgents,
      activeAgents,
      totalTrips,
      completedTrips,
      ongoingTrips,
      profitMargin,
      averageRollingPercentage,
      totalRollingRecords: filteredTrips.length, // Number of trips with sharing data
      totalBuyInOutRecords: filteredTrips.filter(t => ((t.sharing?.totalBuyIn || 0) > 0) || ((t.sharing?.totalBuyOut || 0) > 0)).length,
      // Company performance indicators
      companyNetResult,
      companyShare,
      isCompanyProfitable: companyShare > 0
    };
  };

  const metrics = calculateMetrics();

  // Prepare chart data from trip_sharing data
  const getDailyChartData = () => {
    const dailyData: {[key: string]: any} = {};

    // Process trips by date using trip_sharing data
    filteredTrips.forEach(trip => {
      const tripDate = trip.date || (trip as any).start_date || (trip as any).created_at;
      if (!tripDate) {
        console.warn('Trip has no valid date:', trip);
        return;
      }
      const date = tripDate.split('T')[0]; // Get date part only
      if (!dailyData[date]) {
        dailyData[date] = { 
          date, 
          rolling: 0, 
          winLoss: 0, 
          commission: 0, 
          buyIn: 0, 
          buyOut: 0, 
          netCashFlow: 0,
          expenses: 0,
          companyShare: 0,
          recordCount: 0,
          transactions: 0
        };
      }
      
      // Use trip_sharing data
      const sharing = trip.sharing || {};
      dailyData[date].rolling += safeNumber(sharing.totalRollingCommission);
      dailyData[date].winLoss += safeNumber(sharing.totalWinLoss);
      dailyData[date].commission += safeNumber(sharing.totalRollingCommission);
      dailyData[date].buyIn += safeNumber(sharing.totalBuyIn);
      dailyData[date].buyOut += safeNumber(sharing.totalBuyOut);
      dailyData[date].expenses += safeNumber(sharing.totalExpenses);
      dailyData[date].companyShare += safeNumber(sharing.companyShare);
      dailyData[date].netCashFlow += safeNumber(sharing.netCashFlow);
      dailyData[date].recordCount += 1;
      dailyData[date].transactions += (((sharing.totalBuyIn || 0) > 0) || ((sharing.totalBuyOut || 0) > 0)) ? 1 : 0;
    });

    return Object.values(dailyData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const chartData = getDailyChartData();

  // Agent performance data (admin only)
  const getAgentPerformanceData = () => {
    if (user.role !== 'admin') return [];

    return agents.map(agent => {
      const agentCustomers = filteredCustomers.filter(c => c.agentId === agent.id);
      const agentRollingRecords = filteredRollingRecords.filter(r => r.agentId === agent.id);
      const agentBuyInOutRecords = filteredBuyInOutRecords.filter(b => {
        const customer = customers.find(c => c.id === b.customerId);
        return customer?.agentId === agent.id;
      });
      const agentTrips = filteredTrips.filter(t => 
        (t.agents && t.agents.some(a => a.agentId === agent.id)) ||
        t.agentId === agent.id
      );
      
      const rolling = agentRollingRecords.reduce((sum, r) => sum + safeNumber(r.rollingAmount), 0);
      const winLoss = agentRollingRecords.reduce((sum, r) => sum + safeNumber(r.winLoss), 0);
      const buyIn = agentBuyInOutRecords
        .filter(r => r.transactionType === 'buy-in')
        .reduce((sum, r) => sum + r.amount, 0);
      const buyOut = agentBuyInOutRecords
        .filter(r => r.transactionType === 'buy-out')
        .reduce((sum, r) => sum + r.amount, 0);
      
      return {
        name: agent.name,
        customers: agentCustomers.length,
        activeCustomers: agentCustomers.filter(c => c.isActive).length,
        rolling,
        winLoss,
        buyIn,
        buyOut,
        netCashFlow: buyOut - buyIn,
        commission: rolling * 0.014,
        trips: agentTrips.length,
        rollingRecords: agentRollingRecords.length,
        buyInOutRecords: agentTrips.filter(t => ((t.sharing?.totalBuyIn || 0) > 0) || ((t.sharing?.totalBuyOut || 0) > 0)).length,
        averageRollingPercentage: agentCustomers.length > 0 
          ? agentCustomers.reduce((sum, c) => sum + c.rollingPercentage, 0) / agentCustomers.length
          : 0
      };
    }).filter(agent => agent.rolling > 0 || agent.customers > 0);
  };

  const agentPerformanceData = getAgentPerformanceData();

  // Top customers data
  const getTopCustomersData = () => {
    return filteredCustomers
      .map(customer => {
        const customerRollingRecords = filteredRollingRecords.filter(r => r.customerId === customer.id);
        const customerBuyInOutRecords = filteredBuyInOutRecords.filter(b => b.customerId === customer.id);
        
        const rolling = customerRollingRecords.reduce((sum, r) => sum + safeNumber(r.rollingAmount), 0);
        const winLoss = customerRollingRecords.reduce((sum, r) => sum + safeNumber(r.winLoss), 0);
        const buyIn = customerBuyInOutRecords
          .filter(r => r.transactionType === 'buy-in')
          .reduce((sum, r) => sum + r.amount, 0);
        const buyOut = customerBuyInOutRecords
          .filter(r => r.transactionType === 'buy-out')
          .reduce((sum, r) => sum + r.amount, 0);

        return {
          ...customer,
          periodRolling: rolling,
          periodWinLoss: winLoss,
          periodBuyIn: buyIn,
          periodBuyOut: buyOut,
          periodNetCashFlow: buyOut - buyIn,
          periodCommission: rolling * (customer.rollingPercentage / 100),
          recordCount: customerRollingRecords.length,
          transactionCount: customerBuyInOutRecords.length
        };
      })
      .filter(customer => customer.periodRolling > 0)
      .sort((a, b) => b.periodRolling - a.periodRolling)
      .slice(0, 10);
  };

  const topCustomersData = getTopCustomersData();

  // Export functionality
  const handleExport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      dateRange: dateRange,
      selectedAgent: selectedAgent,
      userRole: user.role,
      summary: metrics,
      dailyData: chartData,
      topCustomers: topCustomersData,
      agentPerformance: agentPerformanceData,
      rawData: {
        customers: filteredCustomers.length,
        trips: filteredTrips.length,
        rollingRecords: filteredRollingRecords.length,
        buyInOutRecords: filteredBuyInOutRecords.length
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casino-reports-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading real-time reports data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Real-time Status Header for Reports */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-purple-800">
                📊 Real-time Reports & Analytics - Live Data from Supabase
              </p>
              <p className="text-xs text-purple-600">
                All reports are generated from live data including rolling records, buy-in/out transactions, and trip information.
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
              onClick={loadRealTimeReportsData}
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
              {connectionStatus === 'connected' ? 'Live Data' : 'Error'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Reports Error:</strong> {errorMessage}
            <Button
              onClick={loadRealTimeReportsData}
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

      {/* Header and Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Real-time Reports & Analytics</h2>
          <p className="text-gray-600">
            {user.role === 'agent' ? 'Performance overview for your customers' : 
             user.role === 'staff' ? 'Reports for your recorded transactions' :
             'Comprehensive business analytics'} • Live data from Supabase
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Showing data for last {dateRange} days • {metrics.totalRollingRecords} rolling records • {metrics.totalBuyInOutRecords} buy-in/out transactions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          {user.role === 'admin' && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div>
        <h3 className="text-lg font-medium mb-4">Key Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Total Rolling</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">HK${safeFormatNumber(metrics.customerTotalRolling)}</div>
              <p className="text-xs text-blue-600">
                {metrics.totalRollingRecords} rolling records • Last {dateRange} days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Commission</CardTitle>
              <Percent className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">HK${safeFormatNumber(metrics.customerTotalRolling * 0.014)}</div>
              <p className="text-xs text-purple-600">
                {metrics.averageRollingPercentage.toFixed(1)}% avg rolling rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">House P&L</CardTitle>
              {metrics.houseGrossWin >= 0 ? (
                <Trophy className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.houseGrossWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                HK${safeFormatNumber(Math.abs(metrics.houseGrossWin))}
              </div>
              <p className="text-xs text-green-600">
                {metrics.houseGrossWin >= 0 ? 'House Win' : 'Customer Win'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Cash Flow</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                HK${safeFormatNumber(metrics.customerTotalBuyOut - metrics.customerTotalBuyIn)}
              </div>
              <p className="text-xs text-orange-600">
                Net: Buy-out - Buy-in
              </p>
            </CardContent>
          </Card>

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
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Rolling Volume & Commission */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Rolling Volume & Commission</CardTitle>
            <CardDescription>Real-time rolling amounts and calculated commission over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `HK$${Number(value).toLocaleString()}`, 
                    name === 'rolling' ? 'Rolling' : name === 'commission' ? 'Commission' : 'Win/Loss'
                  ]} 
                />
                <Bar dataKey="rolling" fill="#8884d8" name="rolling" />
                <Bar dataKey="commission" fill="#82ca9d" name="commission" />
                <Line type="monotone" dataKey="winLoss" stroke="#ff7c7c" strokeWidth={2} name="winLoss" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Buy-in/Buy-out Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Cash Flow Analysis</CardTitle>
            <CardDescription>Buy-in vs Buy-out amounts and net cash flow</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `HK$${Number(value).toLocaleString()}`, 
                    name === 'buyIn' ? 'Buy-in' : name === 'buyOut' ? 'Buy-out' : 'Net Flow'
                  ]} 
                />
                <Area type="monotone" dataKey="buyIn" stackId="1" stroke="#8884d8" fill="#8884d8" name="buyIn" />
                <Area type="monotone" dataKey="buyOut" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="buyOut" />
                <Line type="monotone" dataKey="netCashFlow" stroke="#ff7c7c" strokeWidth={2} name="netCashFlow" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
            <CardDescription>Daily activity levels</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="recordCount" fill="#8884d8" name="Rolling Records" />
                <Bar dataKey="transactions" fill="#82ca9d" name="Buy-in/out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>Key operational metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-800">Total Trips</span>
                <span className="font-bold text-blue-700">{metrics.totalTrips}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-green-800">Completed</span>
                <span className="font-bold text-green-700">{metrics.completedTrips}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-800">Ongoing</span>
                <span className="font-bold text-orange-700">{metrics.ongoingTrips}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-purple-800">Profit Margin</span>
                <span className="font-bold text-purple-700">{metrics.profitMargin.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>Recent period summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Rolling Records</p>
                  <p className="text-xl font-bold text-blue-600">{metrics.totalRollingRecords}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <ArrowUpDown className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Buy-in/out Records</p>
                  <p className="text-xl font-bold text-green-600">{metrics.totalBuyInOutRecords}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Active Users</p>
                  <p className="text-xl font-bold text-purple-600">{metrics.activeCustomers}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      {topCustomersData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Customers</CardTitle>
            <CardDescription>
              Highest rolling volume customers for the selected period • Sorted by rolling amount
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCustomersData.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-gray-500">
                        Agent: {customer.agentName} • {customer.rollingPercentage}% rolling rate
                      </p>
                      <p className="text-xs text-gray-400">
                        {customer.recordCount} records • {customer.transactionCount} transactions
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-right text-xs">
                    <div>
                      <div className="text-gray-500">Rolling</div>
                      <div className="font-medium text-blue-600">HK${safeFormatNumber(customer.periodRolling)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Win/Loss</div>
                      <div className={`font-medium ${
                        customer.periodWinLoss >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {customer.periodWinLoss >= 0 ? '+' : ''}HK${safeFormatNumber(customer.periodWinLoss)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Commission</div>
                      <div className="font-medium text-purple-600">HK${safeFormatNumber(customer.periodCommission)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Cash Flow</div>
                      <div className={`font-medium ${
                        customer.periodNetCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        HK${safeFormatNumber(customer.periodNetCashFlow)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Performance (Admin Only) */}
      {user.role === 'admin' && agentPerformanceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance Analysis</CardTitle>
            <CardDescription>
              Comprehensive performance metrics by agent for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customers
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rolling Volume
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Win/Loss
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cash Flow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agentPerformanceData.map((agent) => (
                    <tr key={agent.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                          <div className="text-xs text-gray-500">{agent.averageRollingPercentage.toFixed(1)}% avg rate</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{agent.activeCustomers}/{agent.customers}</div>
                        <div className="text-xs text-gray-400">active/total</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="font-medium">HK${safeFormatNumber(agent.rolling)}</div>
                        <div className="text-xs text-blue-600">{agent.trips} trips</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                        HK${safeFormatNumber(agent.commission)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={agent.winLoss >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {agent.winLoss >= 0 ? '+' : ''}HK${safeFormatNumber(agent.winLoss)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className={`font-medium ${agent.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          HK${safeFormatNumber(agent.netCashFlow)}
                        </div>
                        <div className="text-xs text-gray-400">
                          In: HK${safeFormatNumber(agent.buyIn)} • Out: HK${safeFormatNumber(agent.buyOut)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{agent.rollingRecords} rolling</div>
                        <div className="text-xs text-gray-400">{agent.buyInOutRecords} buy-in/out</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}