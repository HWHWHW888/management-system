import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, canAccessTransaction } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// TRANSACTIONS API ENDPOINTS
// =====================================================
/**
 * GET /transactions
 * Admin see all, staff see only transactions linked to their trips
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { trip_id, customer_id } = req.query;
        
        let query = supabase
            .from('transactions')
            .select(`
          id,
          customer_id,
          trip_id,
          amount,
          transaction_type,
          status,
          created_at,
          customer:customers(id, name, email, vip_level),
          trip:trips(id, trip_name, destination, start_date, end_date)
        `)
            .order('created_at', { ascending: false });
        
        // Apply filters if provided
        if (trip_id) {
            query = query.eq('trip_id', trip_id);
        }
        if (customer_id) {
            query = query.eq('customer_id', customer_id);
        }
        // Staff can only see transactions for their trips
        if (userRole === 'staff') {
            console.log('Staff user accessing transactions, userId:', userId, 'staffId:', req.user.staff_id, 'trip_id:', trip_id);
            
            const staffId = req.user.staff_id;
            if (!staffId) {
                console.error('Staff user has no staff_id:', userId);
                return res.status(403).json({
                    error: 'Staff record not found'
                });
            }
            
            // If trip_id is provided in query, check if staff has access to that specific trip
            if (trip_id) {
                const { data: trip, error: tripError } = await supabase
                    .from('trips')
                    .select('id, staff_id')
                    .eq('id', trip_id)
                    .single();
                
                if (tripError || !trip) {
                    console.error('Trip not found:', trip_id, tripError);
                    return res.status(404).json({
                        error: 'Trip not found',
                        details: tripError?.message
                    });
                }
                
                console.log('Trip staff_id:', trip.staff_id, 'User staff_id:', staffId);
                
                let hasAccess = false;
                
                // Method 1: Check if staff_id matches (direct assignment)
                if (trip.staff_id === staffId) {
                    hasAccess = true;
                } else {
                    // Method 2: Check trip_staff relationship table (staff assigned through trip_staff)
                    const { data: tripStaff, error: tripStaffError } = await supabase
                        .from('trip_staff')
                        .select('id')
                        .eq('trip_id', trip_id)
                        .eq('staff_id', staffId)
                        .single();
                    
                    if (!tripStaffError && tripStaff) {
                        hasAccess = true;
                    }
                }
                
                if (!hasAccess) {
                    return res.status(403).json({
                        error: 'Access denied to this trip'
                    });
                }
                // Trip access verified, query will already be filtered by trip_id
            } else {
                // Get all trip IDs for this staff member (both direct and through trip_staff)
                let tripIds = [];
                
                // Method 1: Get trips where staff_id matches directly
                const { data: directTrips, error: directTripError } = await supabase
                    .from('trips')
                    .select('id')
                    .eq('staff_id', staffId);
                
                if (directTrips) {
                    tripIds = directTrips.map(trip => trip.id);
                }
                
                // Method 2: Get trips through trip_staff relationship table
                const { data: tripStaffData, error: tripStaffError } = await supabase
                    .from('trip_staff')
                    .select('trip_id')
                    .eq('staff_id', staffId);
                
                if (tripStaffData) {
                    const relationshipTripIds = tripStaffData.map(ts => ts.trip_id);
                    // Combine and deduplicate trip IDs
                    tripIds = [...new Set([...tripIds, ...relationshipTripIds])];
                }
                
                console.log('Staff trip IDs (combined):', tripIds);
                
                if (tripIds.length === 0) {
                    // Staff has no trips, return empty result
                    return res.json({
                        success: true,
                        data: [],
                        userRole,
                        total: 0
                    });
                }
                
                query = query.in('trip_id', tripIds);
            }
        }
        const { data: transactions, error } = await query;
        if (error) {
            console.error('Transaction query error:', error);
            return res.status(500).json({
                error: 'Failed to fetch transactions',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: transactions,
            userRole,
            total: transactions?.length || 0
        });
    }
    catch (error) {
        console.error('❌ GET /transactions endpoint error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * GET /transactions/:id
 * Admin see all, staff see only transactions linked to their trips
 */
router.get('/:id', authenticateToken, canAccessTransaction, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select(`
          id,
          customer_id,
          trip_id,
          amount,
          transaction_type,
          status,
          created_at,
          updated_at,
          customer:customers(id, name, email, vip_level, total_spent),
          trip:trips(id, trip_name, destination, start_date, end_date, status)
        `)
            .eq('id', transactionId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch transaction',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: transaction
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * POST /transactions
 * Staff & admin allowed (staff only for their trips)
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { customer_id, trip_id, amount, transaction_type, status } = req.body;
        const userRole = req.user.role;
        // Validate required fields
        if (!customer_id || !trip_id || !amount || !transaction_type) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['customer_id', 'trip_id', 'amount', 'transaction_type']
            });
        }
        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }
        // Validate transaction type
        const validTypes = ['rolling', 'buy_in', 'cash_out', 'chip_exchange', 'commission', 'other'];
        if (!validTypes.includes(transaction_type)) {
            return res.status(400).json({
                error: 'Invalid transaction type',
                validTypes
            });
        }
        // Staff can only create transactions for their trips
        if (userRole === 'staff') {
            const { data: trip, error: tripError } = await supabase
                .from('trips')
                .select('id, staff_id')
                .eq('id', trip_id)
                .single();
            if (tripError || !trip) {
                return res.status(404).json({ error: 'Trip not found' });
            }
            if (trip.staff_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied to this trip' });
            }
        }
        // Check if customer exists
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', customer_id)
            .single();
        if (customerError || !customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Check if trip exists
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('id')
            .eq('id', trip_id)
            .single();
        if (tripError || !trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        const { data: transaction, error } = await supabase
            .from('transactions')
            .insert({
            customer_id,
            trip_id,
            amount,
            transaction_type,
            status: status || 'pending'
        })
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to create transaction',
                details: error.message
            });
        }
        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: transaction
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * PUT /transactions/:id
 * Staff & admin allowed (staff only for their trips)
 */
router.put('/:id', authenticateToken, canAccessTransaction, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const updateData = req.body;
        // Check if transaction exists
        const { data: existingTransaction, error: checkError } = await supabase
            .from('transactions')
            .select('id, trip_id, amount, transaction_type')
            .eq('id', transactionId)
            .single();
        if (checkError || !existingTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        // Validate amount if updating
        if (updateData.amount !== undefined && updateData.amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }
        // Validate transaction type if updating
        if (updateData.transaction_type) {
            const validTypes = ['rolling', 'buy_in', 'cash_out', 'chip_exchange', 'commission', 'other'];
            if (!validTypes.includes(updateData.transaction_type)) {
                return res.status(400).json({
                    error: 'Invalid transaction type',
                    validTypes
                });
            }
        }
        const { data: transaction, error } = await supabase
            .from('transactions')
            .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
            .eq('id', transactionId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to update transaction',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * DELETE /transactions/:id
 * Only admin allowed
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const transactionId = req.params.id;
        // Check if transaction exists
        const { data: existingTransaction, error: checkError } = await supabase
            .from('transactions')
            .select('id')
            .eq('id', transactionId)
            .single();
        if (checkError || !existingTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId);
        if (error) {
            return res.status(500).json({
                error: 'Failed to delete transaction',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * GET /transactions/trip/:tripId
 * Get all transactions for a specific trip
 */
router.get('/trip/:tripId', authenticateToken, async (req, res) => {
    try {
        const tripId = req.params.tripId;
        const userRole = req.user.role;
        // Staff can only access their assigned trips
        if (userRole === 'staff') {
            const { data: trip, error: tripError } = await supabase
                .from('trips')
                .select('id, staff_id')
                .eq('id', tripId)
                .single();
            if (tripError || !trip) {
                return res.status(404).json({ error: 'Trip not found' });
            }
            if (trip.staff_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied to this trip' });
            }
        }
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select(`
          id,
          customer_id,
          trip_id,
          amount,
          transaction_type,
          status,
          created_at,
          customer:customers(id, name, email, vip_level)
        `)
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false });
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch trip transactions',
                details: error.message
            });
        }
        // Calculate totals by transaction type
        const totals = transactions?.reduce((acc, t) => {
            if (!acc[t.transaction_type]) {
                acc[t.transaction_type] = 0;
            }
            acc[t.transaction_type] += t.amount;
            return acc;
        }, {}) || {};
        res.json({
            success: true,
            data: transactions,
            totals,
            totalTransactions: transactions?.length || 0
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * GET /transactions/customer/:customerId
 * Get all transactions for a specific customer
 */
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
    try {
        const customerId = req.params.customerId;
        const userRole = req.user.role;
        let query = supabase
            .from('transactions')
            .select(`
          id,
          customer_id,
          trip_id,
          amount,
          transaction_type,
          status,
          created_at,
          trip:trips(id, trip_name, destination, start_date, end_date)
        `)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
        // Staff can only see transactions for their trips
        if (userRole === 'staff') {
            // First get the trip IDs for this staff member
            const { data: staffTrips, error: tripError } = await supabase
                .from('trips')
                .select('id')
                .eq('staff_id', req.user.id);
            
            if (tripError) {
                return res.status(500).json({
                    error: 'Failed to fetch staff trips',
                    details: tripError.message
                });
            }
            
            const tripIds = staffTrips?.map(trip => trip.id) || [];
            if (tripIds.length === 0) {
                // Staff has no trips, return empty result
                return res.json({
                    success: true,
                    data: [],
                    totals: {},
                    totalTransactions: 0
                });
            }
            
            query = query.in('trip_id', tripIds);
        }
        const { data: transactions, error } = await query;
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch customer transactions',
                details: error.message
            });
        }
        // Calculate totals by transaction type
        const totals = transactions?.reduce((acc, t) => {
            if (!acc[t.transaction_type]) {
                acc[t.transaction_type] = 0;
            }
            acc[t.transaction_type] += t.amount;
            return acc;
        }, {}) || {};
        res.json({
            success: true,
            data: transactions,
            totals,
            totalTransactions: transactions?.length || 0
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
/**
 * POST /transactions/bulk
 * Create multiple transactions at once (admin only)
 */
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({
                error: 'Transactions array is required and must not be empty'
            });
        }
        // Validate each transaction
        for (const transaction of transactions) {
            if (!transaction.customer_id || !transaction.trip_id || !transaction.amount || !transaction.transaction_type) {
                return res.status(400).json({
                    error: 'Each transaction must have customer_id, trip_id, amount, and transaction_type'
                });
            }
            if (transaction.amount <= 0) {
                return res.status(400).json({
                    error: 'Amount must be greater than 0 for all transactions'
                });
            }
        }
        const { data: createdTransactions, error } = await supabase
            .from('transactions')
            .insert(transactions)
            .select();
        if (error) {
            return res.status(500).json({
                error: 'Failed to create bulk transactions',
                details: error.message
            });
        }
        res.status(201).json({
            success: true,
            message: `${createdTransactions?.length || 0} transactions created successfully`,
            data: createdTransactions
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
export default router;
//# sourceMappingURL=transactions.js.map