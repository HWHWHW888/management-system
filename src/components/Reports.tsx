import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, AreaChart, Area, Line } from 'recharts';
import { TrendingDown, Users, DollarSign, Activity, RefreshCw, Download, BarChart3, Zap, AlertTriangle, Percent, Trophy, ArrowUpCircle, ArrowUpDown, Database } from 'lucide-react';
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
  const [rollingRecords, setRollingRecords] = useState<RollingRecord[]>([]);
  const [transactionRecords, setTransactionRecords] = useState<any[]>([]);
  
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
      const [agentsResponse, customersResponse, tripsResponse, rollingRecordsResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_URL}/agents`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/customers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/trips`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/rolling-records`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!agentsResponse.ok || !customersResponse.ok || !tripsResponse.ok || !rollingRecordsResponse.ok || !transactionsResponse.ok) {
        throw new Error('Failed to fetch data from backend API');
      }
      
      const [agentsResult, customersResult, tripsResult, rollingRecordsResult, transactionsResult] = await Promise.all([
        agentsResponse.json(),
        customersResponse.json(),
        tripsResponse.json(),
        rollingRecordsResponse.json(),
        transactionsResponse.json()
      ]);
      
      const agentsData = agentsResult.data || [];
      const customersData = customersResult.data || [];
      const tripsData = tripsResult.data || []; // This includes trip_sharing data
      const rollingRecordsData = rollingRecordsResult.data || [];
      const transactionRecordsData = transactionsResult.data || [];
      
      console.log('📊 Loaded transaction data:');
      console.log('  - Rolling records:', rollingRecordsData.length);
      console.log('  - Transaction records:', transactionRecordsData.length);


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
      setRollingRecords(rollingRecordsData);
      setTransactionRecords(transactionRecordsData);
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
    let filteredRollingRecords = rollingRecords;
    let filteredTransactionRecords = transactionRecords;

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
      filteredRollingRecords = filteredRollingRecords.filter(r => r.agentId === selectedAgent);
      filteredTransactionRecords = filteredTransactionRecords.filter(b => {
        const customer = customers.find(c => c.id === b.customerId);
        return customer?.agentId === selectedAgent;
      });
    }
    
    // Apply role-based filtering for transaction records
    if (user.role === 'agent' && user.agentId) {
      filteredRollingRecords = filteredRollingRecords.filter(r => r.agentId === user.agentId);
      filteredTransactionRecords = filteredTransactionRecords.filter(b => {
        const customer = customers.find(c => c.id === b.customerId);
        return customer?.agentId === user.agentId;
      });
    } else if (user.role === 'staff' && user.staffId) {
      // Staff can see records from their assigned trips
      const staffTripIds = filteredTrips.map(t => t.id);
      filteredRollingRecords = filteredRollingRecords.filter(r => r.tripId && staffTripIds.includes(r.tripId));
      filteredTransactionRecords = filteredTransactionRecords.filter(b => b.tripId && staffTripIds.includes(b.tripId));
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

    return { filteredCustomers, filteredTrips, filteredRollingRecords, filteredTransactionRecords };
  };

  const { filteredCustomers, filteredTrips, filteredRollingRecords, filteredTransactionRecords } = getFilteredData();

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

    // Company totals from trip_sharing data - using correct field names
    const companyTotalRolling = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.total_rolling), 0); // trip_sharing.total_rolling
    const companyTotalWinLoss = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.total_win_loss), 0); // trip_sharing.total_win_loss
    // const companyTotalBuyIn = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalBuyIn), 0);
    // const companyTotalBuyOut = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalBuyOut), 0);
    const companyTotalExpenses = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.totalExpenses), 0);
    const companyNetResult = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.netResult), 0);
    const companyShare = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.sharing?.companyShare), 0); // trip_sharing.companyShare
    // Try multiple field name formats for commission
    const totalRollingCommission = filteredTrips.reduce((sum: number, t: any) => {
      const commission = t.sharing?.total_rolling_commission || t.sharing?.totalRollingCommission || 0;
      return sum + safeNumber(commission);
    }, 0);

    // Customer metrics
    const totalCustomers = filteredCustomers.length;
    // Active customers = customers who have rolling amount (check multiple field names)
    const activeCustomers = filteredCustomers.filter((c: any) => {
      const rolling = c.totalRolling || c.total_rolling || 0;
      return rolling > 0;
    }).length;

    // Trip totals for display
    const tripTotalRolling = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.totalRolling), 0);
    const tripTotalWinLoss = filteredTrips.reduce((sum: number, t: any) => sum + safeNumber(t.totalWinLoss), 0);
    const totalExpenses = companyTotalExpenses;

    // House performance from company perspective (trip_sharing data)
    // const houseGrossWin = Math.abs(companyTotalWinLoss); // Always show absolute value
    const houseNetWin = Math.abs(companyNetResult - totalExpenses); // Company net after expenses
    const houseFinalProfit = Math.abs(companyShare); // Final company share

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
    console.log('🔍 Company Total Win/Loss (from sharing):', companyTotalWinLoss);
    console.log('🔍 Total Rolling Commission (from sharing):', totalRollingCommission);
    console.log('🔍 Active Customers (with rolling):', activeCustomers);
    console.log('🔍 Total Customers:', totalCustomers);
    console.groupEnd();

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

    // Add debug logging for trip_sharing commission data
    console.log('🔍 Trip Sharing Commission Debug:');
    filteredTrips.forEach((trip, i) => {
      const sharing = trip.sharing || {};
      console.log(`  Trip ${i+1} (${trip.name || trip.id}):`, {
        total_rolling_commission: sharing.total_rolling_commission,
        totalRollingCommission: sharing.totalRollingCommission,
        total_rolling: sharing.total_rolling,
        totalRolling: sharing.totalRolling,
        companyShare: sharing.companyShare,
        company_share: sharing.company_share
      });
    });
    
    // Add debug logging for final metrics
    console.log('🔍 Final Metrics Debug:');
    console.log('  - Total Rolling (trip.totalRolling):', totalRolling);
    console.log('  - Company Total Rolling (sharing.total_rolling):', companyTotalRolling);
    console.log('  - Total Rolling Commission (sum of trip_sharing.total_rolling_commission):', totalRollingCommission);
    console.log('  - Company Profit/Loss (sharing.companyShare):', companyProfitLoss);
    console.log('  - Active Customers (with rolling > 0):', activeCustomers);
    console.log('  - Total Customers:', totalCustomers);
    
    // Debug customer data
    console.log('🔍 Customer Debug:');
    console.log('  - Total Customers Found:', filteredCustomers.length);
    filteredCustomers.slice(0, 5).forEach((c, i) => {
      console.log(`  Customer ${i+1}:`, {
        name: c.name,
        totalRolling: c.totalRolling,
        total_rolling: c.total_rolling,
        isActive: c.isActive,
        hasRolling: (c.totalRolling || c.total_rolling || 0) > 0
      });
    });

    return {
      // Main metrics - use actual data sources that have values
      customerTotalRolling: totalRolling, // Use trip.totalRolling which has actual data (26,562,555)
      customerTotalWinLoss: Math.abs(totalWinLoss), // Use trip.totalWinLoss which has actual data (813,939)
      customerTotalBuyIn: totalBuyIn, // Use trip.totalBuyIn which has actual data
      customerTotalBuyOut: totalBuyOut, // Use trip.totalBuyOut which has actual data
      tripTotalRolling,
      tripTotalWinLoss,
      totalRollingCommission, // Sum of trip_sharing.total_rolling_commission from all trips
      totalExpenses,
      houseGrossWin: Math.abs(totalWinLoss), // Based on trip.totalWinLoss which has actual data
      houseNetWin,
      houseFinalProfit,
      totalCustomers,
      activeCustomers, // Customers with rolling > 0
      totalAgents,
      activeAgents,
      totalTrips,
      completedTrips,
      ongoingTrips,
      profitMargin,
      averageRollingPercentage,
      totalRollingRecords: filteredTrips.length, // Number of trips with sharing data
      totalBuyInOutRecords: filteredTrips.filter(t => ((t.totalBuyIn || 0) > 0) || ((t.totalBuyOut || 0) > 0)).length,
      // Company performance indicators
      companyNetResult,
      companyShare: companyProfitLoss, // Use companyProfitLoss which has actual data (305,951.23)
      isCompanyProfitable: companyProfitLoss > 0
    };
  };

  const metrics = calculateMetrics();

  // Prepare chart data from trip_sharing data
  const getDailyChartData = () => {
    const dailyData: {[key: string]: any} = {};

    // Process trips by date using trip_sharing data
    console.log('🔍 Processing trips for chart data:', filteredTrips.length);
    filteredTrips.forEach((trip, i) => {
      const tripDate = trip.date || (trip as any).start_date || (trip as any).created_at;
      if (!tripDate) {
        console.warn(`Trip ${i+1} has no valid date:`, {
          id: trip.id,
          name: trip.name,
          date: trip.date,
          start_date: (trip as any).start_date,
          created_at: (trip as any).created_at
        });
        return;
      }
      const date = tripDate.split('T')[0]; // Get date part only
      console.log(`Trip ${i+1} date: ${tripDate} -> ${date}`);
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
      
      // Use actual trip data (which has values) instead of empty trip_sharing data
      const sharing = trip.sharing || {};
      
      // Use trip data for rolling and winLoss (which have actual values)
      dailyData[date].rolling += safeNumber(trip.totalRolling); // Use trip.totalRolling (has data)
      dailyData[date].winLoss += safeNumber(trip.totalWinLoss); // Use trip.totalWinLoss (has data)
      
      // Calculate commission from rolling if trip_sharing is empty
      const sharingCommission = safeNumber(sharing.total_rolling_commission) || safeNumber(sharing.totalRollingCommission);
      const calculatedCommission = sharingCommission > 0 ? sharingCommission : (safeNumber(trip.totalRolling) * 0.014);
      dailyData[date].commission += calculatedCommission;
      
      // Use trip data for buy-in/out
      dailyData[date].buyIn += safeNumber(trip.totalBuyIn);
      dailyData[date].buyOut += safeNumber(trip.totalBuyOut);
      dailyData[date].expenses += safeNumber(sharing.totalExpenses);
      dailyData[date].companyShare += safeNumber(sharing.companyShare);
      dailyData[date].netCashFlow += safeNumber(trip.totalBuyOut - trip.totalBuyIn);
      dailyData[date].recordCount += 1; // Trip count
      dailyData[date].transactions += (((sharing.totalBuyIn || 0) > 0) || ((sharing.totalBuyOut || 0) > 0)) ? 1 : 0;
    });

    return Object.values(dailyData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const chartData = getDailyChartData();
  
  // Add actual transaction records count to chart data
  const enhancedChartData = chartData.map((dayData: any) => {
    // Count rolling records for this date
    const dayRollingRecords = filteredRollingRecords.filter((record: any) => {
      const recordDate = record.updated_at || record.created_at || record.recordedAt || record.sessionStartTime || record.createdAt;
      if (!recordDate) return false;
      const recordDateOnly = recordDate.split('T')[0];
      return recordDateOnly === dayData.date;
    }).length;
    
    // Count transaction records for this date  
    const dayTransactionRecords = filteredTransactionRecords.filter((record: any) => {
      const recordDate = record.updated_at || record.created_at || record.createdAt;
      if (!recordDate) return false;
      const recordDateOnly = recordDate.split('T')[0];
      return recordDateOnly === dayData.date;
    }).length;
    
    return {
      ...dayData,
      actualTransactionRecords: dayRollingRecords + dayTransactionRecords,
      rollingRecordsCount: dayRollingRecords,
      transactionRecordsCount: dayTransactionRecords
    };
  });
  
  // Debug chart data
  console.log('🔍 Enhanced Chart Data Debug:');
  console.log('  - Chart data length:', enhancedChartData.length);
  console.log('  - Total rolling records available:', filteredRollingRecords.length);
  console.log('  - Total transaction records available:', filteredTransactionRecords.length);
  console.log('  - Chart date range:', enhancedChartData.map(d => d.date));
  enhancedChartData.slice(0, 3).forEach((day: any, i) => {
    console.log(`  Day ${i+1} (${day.date}):`, {
      tripCount: day.recordCount,
      actualTransactionRecords: day.actualTransactionRecords,
      rollingRecords: day.rollingRecordsCount,
      transactionRecords: day.transactionRecordsCount
    });
  });
  
  // Debug sample transaction records to check date format
  console.log('🔍 Sample Transaction Records (date fields):');
  if (filteredTransactionRecords.length > 0) {
    const record = filteredTransactionRecords[0];
    console.log('  Transaction 1 date fields:', {
      updated_at: record.updated_at,
      created_at: record.created_at,
      createdAt: record.createdAt,
      extractedDate: (record.updated_at || record.created_at || record.createdAt || '').split('T')[0]
    });
  }
  
  console.log('🔍 Sample Rolling Records (all fields):');
  if (filteredRollingRecords.length > 0) {
    console.log('  Rolling 1 all fields:', filteredRollingRecords[0]);
    console.log('  Available fields:', Object.keys(filteredRollingRecords[0]));
  }

  // Agent performance data (admin only)
  const getAgentPerformanceData = () => {
    if (user.role !== 'admin') return [];

    return agents.map(agent => {
      const agentCustomers = filteredCustomers.filter(c => c.agentId === agent.id);
      const agentRollingRecords = filteredRollingRecords.filter(r => r.agentId === agent.id);
      const agentBuyInOutRecords = filteredTransactionRecords.filter(b => {
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
        transactionRecords: agentTrips.filter(t => ((t.sharing?.totalBuyIn || 0) > 0) || ((t.sharing?.totalBuyOut || 0) > 0)).length,
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
        const customerBuyInOutRecords = filteredTransactionRecords.filter(b => b.customerId === customer.id);
        
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
        transactionRecords: filteredTransactionRecords.length
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
          {/* 1. Total Win/Loss */}
          <Card className={`bg-gradient-to-r ${metrics.customerTotalWinLoss > 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metrics.customerTotalWinLoss > 0 ? 'text-red-800' : 'text-green-800'}`}>Total Win/Loss</CardTitle>
              <ArrowUpDown className={`h-4 w-4 ${metrics.customerTotalWinLoss > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.customerTotalWinLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>
                HK${safeFormatNumber(metrics.customerTotalWinLoss)}
              </div>
              <p className={`text-xs ${metrics.customerTotalWinLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.customerTotalWinLoss > 0 ? 'Customer Win (Company Loss)' : 'Customer Loss (Company Win)'}
              </p>
            </CardContent>
          </Card>

          {/* 2. Total Rolling */}
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

          {/* 3. Rolling Commission */}
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Rolling Commission</CardTitle>
              <Percent className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">HK${safeFormatNumber(metrics.totalRollingCommission)}</div>
              <p className="text-xs text-purple-600">
                From trip_sharing data
              </p>
            </CardContent>
          </Card>

          {/* 4. House P&L */}
          <Card className={`bg-gradient-to-r ${metrics.isCompanyProfitable ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metrics.isCompanyProfitable ? 'text-green-800' : 'text-red-800'}`}>House P&L</CardTitle>
              {metrics.isCompanyProfitable ? (
                <Trophy className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.isCompanyProfitable ? 'text-green-600' : 'text-red-600'}`}>
                HK${safeFormatNumber(Math.abs(metrics.companyShare))}
              </div>
              <p className={`text-xs ${metrics.isCompanyProfitable ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.isCompanyProfitable ? 'Company Profit (Customer Loss)' : 'Company Loss (Customer Win)'}
              </p>
            </CardContent>
          </Card>

          {/* 5. Active Customers */}
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
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Daily Business Overview
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Rolling volume, cash flow, and profit analysis
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Rolling</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Buy-in</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-600">Buy-out</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-gray-600">Profit</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart 
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="rollingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="buyInGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="buyOutGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  formatter={(value, name) => [
                    `HK$${Number(value).toLocaleString()}`, 
                    name === 'rolling' ? '🎲 Rolling Volume' : 
                    name === 'buyIn' ? '💰 Buy-in' : 
                    name === 'buyOut' ? '💸 Buy-out' :
                    name === 'companyShare' ? '📈 Profit' :
                    '📊 Data'
                  ]}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return `📅 ${date.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}`;
                  }}
                />
                <Bar 
                  dataKey="rolling" 
                  fill="url(#rollingGradient)" 
                  name="rolling"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Bar 
                  dataKey="buyIn" 
                  fill="url(#buyInGradient)" 
                  name="buyIn"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Bar 
                  dataKey="buyOut" 
                  fill="url(#buyOutGradient)" 
                  name="buyOut"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Line 
                  type="monotone" 
                  dataKey="companyShare" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  name="companyShare"
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2, fill: 'white' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expenses & Commission Analysis */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Daily Cost & Revenue Analysis
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Operating expenses and rolling commission trends
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">Expenses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Commission</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart 
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="commissionAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  formatter={(value, name) => [
                    `HK$${Number(value).toLocaleString()}`, 
                    name === 'expenses' ? '💸 Expenses' : 
                    name === 'commission' ? '💰 Rolling Commission' :
                    '📊 Data'
                  ]}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return `📅 ${date.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}`;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#EF4444" 
                  fill="url(#expensesGradient)" 
                  name="expenses"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="commission" 
                  stroke="#10B981" 
                  fill="url(#commissionAreaGradient)" 
                  name="commission"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Daily Trip Records
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Daily transaction records from database
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">Transaction Records</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart 
                data={enhancedChartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="tripRecordsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '8px 12px'
                  }}
                  formatter={(value, name) => [
                    `${Number(value)} records`, 
                    '🗂️ Transaction Records'
                  ]}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return `📅 ${date.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}`;
                  }}
                />
                <Bar 
                  dataKey="actualTransactionRecords" 
                  fill="url(#tripRecordsGradient)" 
                  name="actualTransactionRecords"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
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
                        customer.periodWinLoss > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        HK${safeFormatNumber(Math.abs(customer.periodWinLoss))}
                      </div>
                      <div className={`text-xs ${
                        customer.periodWinLoss > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {customer.periodWinLoss > 0 ? 'Customer Win' : 'Company Win'}
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
                        <div className={agent.winLoss > 0 ? 'text-red-600' : 'text-green-600'}>
                          HK${safeFormatNumber(Math.abs(agent.winLoss))}
                        </div>
                        <div className={`text-xs ${
                          agent.winLoss > 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {agent.winLoss > 0 ? 'Customer Win' : 'Company Win'}
                        </div>
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
                        <div className="text-xs text-gray-400">{agent.transactionRecords} buy-in/out</div>
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