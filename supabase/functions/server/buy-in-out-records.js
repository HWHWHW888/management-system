import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// BUY-IN/OUT RECORDS API ENDPOINTS
// =====================================================

/**
 * GET /buy-in-out-records
 * Get all buy-in/out records with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { trip_id, customer_id, transaction_type, limit = 50, offset = 0 } = req.query;
        const userRole = req.user.role;

        let query = supabase
            .from('buy_in_out_records')
            .select(`
                id,
                customer_id,
                customer_name,
                staff_id,
                staff_name,
                transaction_type,
                amount,
                timestamp,
                venue,
                table_number,
                notes,
                proof_photo,
                shift_id,
                trip_id
            `)
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (trip_id) query = query.eq('trip_id', trip_id);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (transaction_type) query = query.eq('transaction_type', transaction_type);

        // Staff can only see records for their trips
        if (userRole === 'staff') {
            const { data: staffTrips } = await supabase
                .from('trips')
                .select('id')
                .eq('staff_id', req.user.id);
            
            const tripIds = staffTrips?.map(t => t.id) || [];
            if (tripIds.length > 0) {
                query = query.in('trip_id', tripIds);
            } else {
                return res.json({ success: true, data: [], total: 0 });
            }
        }

        const { data: records, error } = await query;

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch buy-in/out records',
                details: error.message
            });
        }

        // Calculate totals by transaction type
        const totals = records?.reduce((acc, record) => {
            const type = record.transaction_type || 'unknown';
            if (!acc[type]) acc[type] = 0;
            acc[type] += record.amount || 0;
            acc.total_amount += record.amount || 0;
            return acc;
        }, { total_amount: 0 });

        res.json({
            success: true,
            data: records,
            totals,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: records?.length || 0
            }
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /buy-in-out-records/:id
 * Get a specific buy-in/out record
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const userRole = req.user.role;

        const { data: record, error } = await supabase
            .from('buy_in_out_records')
            .select('*')
            .eq('id', recordId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Buy-in/out record not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch buy-in/out record',
                details: error.message
            });
        }

        // Staff can only access records from their trips
        if (userRole === 'staff' && record.trip_id) {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', record.trip_id)
                .single();

            if (!trip || trip.staff_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied to this record' });
            }
        }

        res.json({
            success: true,
            data: record
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /buy-in-out-records
 * Create a new buy-in/out record
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            customer_id,
            customer_name,
            transaction_type,
            amount,
            venue,
            table_number,
            notes,
            trip_id,
            shift_id,
            proof_photo
        } = req.body;

        const userRole = req.user.role;
        const userId = req.user.id;

        // Validate required fields
        if (!customer_id || !transaction_type || !amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['customer_id', 'transaction_type', 'amount']
            });
        }

        // Validate transaction type
        const validTypes = ['buy_in', 'buy_out', 'cash_in', 'cash_out'];
        if (!validTypes.includes(transaction_type)) {
            return res.status(400).json({
                error: 'Invalid transaction type',
                validTypes
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }

        // Staff can only create records for their trips
        if (userRole === 'staff' && trip_id) {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', trip_id)
                .single();

            if (!trip || trip.staff_id !== userId) {
                return res.status(403).json({ error: 'Access denied to this trip' });
            }
        }

        // Get staff info
        const { data: staff } = await supabase
            .from('staff')
            .select('name')
            .eq('id', userId)
            .single();

        const recordData = {
            customer_id,
            customer_name,
            staff_id: userId,
            staff_name: staff?.name || 'Unknown Staff',
            transaction_type,
            amount,
            timestamp: new Date().toISOString(),
            venue,
            table_number,
            notes,
            trip_id,
            shift_id,
            proof_photo
        };

        const { data: record, error } = await supabase
            .from('buy_in_out_records')
            .insert(recordData)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to create buy-in/out record',
                details: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Buy-in/out record created successfully',
            data: record
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * PUT /buy-in-out-records/:id
 * Update a buy-in/out record
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const updateData = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        // Check if record exists
        const { data: existingRecord, error: checkError } = await supabase
            .from('buy_in_out_records')
            .select('id, trip_id')
            .eq('id', recordId)
            .single();

        if (checkError || !existingRecord) {
            return res.status(404).json({ error: 'Buy-in/out record not found' });
        }

        // Staff can only update records from their trips
        if (userRole === 'staff' && existingRecord.trip_id) {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', existingRecord.trip_id)
                .single();

            if (!trip || trip.staff_id !== userId) {
                return res.status(403).json({ error: 'Access denied to this record' });
            }
        }

        // Validate transaction type if updating
        if (updateData.transaction_type) {
            const validTypes = ['buy_in', 'buy_out', 'cash_in', 'cash_out'];
            if (!validTypes.includes(updateData.transaction_type)) {
                return res.status(400).json({
                    error: 'Invalid transaction type',
                    validTypes
                });
            }
        }

        // Validate amount if updating
        if (updateData.amount !== undefined && updateData.amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }

        const { data: record, error } = await supabase
            .from('buy_in_out_records')
            .update(updateData)
            .eq('id', recordId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to update buy-in/out record',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Buy-in/out record updated successfully',
            data: record
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * DELETE /buy-in-out-records/:id
 * Delete a buy-in/out record (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const recordId = req.params.id;

        const { error } = await supabase
            .from('buy_in_out_records')
            .delete()
            .eq('id', recordId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to delete buy-in/out record',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Buy-in/out record deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /buy-in-out-records/trip/:tripId/summary
 * Get buy-in/out records summary for a trip
 */
router.get('/trip/:tripId/summary', authenticateToken, async (req, res) => {
    try {
        const tripId = req.params.tripId;
        const userRole = req.user.role;

        // Staff can only access their trips
        if (userRole === 'staff') {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', tripId)
                .single();

            if (!trip || trip.staff_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied to this trip' });
            }
        }

        const { data: records, error } = await supabase
            .from('buy_in_out_records')
            .select('transaction_type, amount, customer_id')
            .eq('trip_id', tripId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch buy-in/out records summary',
                details: error.message
            });
        }

        const summary = records?.reduce((acc, record) => {
            const type = record.transaction_type;
            if (!acc.by_type[type]) acc.by_type[type] = 0;
            acc.by_type[type] += record.amount || 0;
            acc.total_amount += record.amount || 0;
            acc.total_records++;
            
            // Count unique customers
            if (!acc.unique_customers.has(record.customer_id)) {
                acc.unique_customers.add(record.customer_id);
            }
            
            return acc;
        }, {
            by_type: {},
            total_amount: 0,
            total_records: 0,
            unique_customers: new Set()
        });

        if (summary) {
            summary.unique_customers_count = summary.unique_customers.size;
            delete summary.unique_customers; // Remove Set object before sending response
            
            // Calculate net result (buy_out + cash_out - buy_in - cash_in)
            const buyIn = (summary.by_type.buy_in || 0) + (summary.by_type.cash_in || 0);
            const buyOut = (summary.by_type.buy_out || 0) + (summary.by_type.cash_out || 0);
            summary.net_result = buyOut - buyIn;
        }

        res.json({
            success: true,
            data: summary || {
                by_type: {},
                total_amount: 0,
                total_records: 0,
                unique_customers_count: 0,
                net_result: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default router;
