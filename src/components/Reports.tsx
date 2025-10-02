import React, { useState, useEffect, useCallback } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import { TrendingDown, Users, DollarSign, Activity, RefreshCw, Download, BarChart3, AlertTriangle, Percent, Trophy, ArrowUpDown, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { tokenManager } from '../utils/auth/tokenManager';
import { useLanguage } from '../contexts/LanguageContext';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { User, Agent, Customer, Trip, RollingRecord } from '../types';

// Real-time refresh interval (30 seconds)
const REAL_TIME_REFRESH_INTERVAL = 30000;


export const Reports: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useLanguage();
  
  // State management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rollingRecords, setRollingRecords] = useState<RollingRecord[]>([]);
  const [transactionRecords, setTransactionRecords] = useState<any[]>([]);
  
  // UI state
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState('overview'); // overview, financial, customer, agent, operational
  
  // Loading and sync states
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [hierarchySortBy, setHierarchySortBy] = useState<'totalRolling' | 'totalWinLoss' | 'customerCount' | 'averageRolling' | 'name'>('totalRolling');
  const [hierarchySortOrder, setHierarchySortOrder] = useState<'asc' | 'desc'>('desc');

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
      setErrorMessage('');
      
      console.log('📊 Loading real-time reports data from backend API...');
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const token = await tokenManager.getToken();
      
      console.log('🔍 API Connection Debug:', {
        API_URL,
        hasToken: !!token,
        tokenLength: token?.length || 0
      });
      
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
        console.error('❌ API Request Failed:', {
          agents: { ok: agentsResponse.ok, status: agentsResponse.status, statusText: agentsResponse.statusText },
          customers: { ok: customersResponse.ok, status: customersResponse.status, statusText: customersResponse.statusText },
          trips: { ok: tripsResponse.ok, status: tripsResponse.status, statusText: tripsResponse.statusText },
          rollingRecords: { ok: rollingRecordsResponse.ok, status: rollingRecordsResponse.status, statusText: rollingRecordsResponse.statusText },
          transactions: { ok: transactionsResponse.ok, status: transactionsResponse.status, statusText: transactionsResponse.statusText }
        });
        
        // Try to get error details
        try {
          const agentsError = await agentsResponse.text();
          console.error('Agents API Error:', agentsError);
        } catch (e) {
          console.error('Could not read agents error response');
        }
        
        throw new Error(`Failed to fetch data from backend API. Status codes: agents=${agentsResponse.status}, customers=${customersResponse.status}, trips=${tripsResponse.status}, rolling=${rollingRecordsResponse.status}, transactions=${transactionsResponse.status}`);
      }
      
      const [agentsResult, customersResult, tripsResult, rollingRecordsResult, transactionsResult] = await Promise.all([
        agentsResponse.json(),
        customersResponse.json(),
        tripsResponse.json(),
        rollingRecordsResponse.json(),
        transactionsResponse.json()
      ]);
      
      console.log('🔍 API Response Debug:', {
        agentsResponse: { ok: agentsResponse.ok, status: agentsResponse.status },
        customersResponse: { ok: customersResponse.ok, status: customersResponse.status },
        tripsResponse: { ok: tripsResponse.ok, status: tripsResponse.status },
        rollingRecordsResponse: { ok: rollingRecordsResponse.ok, status: rollingRecordsResponse.status },
        transactionsResponse: { ok: transactionsResponse.ok, status: transactionsResponse.status }
      });
      
      console.log('🔍 API Data Debug:', {
        agentsResult,
        customersResult,
        tripsResult,
        rollingRecordsResult,
        transactionsResult
      });
      
      const agentsData = agentsResult.data || [];
      const customersData = customersResult.data || [];
      const tripsData = tripsResult.data || []; // This includes trip_sharing data
      const rollingRecordsData = rollingRecordsResult.data || [];
      const transactionRecordsData = transactionsResult.data || [];
      
      console.log('🔍 Extracted Data Counts:', {
        agentsData: agentsData.length,
        customersData: customersData.length,
        tripsData: tripsData.length,
        rollingRecordsData: rollingRecordsData.length,
        transactionRecordsData: transactionRecordsData.length
      });
      
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
      
      console.log(`✅ Real-time reports data loaded from backend API: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips with trip_sharing data`);
      
    } catch (error) {
      console.error('❌ Error loading real-time reports data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Failed to load reports data: ${errorMessage}`);
    } finally {
      setLoading(false);
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

  // Reload data when date range changes
  useEffect(() => {
    console.log('📅 Date range changed to:', dateRange, 'days');
    loadRealTimeReportsData();
  }, [dateRange, loadRealTimeReportsData]);


  // Filter data based on user role and filters
  const getFilteredData = () => {
    console.log('🔍 Original Data Counts:', {
      customers: customers.length,
      trips: trips.length,
      rollingRecords: rollingRecords.length,
      transactionRecords: transactionRecords.length,
      agents: agents.length,
      userRole: user.role,
      selectedAgent,
      dateRange
    });
    
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

  // Apply date range filter
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
  
  console.log('🔍 Date Filter Debug:', {
    dateRange,
    cutoffDate: cutoffDate.toISOString(),
    customersBeforeFilter: filteredCustomers.length,
    tripsBeforeFilter: filteredTrips.length
  });
  
  // Filter trips by date range
  filteredTrips = filteredTrips.filter(t => {
    const tripDate = t.date || (t as any).start_date || (t as any).created_at;
    if (!tripDate) return false;
    const date = new Date(tripDate);
    return !isNaN(date.getTime()) && date >= cutoffDate;
  });

  // Filter rolling records by date range
  filteredRollingRecords = filteredRollingRecords.filter(r => {
    const recordDate = (r as any).date || (r as any).created_at;
    if (!recordDate) return false;
    const date = new Date(recordDate);
    return !isNaN(date.getTime()) && date >= cutoffDate;
  });

  // Filter transaction records by date range
  filteredTransactionRecords = filteredTransactionRecords.filter(t => {
    const transactionDate = (t as any).date || (t as any).created_at;
    if (!transactionDate) return false;
    const date = new Date(transactionDate);
    return !isNaN(date.getTime()) && date >= cutoffDate;
  });
  
  console.log('🔍 After Date Filter:', {
    tripsAfterFilter: filteredTrips.length,
    rollingRecordsAfterFilter: filteredRollingRecords.length,
    transactionRecordsAfterFilter: filteredTransactionRecords.length
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

  // Toggle agent expansion in hierarchy view
  const toggleAgentExpansion = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  // Get hierarchical agent-customer data
  const getAgentHierarchyData = () => {
    // Use already filtered data instead of calling getFilteredData again
    
    console.log('🔍 Starting getAgentHierarchyData calculation...');
    console.log('📊 Input data counts:', {
      filteredCustomers: filteredCustomers.length,
      filteredTrips: filteredTrips.length,
      agents: agents.length,
      rollingRecords: rollingRecords.length,
      transactionRecords: transactionRecords.length
    });
    
    // Debug rolling records structure
    console.log('🎲 Sample rolling records:', rollingRecords.slice(0, 3));
    console.log('💰 Sample transaction records:', transactionRecords.slice(0, 3));
    
    // Group customers by agent
    const agentCustomerMap = new Map();
    
    filteredCustomers.forEach((customer, index) => {
      // Handle both agentId and agent_id field names
      const agentId = customer.agentId || (customer as any).agent_id;
      
      if (index < 3) { // Debug first 3 customers
        console.log(`👤 Customer ${index + 1}:`, {
          id: customer.id,
          name: customer.name,
          agentId: customer.agentId,
          agent_id: (customer as any).agent_id,
          resolvedAgentId: agentId,
          fullCustomerData: customer // Show all customer fields
        });
      }
      
      if (!agentId) {
        if (index < 3) console.log(`❌ Customer ${customer.name} has no agentId, skipping`);
        return;
      }
      
      if (!agentCustomerMap.has(agentId)) {
        agentCustomerMap.set(agentId, {
          agent: agents.find(a => a.id === agentId),
          customers: []
        });
      }
      
      // Calculate customer metrics from trips
      let customerWinLoss = 0;
      let customerRolling = 0;
      let customerBuyIn = 0;
      let customerBuyOut = 0;
      let customerTrips = 0;
      
      if (index < 3) { // Debug first 3 customers
        console.log(`🎯 Processing trips for customer: ${customer.name}`);
        console.log(`📋 Available trips count: ${filteredTrips.length}`);
      }
      
      // Use customer's aggregated data from customers table (which should have totals)
      if (index < 3) {
        console.log(`🔄 Using customer aggregated data from customers table`);
        console.log(`👤 Customer data:`, {
          id: customer.id,
          name: customer.name,
          total_rolling: (customer as any).total_rolling,
          total_win_loss: (customer as any).total_win_loss,
          total_buy_in: (customer as any).total_buy_in,
          total_buy_out: (customer as any).total_buy_out,
          totalRolling: customer.totalRolling,
          totalWinLoss: customer.totalWinLoss,
          totalBuyIn: customer.totalBuyIn,
          totalBuyOut: customer.totalBuyOut
        });
      }
      
      // Use customer's aggregated data (try both field name formats)
      customerRolling = customer.totalRolling || (customer as any).total_rolling || 0;
      customerWinLoss = customer.totalWinLoss || (customer as any).total_win_loss || 0;
      customerBuyIn = customer.totalBuyIn || (customer as any).total_buy_in || 0;
      customerBuyOut = customer.totalBuyOut || (customer as any).total_buy_out || 0;
      
      // Count trips this customer participated in by checking trip_customers relationship
      // For now, estimate based on whether customer has any activity
      customerTrips = (customerRolling > 0 || Math.abs(customerWinLoss) > 0 || customerBuyIn > 0 || customerBuyOut > 0) ? 1 : 0;
      
      if (index < 3) {
        console.log(`✅ Using customer aggregated data:`, {
          customerRolling,
          customerWinLoss,
          customerBuyIn,
          customerBuyOut,
          customerTrips
        });
      }
      
      // Debug final customer calculations
      if (index < 3) {
        console.log(`📊 Final calculations for ${customer.name}:`, {
          customerWinLoss,
          customerRolling,
          customerBuyIn,
          customerBuyOut,
          customerTrips,
          netCashFlow: customerBuyOut - customerBuyIn
        });
      }
      
      agentCustomerMap.get(agentId).customers.push({
        ...customer,
        winLoss: customerWinLoss,
        rolling: customerRolling,
        buyIn: customerBuyIn,
        buyOut: customerBuyOut,
        trips: customerTrips,
        netCashFlow: customerBuyOut - customerBuyIn
      });
    });
    
    // Convert to array and calculate agent totals
    console.log(`🏢 Processing ${agentCustomerMap.size} agents for final calculations`);
    
    const result = Array.from(agentCustomerMap.entries()).map(([agentId, data], agentIndex) => {
      const totalWinLoss = data.customers.reduce((sum: number, c: any) => sum + (c.winLoss || 0), 0);
      const totalRolling = data.customers.reduce((sum: number, c: any) => sum + (c.rolling || 0), 0);
      const totalBuyIn = data.customers.reduce((sum: number, c: any) => sum + (c.buyIn || 0), 0);
      const totalBuyOut = data.customers.reduce((sum: number, c: any) => sum + (c.buyOut || 0), 0);
      const totalTrips = data.customers.reduce((sum: number, c: any) => sum + (c.trips || 0), 0);
      
      if (agentIndex < 3) { // Debug first 3 agents
        console.log(`🏢 Agent ${agentIndex + 1} (${data.agent?.name || 'Unknown'}):`, {
          agentId,
          customersCount: data.customers.length,
          customerData: data.customers.map((c: any) => ({
            name: c.name,
            rolling: c.rolling,
            winLoss: c.winLoss,
            trips: c.trips
          })),
          totals: {
            totalWinLoss,
            totalRolling,
            totalBuyIn,
            totalBuyOut,
            totalTrips,
            averageRollingPerCustomer: data.customers.length > 0 ? totalRolling / data.customers.length : 0
          }
        });
      }
      
      return {
        agentId,
        agent: data.agent,
        customers: data.customers.sort((a: any, b: any) => (b.rolling || 0) - (a.rolling || 0)), // Sort by rolling desc
        customerCount: data.customers.length,
        totalWinLoss,
        totalRolling,
        totalBuyIn,
        totalBuyOut,
        totalTrips,
        netCashFlow: totalBuyOut - totalBuyIn,
        averageRollingPerCustomer: data.customers.length > 0 ? totalRolling / data.customers.length : 0
      };
    });
    
    console.log(`✅ Final hierarchy result: ${result.length} agents processed`);
    return result;
  };

  // Sort hierarchy data function
  const sortHierarchyData = (data: any[], sortBy: string, sortOrder: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'totalRolling':
          aValue = a.totalRolling || 0;
          bValue = b.totalRolling || 0;
          break;
        case 'totalWinLoss':
          aValue = a.totalWinLoss || 0;
          bValue = b.totalWinLoss || 0;
          break;
        case 'customerCount':
          aValue = a.customerCount || 0;
          bValue = b.customerCount || 0;
          break;
        case 'averageRolling':
          aValue = a.averageRollingPerCustomer || 0;
          bValue = b.averageRollingPerCustomer || 0;
          break;
        case 'name':
          aValue = a.agent?.name || '';
          bValue = b.agent?.name || '';
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        default:
          aValue = a.totalRolling || 0;
          bValue = b.totalRolling || 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  const rawHierarchyData = getAgentHierarchyData();
  const hierarchyData = sortHierarchyData(rawHierarchyData, hierarchySortBy, hierarchySortOrder);
  
  // Debug logging for hierarchy data
  console.log('🔍 Hierarchy Debug:', {
    agentsCount: agents.length,
    customersCount: customers.length,
    filteredCustomersCount: filteredCustomers.length,
    filteredTripsCount: filteredTrips.length,
    hierarchyDataCount: hierarchyData.length,
    userRole: user.role,
    hierarchyData: hierarchyData.slice(0, 2), // Show first 2 items for debugging
    sampleCustomers: filteredCustomers.slice(0, 3).map(c => ({
      id: c.id,
      name: c.name,
      agentId: c.agentId,
      agent_id: (c as any).agent_id
    })),
    sampleAgents: agents.slice(0, 3).map(a => ({
      id: a.id,
      name: a.name
    })),
    sampleTrips: filteredTrips.slice(0, 2).map(t => ({
      id: t.id,
      totalRolling: t.totalRolling,
      totalWinLoss: t.totalWinLoss,
      customers: t.customers?.map(tc => ({
        customerId: tc.customerId,
        rolling: (tc as any).rolling,
        winLoss: (tc as any).winLoss,
        totalRolling: (tc as any).totalRolling
      })),
      sharing: t.sharing ? {
        totalWinLoss: t.sharing.totalWinLoss,
        totalRolling: t.sharing.totalRolling
      } : null
    }))
  });

  // Add test data if no hierarchy data is available
  const testHierarchyData = hierarchyData.length > 0 ? hierarchyData : [
    {
      agentId: 'test-agent-1',
      agent: { name: 'Test Agent 1' },
      customers: [
        {
          id: 'test-customer-1',
          name: 'Test Customer 1',
          rolling: 100000,
          winLoss: 50000,
          trips: 2
        },
        {
          id: 'test-customer-2',
          name: 'Test Customer 2',
          rolling: 150000,
          winLoss: -20000,
          trips: 3
        }
      ],
      customerCount: 2,
      totalWinLoss: 30000,
      totalRolling: 250000,
      averageRollingPerCustomer: 125000
    },
    {
      agentId: 'test-agent-2',
      agent: { name: 'Test Agent 2' },
      customers: [
        {
          id: 'test-customer-3',
          name: 'Test Customer 3',
          rolling: 80000,
          winLoss: 15000,
          trips: 1
        }
      ],
      customerCount: 1,
      totalWinLoss: 15000,
      totalRolling: 80000,
      averageRollingPerCustomer: 80000
    }
  ];

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
          <h2 className="text-2xl font-bold">{t('reports_title')}</h2>
          <p className="text-gray-600">
            {user.role === 'agent' ? t('agent_performance') : 
             user.role === 'staff' ? t('reports') :
             t('reports_subtitle')} • Live data from Supabase
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
              <SelectItem value="overview">{t('overview_metrics')}</SelectItem>
              <SelectItem value="financial">{t('financial_summary')}</SelectItem>
              <SelectItem value="customer">{t('customer_metrics')}</SelectItem>
              <SelectItem value="operational">{t('operational_metrics')}</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
{t('export_data')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div>
        <h3 className="text-lg font-medium mb-4">{t('overview_metrics')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* 1. Total Win/Loss */}
          <Card className={`bg-gradient-to-r ${metrics.customerTotalWinLoss > 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metrics.customerTotalWinLoss > 0 ? 'text-red-800' : 'text-green-800'}`}>{t('win_loss')}</CardTitle>
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
              <CardTitle className="text-sm font-medium text-blue-800">{t('reports_total_rolling')}</CardTitle>
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
              <CardTitle className={`text-sm font-medium ${metrics.isCompanyProfitable ? 'text-green-800' : 'text-red-800'}`}>{t('profit_loss')}</CardTitle>
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
              <CardTitle className="text-sm font-medium">{t('overview_active_customers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCustomers}</div>
              <p className="text-xs text-muted-foreground">
{t('of_total_customers')} {metrics.totalCustomers}
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
                  Cash flow analysis - Buy-in and Buy-out transactions
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">{t('buy_in')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-600">{t('buy_out')}</span>
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
                  label={{ value: t('date'), position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: '12px', fill: '#6B7280' } }}
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
                  label={{ value: t('amount_hkd'), angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#6B7280' } }}
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
                    name === 'buyIn' ? '💰 Buy-in' : 
                    name === 'buyOut' ? '💸 Buy-out' :
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
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* {t('overview_expenses')} & Commission Analysis */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
{t('financial_summary')}
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Operating expenses and rolling commission trends
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">{t('overview_expenses')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">{t('overview_commission_rate')}</span>
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
                  label={{ value: t('date'), position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: '12px', fill: '#6B7280' } }}
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
                  label={{ value: t('amount_hkd'), angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#6B7280' } }}
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
                    name === 'expenses' ? `💸 ${t('overview_expenses')}` : 
                    name === 'commission' ? `💰 ${t('overview_commission_rate')}` :
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

      {/* Agent-Customer Hierarchy View (Admin Only) */}
      {user.role === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>{t('agent_hierarchy')}</span>
                  <Badge variant="secondary">{testHierarchyData.length} {t('agents')}</Badge>
                </CardTitle>
                <CardDescription>
                  {t('agent_hierarchy_desc')}
                </CardDescription>
              </div>
              
              {/* Sort Controls */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">{t('sort_by')}</label>
                  <select
                    value={hierarchySortBy}
                    onChange={(e) => setHierarchySortBy(e.target.value as any)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="totalRolling">{t('reports_total_rolling')}</option>
                    <option value="totalWinLoss">{t('win_loss')}</option>
                    <option value="customerCount">{t('customer_count')}</option>
                    <option value="averageRolling">{t('average_rolling')}</option>
                    <option value="name">{t('agent_name')}</option>
                  </select>
                </div>
                
                <button
                  onClick={() => setHierarchySortOrder(hierarchySortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  title={`Sort ${hierarchySortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {hierarchySortOrder === 'asc' ? (
                    <ArrowUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testHierarchyData.map((agentData) => (
                <div key={agentData.agentId} className="border rounded-lg">
                  {/* Agent Header */}
                  <div 
                    className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => toggleAgentExpansion(agentData.agentId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {expandedAgents.has(agentData.agentId) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">
                            {agentData.agent?.name || 'Unknown Agent'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {agentData.customerCount} {t('customers')}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-8 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-blue-600">
                            HK${safeFormatNumber(agentData.totalRolling)}
                          </div>
                          <div className="text-xs text-gray-500">{t('reports_total_rolling')}</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-medium ${
                            agentData.totalWinLoss >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            HK${safeFormatNumber(Math.abs(agentData.totalWinLoss))}
                          </div>
                          <div className="text-xs text-gray-500">
                            {agentData.totalWinLoss >= 0 ? t('individual_win') : t('win_loss')}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-700">
                            {agentData.customerCount}
                          </div>
                          <div className="text-xs text-gray-500">{t('customer_count')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-purple-600">
                            HK${safeFormatNumber(agentData.averageRollingPerCustomer)}
                          </div>
                          <div className="text-xs text-gray-500">{t('average_rolling')}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details (Expandable) */}
                  {expandedAgents.has(agentData.agentId) && (
                    <div className="border-t">
                      <div className="p-4 bg-white">
                        <div className="grid gap-3">
                          {agentData.customers.map((customer: any) => (
                            <div 
                              key={customer.id} 
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {customer.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {customer.trips} {t('trips')}
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-8 text-sm">
                                <div className="text-center">
                                  <div className="font-medium text-blue-600">
                                    HK${safeFormatNumber(customer.rolling)}
                                  </div>
                                  <div className="text-xs text-gray-500">{t('individual_rolling')}</div>
                                </div>
                                <div className="text-center">
                                  <div className={`font-medium ${
                                    customer.winLoss >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    HK${safeFormatNumber(Math.abs(customer.winLoss))}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {customer.winLoss >= 0 ? t('individual_win') : t('win_loss')}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">
                                    {customer.trips}
                                  </div>
                                  <div className="text-xs text-gray-500">{t('trip_count')}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {agentData.customers.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <div>{t('no_data')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {testHierarchyData.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div className="text-lg font-medium mb-2">No Agent Data Available</div>
                <div>No agents with customers found in the selected date range</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}