import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// REPORTS API ENDPOINTS
// =====================================================
/**
 * GET /reports
 * Generate comprehensive reports for dashboard
 * Query params: period, agentId, view
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { period = 'last_30_days', agentId, view = 'overview' } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Calculate date range based on period
        const { startDate, endDate } = calculateDateRange(period);
        // Build base query filters
        let baseFilters = {
            startDate,
            endDate,
            agentId: agentId || null,
            userRole,
            userId
        };
        // Generate report data
        const reportData = await generateComprehensiveReport(baseFilters, view);
        res.json({
            success: true,
            data: reportData,
            filters: {
                period,
                agentId,
                view,
                dateRange: { startDate, endDate }
            },
            generatedAt: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to generate report',
            details: error.message
        });
    }
});
/**
 * GET /reports/quick-stats
 * Get quick overview statistics
 */
router.get('/quick-stats', authMiddleware, async (req, res) => {
    try {
        const { period = 'last_7_days' } = req.query;
        const { startDate, endDate } = calculateDateRange(period);
        const userId = req.user.id;
        const userRole = req.user.role;
        const quickStats = await generateQuickStats({ startDate, endDate, userRole, userId });
        res.json({
            success: true,
            data: quickStats,
            period,
            generatedAt: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to generate quick stats',
            details: error.message
        });
    }
});
/**
 * GET /reports/agent/:agentId
 * Get detailed report for specific agent
 */
router.get('/agent/:agentId', authMiddleware, async (req, res) => {
    try {
        const agentId = req.params.agentId;
        const { period = 'last_30_days' } = req.query;
        const { startDate, endDate } = calculateDateRange(period);
        const agentReport = await generateAgentReport(agentId, { startDate, endDate });
        res.json({
            success: true,
            data: agentReport,
            agentId,
            period,
            generatedAt: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to generate agent report',
            details: error.message
        });
    }
});
// =====================================================
// HELPER FUNCTIONS
// =====================================================
/**
 * Calculate date range based on period parameter
 */
function calculateDateRange(period) {
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
        case 'last_7_days':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'last_30_days':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case 'last_90_days':
            startDate.setDate(endDate.getDate() - 90);
            break;
        case 'this_month':
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            break;
        case 'this_year':
            startDate = new Date(endDate.getFullYear(), 0, 1);
            break;
        case 'custom':
            // For custom, you might want to accept start/end dates as query params
            startDate.setDate(endDate.getDate() - 30); // Default to 30 days
            break;
        default:
            startDate.setDate(endDate.getDate() - 30); // Default to 30 days
    }
    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    };
}
/**
 * Generate comprehensive report data
 */
async function generateComprehensiveReport(filters, view) {
    const { startDate, endDate, agentId, userRole, userId } = filters;
    // Build base query filters
    let tripFilter = supabase
        .from('trips')
        .select('*')
        .gte('start_date', startDate)
        .lte('end_date', endDate);
    // Staff can only see their assigned trips
    if (userRole === 'staff') {
        tripFilter = tripFilter.eq('staff_id', userId);
    }
    // Filter by agent if specified
    if (agentId) {
        tripFilter = tripFilter.in('id', supabase.from('trip_agents').select('trip_id').eq('agent_id', agentId));
    }
    const { data: trips, error: tripsError } = await tripFilter;
    if (tripsError)
        throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    const tripIds = trips?.map(t => t.id) || [];
    // Fetch all related data
    const [transactions, expenses, customers, agents, rollingRecords, buyInOutRecords] = await Promise.all([
        fetchTransactions(tripIds, startDate, endDate),
        fetchExpenses(tripIds, startDate, endDate),
        fetchCustomers(tripIds),
        fetchAgents(tripIds),
        fetchRollingRecords(tripIds, startDate, endDate),
        fetchBuyInOutRecords(tripIds, startDate, endDate)
    ]);
    // Generate report sections
    const report = {
        keyMetrics: generateKeyMetrics(transactions, expenses, customers, trips),
        charts: generateChartData(transactions, expenses, startDate, endDate),
        performanceSummary: generatePerformanceSummary(trips, transactions, expenses),
        activityOverview: generateActivityOverview(rollingRecords, buyInOutRecords, customers),
        agentPerformance: generateAgentPerformance(agents, transactions, expenses, trips)
    };
    // Add detailed data if requested
    if (view === 'detailed') {
        report.detailedData = {
            trips: trips,
            transactions: transactions,
            expenses: expenses,
            customers: customers,
            agents: agents
        };
    }
    return report;
}
/**
 * Generate quick statistics
 */
async function generateQuickStats(filters) {
    const { startDate, endDate, userRole, userId } = filters;
    let tripFilter = supabase
        .from('trips')
        .select('*')
        .gte('start_date', startDate)
        .lte('end_date', endDate);
    if (userRole === 'staff') {
        tripFilter = tripFilter.eq('staff_id', userId);
    }
    const { data: trips, error: tripsError } = await tripFilter;
    if (tripsError)
        throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    const tripIds = trips?.map(t => t.id) || [];
    const [transactions, expenses] = await Promise.all([
        fetchTransactions(tripIds, startDate, endDate),
        fetchExpenses(tripIds, startDate, endDate)
    ]);
    return {
        totalTrips: trips?.length || 0,
        activeTrips: trips?.filter(t => t.status === 'active').length || 0,
        totalRolling: calculateTotalRolling(transactions),
        totalCommission: calculateTotalCommission(transactions),
        totalExpenses: calculateTotalExpenses(expenses),
        profitMargin: calculateProfitMargin(transactions, expenses)
    };
}
/**
 * Generate agent-specific report
 */
async function generateAgentReport(agentId, dateRange) {
    const { startDate, endDate } = dateRange;
    // Get agent's trips
    const { data: agentTrips, error: tripsError } = await supabase
        .from('trip_agents')
        .select(`
      trip:trips(
        id,
        trip_name,
        destination,
        start_date,
        end_date,
        status,
        total_budget
      ),
      commission_rate,
      status
    `)
        .eq('agent_id', agentId)
        .gte('trip.start_date', startDate)
        .lte('trip.end_date', endDate);
    if (tripsError)
        throw new Error(`Failed to fetch agent trips: ${tripsError.message}`);
    const tripIds = agentTrips?.map(at => at.trip.id) || [];
    // Fetch agent's data
    const [transactions, expenses, customers] = await Promise.all([
        fetchTransactions(tripIds, startDate, endDate),
        fetchExpenses(tripIds, startDate, endDate),
        fetchCustomers(tripIds)
    ]);
    return {
        agent: await fetchAgentDetails(agentId),
        trips: agentTrips,
        performance: {
            totalTrips: agentTrips?.length || 0,
            totalRolling: calculateTotalRolling(transactions),
            totalCommission: calculateTotalCommission(transactions),
            totalExpenses: calculateTotalExpenses(expenses),
            profitMargin: calculateProfitMargin(transactions, expenses),
            customerCount: customers?.length || 0
        },
        transactions: transactions,
        expenses: expenses,
        customers: customers
    };
}
// =====================================================
// DATA FETCHING FUNCTIONS
// =====================================================
async function fetchTransactions(tripIds, startDate, endDate) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('transactions')
        .select(`
      id,
      trip_id,
      customer_id,
      amount,
      transaction_type,
      status,
      created_at,
      customer:customers(id, name, vip_level)
    `)
        .in('trip_id', tripIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at');
    if (error)
        throw new Error(`Failed to fetch transactions: ${error.message}`);
    return data || [];
}
async function fetchExpenses(tripIds, startDate, endDate) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('expenses')
        .select(`
      id,
      trip_id,
      expense_type,
      amount,
      description,
      expense_date,
      created_at
    `)
        .in('trip_id', tripIds)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date');
    if (error)
        throw new Error(`Failed to fetch expenses: ${error.message}`);
    return data || [];
}
async function fetchCustomers(tripIds) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('trip_customers')
        .select(`
      customer:customers(
        id,
        name,
        email,
        vip_level,
        total_spent
      )
    `)
        .in('trip_id', tripIds);
    if (error)
        throw new Error(`Failed to fetch customers: ${error.message}`);
    return data?.map(tc => tc.customer) || [];
}
async function fetchAgents(tripIds) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('trip_agents')
        .select(`
      agent:agents(
        id,
        name,
        email,
        commission_rate
      ),
      trip_id,
      commission_rate,
      status
    `)
        .in('trip_id', tripIds);
    if (error)
        throw new Error(`Failed to fetch agents: ${error.message}`);
    return data || [];
}
async function fetchRollingRecords(tripIds, startDate, endDate) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('rolling_records')
        .select('*')
        .in('trip_id', tripIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at');
    if (error)
        throw new Error(`Failed to fetch rolling records: ${error.message}`);
    return data || [];
}
async function fetchBuyInOutRecords(tripIds, startDate, endDate) {
    if (tripIds.length === 0)
        return [];
    const { data, error } = await supabase
        .from('buy_in_out_records')
        .select('*')
        .in('trip_id', tripIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at');
    if (error)
        throw new Error(`Failed to fetch buy-in/out records: ${error.message}`);
    return data || [];
}
async function fetchAgentDetails(agentId) {
    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();
    if (error)
        throw new Error(`Failed to fetch agent details: ${error.message}`);
    return data;
}
// =====================================================
// DATA PROCESSING FUNCTIONS
// =====================================================
function generateKeyMetrics(transactions, expenses, customers, trips) {
    const totalRolling = calculateTotalRolling(transactions);
    const totalCommission = calculateTotalCommission(transactions);
    const totalExpenses = calculateTotalExpenses(expenses);
    const housePnL = totalRolling - totalCommission - totalExpenses;
    const cashFlow = totalRolling - totalExpenses;
    return {
        totalRolling,
        totalCommission,
        housePnL,
        cashFlow,
        activeCustomers: customers?.length || 0,
        totalTrips: trips?.length || 0,
        activeTrips: trips?.filter(t => t.status === 'active').length || 0,
        profitMargin: trips?.length > 0 ? ((housePnL / totalRolling) * 100) : 0
    };
}
function generateChartData(transactions, expenses, startDate, endDate) {
    // Generate daily data for charts
    const dailyData = generateDailyData(startDate, endDate);
    // Aggregate transactions by date
    const dailyRolling = aggregateTransactionsByDate(transactions, 'rolling');
    const dailyCommission = aggregateTransactionsByDate(transactions, 'commission');
    const dailyCashFlow = aggregateCashFlowByDate(transactions, expenses);
    // Merge with daily data
    const chartData = dailyData.map(date => ({
        date,
        rolling: dailyRolling[date] || 0,
        commission: dailyCommission[date] || 0,
        cashFlow: dailyCashFlow[date] || 0
    }));
    return {
        dailyRollingAndCommission: chartData.map(d => ({
            date: d.date,
            rolling: d.rolling,
            commission: d.commission
        })),
        dailyCashFlow: chartData.map(d => ({
            date: d.date,
            cashFlow: d.cashFlow
        })),
        transactionVolume: generateTransactionVolumeData(transactions)
    };
}
function generatePerformanceSummary(trips, transactions, expenses) {
    const totalTrips = trips?.length || 0;
    const completedTrips = trips?.filter(t => t.status === 'completed').length || 0;
    const ongoingTrips = trips?.filter(t => t.status === 'active').length || 0;
    const totalRevenue = calculateTotalRolling(transactions);
    const totalCosts = calculateTotalCommission(transactions) + calculateTotalExpenses(expenses);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
    return {
        trips: {
            total: totalTrips,
            completed: completedTrips,
            ongoing: ongoingTrips,
            completionRate: totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0
        },
        financial: {
            totalRevenue,
            totalCosts,
            profitMargin,
            averageRevenuePerTrip: totalTrips > 0 ? totalRevenue / totalTrips : 0
        }
    };
}
function generateActivityOverview(rollingRecords, buyInOutRecords, customers) {
    return {
        rollingRecords: {
            total: rollingRecords?.length || 0,
            totalAmount: rollingRecords?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
            averageAmount: rollingRecords?.length > 0 ?
                rollingRecords.reduce((sum, r) => sum + (r.amount || 0), 0) / rollingRecords.length : 0
        },
        buyInOutRecords: {
            total: buyInOutRecords?.length || 0,
            buyIns: buyInOutRecords?.filter(r => r.type === 'buy_in').length || 0,
            buyOuts: buyInOutRecords?.filter(r => r.type === 'buy_out').length || 0,
            totalAmount: buyInOutRecords?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0
        },
        activeUsers: {
            totalCustomers: customers?.length || 0,
            uniqueCustomers: new Set(customers?.map(c => c.id)).size || 0,
            averageActivity: rollingRecords?.length > 0 ? rollingRecords.length / (customers?.length || 1) : 0
        }
    };
}
function generateAgentPerformance(agents, transactions, expenses, trips) {
    return agents?.map(agent => {
        const agentTrips = trips?.filter(t => agent.trip_id === t.id) || [];
        const agentTransactions = transactions?.filter(t => agentTrips.some(at => at.id === t.trip_id)) || [];
        const agentExpenses = expenses?.filter(e => agentTrips.some(at => at.id === e.trip_id)) || [];
        const totalRolling = calculateTotalRolling(agentTransactions);
        const totalCommission = calculateTotalCommission(agentTransactions);
        const totalExpenses = calculateTotalExpenses(agentExpenses);
        const profitMargin = totalRolling > 0 ? ((totalRolling - totalCommission - totalExpenses) / totalRolling) * 100 : 0;
        return {
            agent: agent.agent,
            performance: {
                customers: new Set(agentTransactions.map(t => t.customer_id)).size,
                rolling: totalRolling,
                commission: totalCommission,
                winLoss: totalRolling - totalCommission,
                cashFlow: totalRolling - totalExpenses,
                activity: agentTransactions.length,
                trips: agentTrips.length,
                profitMargin
            }
        };
    }) || [];
}
// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function calculateTotalRolling(transactions) {
    return transactions
        ?.filter(t => t.transaction_type === 'rolling')
        ?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
}
function calculateTotalCommission(transactions) {
    return transactions
        ?.filter(t => t.transaction_type === 'commission')
        ?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
}
function calculateTotalExpenses(expenses) {
    return expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
}
function calculateProfitMargin(transactions, expenses) {
    const totalRevenue = calculateTotalRolling(transactions);
    const totalCosts = calculateTotalCommission(transactions) + calculateTotalExpenses(expenses);
    return totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
}
function generateDailyData(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
function aggregateTransactionsByDate(transactions, type) {
    const dailyData = {};
    transactions
        ?.filter(t => t.transaction_type === type)
        ?.forEach(t => {
        const date = t.created_at.split('T')[0];
        dailyData[date] = (dailyData[date] || 0) + (t.amount || 0);
    });
    return dailyData;
}
function aggregateCashFlowByDate(transactions, expenses) {
    const dailyData = {};
    // Add rolling transactions (positive cash flow)
    transactions
        ?.filter(t => t.transaction_type === 'rolling')
        ?.forEach(t => {
        const date = t.created_at.split('T')[0];
        dailyData[date] = (dailyData[date] || 0) + (t.amount || 0);
    });
    // Subtract expenses (negative cash flow)
    expenses?.forEach(e => {
        const date = e.expense_date.split('T')[0];
        dailyData[date] = (dailyData[date] || 0) - (e.amount || 0);
    });
    return dailyData;
}
function generateTransactionVolumeData(transactions) {
    const volumeByType = transactions?.reduce((acc, t) => {
        const type = t.transaction_type;
        if (!acc[type]) {
            acc[type] = { count: 0, total: 0 };
        }
        acc[type].count += 1;
        acc[type].total += t.amount || 0;
        return acc;
    }, {}) || {};
    return Object.entries(volumeByType).map(([type, data]) => ({
        type,
        count: data.count,
        total: data.total,
        average: data.count > 0 ? data.total / data.count : 0
    }));
}
export default router;
//# sourceMappingURL=reports.js.map