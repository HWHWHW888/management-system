import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Users, UserCheck, TrendingDown, DollarSign, Receipt, Trophy, Target, 
  MapPin, Activity, ArrowUpDown, ArrowUp, ArrowDown
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
    totalRolling?: number;
    total_rolling?: number;
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


export function Dashboard({ user }: DashboardProps) {
  // Data states with real-time updates
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rollingRecords, setRollingRecords] = useState<RollingRecord[]>([]);
  const [buyInOutRecords, setBuyInOutRecords] = useState<BuyInOutRecord[]>([]);
  
  // Loading and sync states
  const [loading, setLoading] = useState(true);
  
  // Sorting states for customer performance
  const [sortBy, setSortBy] = useState<'rolling' | 'winloss'>('rolling');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Data loading from API
  const loadData = useCallback(async () => {
    try {
      console.log('🔄 Loading dashboard data from API...');
      
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
        return {
          ...trip,
          attachments: trip.attachments || []
        };
      });

      // Set processed data
      setAgents(agentsData);
      setCustomers(processedCustomers);
      setTrips(processedTrips);
      setRollingRecords([]);
      setBuyInOutRecords(transactionsData || []);
      
      console.log(`✅ Dashboard data loaded: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips`);
      
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Sorting function for customers
  const getSortedCustomers = () => {
    const sorted = [...filteredCustomers].sort((a, b) => {
      let valueA, valueB;
      
      if (sortBy === 'rolling') {
        valueA = safeNumber(a.totalRolling);
        valueB = safeNumber(b.totalRolling);
      } else {
        valueA = safeNumber(a.totalWinLoss);
        valueB = safeNumber(b.totalWinLoss);
      }
      
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });
    
    // Return all customers, not just top 5
    return sorted;
  };

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
    const customerTotalWinLoss = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalWinLoss), 0);
    const customerTotalBuyIn = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalBuyIn), 0);
    const customerTotalBuyOut = filteredCustomers.reduce((sum, c) => sum + safeNumber(c.totalBuyOut), 0);
    
    // Total Rolling from trip_sharing table (should be positive by nature)
    const tripSharingTotalRolling = trips.reduce((sum, trip) => {
      const value = safeNumber(trip.sharing?.total_rolling || trip.sharing?.totalRolling);
      console.log(`🔍 Trip ${trip.trip_name || trip.name}:`, {
        hasSharing: !!trip.sharing,
        total_rolling: trip.sharing?.total_rolling,
        totalRolling: trip.sharing?.totalRolling,
        sharingObject: trip.sharing,
        contributingValue: value
      });
      return sum + value;
    }, 0);
    
    console.log('📊 Dashboard Total Rolling Summary:', {
      totalTrips: trips.length,
      tripsWithSharing: trips.filter(t => t.sharing).length,
      finalTotalRolling: tripSharingTotalRolling
    });

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
      const value = safeNumber(trip.sharing?.total_win_loss || trip.sharing?.totalWinLoss);
      console.log(`Trip ${trip.trip_name}: total_win_loss = ${trip.sharing?.total_win_loss}, contributing ${value} to gross profit`);
      return sum + value;
    }, 0);
    
    const tripSharingExpenses = trips.reduce((sum, trip) => {
      const value = safeNumber(trip.sharing?.total_expenses || trip.sharing?.totalExpenses);
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

    // Performance ratios (using trip_sharing total_rolling)
    const profitMargin = tripSharingTotalRolling > 0 ? ((houseFinalProfit / tripSharingTotalRolling) * 100) : 0;
    const expenseRatio = tripSharingTotalRolling > 0 ? ((totalExpenses / tripSharingTotalRolling) * 100) : 0;
    const commissionRatio = tripSharingTotalRolling > 0 ? ((totalRollingCommission / tripSharingTotalRolling) * 100) : 0;

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
      customerTotalRolling: tripSharingTotalRolling, // Use trip_sharing total_rolling
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

  // Filter active trips and use trip_sharing data
  const activeTrips = filteredTrips.filter(trip => 
    trip.status && trip.status.toLowerCase() === 'active'
  ).map(trip => {
    // Use trip_sharing data directly instead of enriching with calculations
    const tripCustomers = filteredCustomers.filter(c => 
      trip.customers?.some(tc => tc.customerId === c.id || tc.customer_id === c.id)
    );
    
    return {
      ...trip,
      customers: tripCustomers
      // Keep original sharing data from trip_sharing table
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
          <p className="mt-2 text-sm text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

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
              <div className="text-2xl font-bold text-blue-700">HK${safeFormatNumber(Math.abs(metrics.customerTotalRolling))}</div>
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
                HK${safeFormatNumber(Math.abs(metrics.houseGrossWin))}
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
              <div className="text-2xl font-bold text-red-700">HK${safeFormatNumber(Math.abs(metrics.totalExpenses))}</div>
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
                HK${safeFormatNumber(Math.abs(metrics.houseFinalProfit))}
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
                  // Use trip_sharing data directly
                  const totalRolling = trip.sharing?.total_rolling || trip.sharing?.totalRolling || 0;
                  const winLoss = trip.sharing?.total_win_loss || trip.sharing?.totalWinLoss || 0;
                  
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
                      <div className="grid grid-cols-2 gap-6 text-right text-xs">
                        <div>
                          <div className="text-gray-500">Rolling</div>
                          <div className="font-medium text-blue-600">HK${safeFormatNumber(Math.abs(totalRolling))}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Win/Loss</div>
                          <div className={`font-medium ${
                            winLoss < 0 ? 'text-red-600' : winLoss >= 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            HK${safeFormatNumber(Math.abs(winLoss))}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Real-time Customer Performance</CardTitle>
              <CardDescription>
                All customers based on live rolling data {user.role === 'agent' ? 'you manage' : ''} ({filteredCustomers.length} customers)
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-sm">
                <span className="text-gray-500">Sort by:</span>
                <button
                  onClick={() => setSortBy(sortBy === 'rolling' ? 'winloss' : 'rolling')}
                  className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">
                    {sortBy === 'rolling' ? 'Rolling' : 'Win/Loss'}
                  </span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="flex items-center px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                title={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
              >
                {sortOrder === 'desc' ? (
                  <ArrowDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customer data found</p>
              <p className="text-xs text-gray-400 mt-1">Customer performance will appear here once rolling records are created</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {getSortedCustomers().map((customer) => {
                const indicator = getWinLossStatus(customer.totalWinLoss || 0);
                const Icon = indicator.icon;
                const winLoss = customer.totalWinLoss || 0;
                
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
                    <div className="grid grid-cols-2 gap-6 text-right text-xs">
                      <div>
                        <div className="text-gray-500">Rolling</div>
                        <div className="font-medium text-blue-600">HK${safeFormatNumber(Math.abs(customer.totalRolling || 0))}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Win/Loss</div>
                        <div className={`font-medium ${
                          winLoss < 0 ? 'text-red-600' : winLoss > 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          HK${safeFormatNumber(Math.abs(winLoss))}
                        </div>
                        <div className={`text-xs ${
                          winLoss < 0 ? 'text-red-500' : winLoss > 0 ? 'text-green-500' : 'text-gray-500'
                        }`}>
                          {winLoss < 0 ? '公司输钱' : winLoss > 0 ? '公司赢钱' : '持平'}
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