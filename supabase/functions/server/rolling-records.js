import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, canAccessTrip } from './auth.js';
import { 
  updateCustomerTripStats, 
  updateTripStats, 
  updateTripSharing,
  updateCustomerTotalRolling
} from './trips.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// TRIP ROLLING RECORDS API ENDPOINTS
// =====================================================

/**
 * GET /rolling-records
 * Get all trip rolling records with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { trip_id, customer_id, staff_id, game_type, limit = 50, offset = 0 } = req.query;
        const userRole = req.user.role;

        let query = supabase
            .from('trip_rolling')
            .select(`
                id,
                trip_id,
                customer_id,
                staff_id,
                game_type,
                rolling_amount,
                venue,
                attachment_id,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (trip_id) query = query.eq('trip_id', trip_id);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (staff_id) query = query.eq('staff_id', staff_id);
        if (game_type) query = query.eq('game_type', game_type);

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
                error: 'Failed to fetch trip rolling records',
                details: error.message
            });
        }

        // Calculate totals
        const totals = records?.reduce((acc, record) => {
            acc.total_rolling += record.rolling_amount || 0;
            return acc;
        }, {
            total_rolling: 0
        });

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
 * GET /rolling-records/summary
 * Get trip rolling records summary statistics
 */
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { trip_id, customer_id, staff_id, game_type } = req.query;
        const userRole = req.user.role;

        let query = supabase
            .from('trip_rolling')
            .select('*');

        // Apply filters
        if (trip_id) query = query.eq('trip_id', trip_id);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (staff_id) query = query.eq('staff_id', staff_id);
        if (game_type) query = query.eq('game_type', game_type);

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
                return res.json({ success: true, data: {} });
            }
        }

        const { data: records, error } = await query;

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch trip rolling records summary',
                details: error.message
            });
        }

        const summary = records?.reduce((acc, record) => {
            acc.total_rolling += record.rolling_amount || 0;
            acc.total_records++;
            
            // Count unique customers
            if (!acc.unique_customers.has(record.customer_id)) {
                acc.unique_customers.add(record.customer_id);
            }
            
            return acc;
        }, {
            total_rolling: 0,
            total_records: 0,
            unique_customers: new Set()
        });

        if (summary) {
            summary.unique_customers_count = summary.unique_customers.size;
            delete summary.unique_customers; // Remove Set object before sending response
        }

        res.json({
            success: true,
            data: summary || {
                total_rolling: 0,
                total_records: 0,
                unique_customers_count: 0
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
 * GET /rolling-records/:id
 * Get a specific rolling record
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const userRole = req.user.role;

        const { data: record, error } = await supabase
            .from('trip_rolling')
            .select(`
                id,
                trip_id,
                customer_id,
                staff_id,
                game_type,
                rolling_amount,
                venue,
                attachment_id,
                created_at,
                updated_at
            `)
            .eq('id', recordId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Rolling record not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch rolling record',
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
 * POST /rolling-records
 * Create a new rolling record
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            trip_id,
            customer_id,
            staff_id,
            game_type,
            rolling_amount,
            venue,
            attachment_id
        } = req.body;

        const userRole = req.user.role;
        const userId = req.user.id;

        // Validate required fields
        if (!trip_id || !customer_id || !staff_id || !game_type || !rolling_amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['trip_id', 'customer_id', 'staff_id', 'game_type', 'rolling_amount']
            });
        }

        // Validate amounts
        if (rolling_amount < 0) {
            return res.status(400).json({
                error: 'Rolling amount must be non-negative'
            });
        }

        // Staff can only create records for their trips
        if (userRole === 'staff') {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', trip_id)
                .single();

            if (!trip || trip.staff_id !== userId) {
                return res.status(403).json({ error: 'Access denied to this trip' });
            }
        }

        const recordData = {
            trip_id,
            customer_id,
            staff_id,
            game_type,
            rolling_amount,
            venue,
            attachment_id
        };

        const { data: record, error } = await supabase
            .from('trip_rolling')
            .insert(recordData)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to create rolling record',
                details: error.message
            });
        }

        // Update customer trip stats to include rolling amount
        await updateCustomerTripStats(trip_id, customer_id);

        // Update trip statistics
        await updateTripStats(trip_id);

        // Update trip sharing calculations
        await updateTripSharing(trip_id);

        // Update customer's total rolling amount across all trips
        await updateCustomerTotalRolling(customer_id);
        
        console.log(`🎲 Rolling record created and customer data synchronized for customer: ${customer_id}`);

        res.status(201).json({
            success: true,
            message: 'Rolling record created successfully',
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
 * PUT /rolling-records/:id
 * Update a rolling record
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const updateData = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        // Check if record exists
        const { data: existingRecord, error: checkError } = await supabase
            .from('trip_rolling')
            .select('id, trip_id, customer_id')
            .eq('id', recordId)
            .single();

        if (checkError || !existingRecord) {
            return res.status(404).json({ error: 'Rolling record not found' });
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

        // Validate amounts if updating
        if (updateData.rolling_amount !== undefined && updateData.rolling_amount < 0) {
            return res.status(400).json({
                error: 'Rolling amount must be non-negative'
            });
        }

        const { data: record, error } = await supabase
            .from('trip_rolling')
            .update(updateData)
            .eq('id', recordId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to update rolling record',
                details: error.message
            });
        }

        // Update customer trip stats after rolling record update
        await updateCustomerTripStats(existingRecord.trip_id, existingRecord.customer_id);

        // Update trip statistics
        await updateTripStats(existingRecord.trip_id);

        // Update trip sharing calculations
        await updateTripSharing(existingRecord.trip_id);

        // Update customer's total rolling amount across all trips
        await updateCustomerTotalRolling(existingRecord.customer_id);
        
        console.log(`🎲 Rolling record updated and customer data synchronized for customer: ${existingRecord.customer_id}`);

        res.json({
            success: true,
            message: 'Rolling record updated successfully',
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
 * DELETE /rolling-records/:id
 * Delete a rolling record
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const userRole = req.user.role;
        const userId = req.user.id;

        // Check if record exists
        const { data: existingRecord, error: checkError } = await supabase
            .from('trip_rolling')
            .select('id, trip_id, customer_id')
            .eq('id', recordId)
            .single();

        if (checkError || !existingRecord) {
            return res.status(404).json({ error: 'Rolling record not found' });
        }

        // Staff can only delete records from their trips
        if (userRole === 'staff') {
            const { data: trip } = await supabase
                .from('trips')
                .select('staff_id')
                .eq('id', existingRecord.trip_id)
                .single();

            if (!trip || trip.staff_id !== userId) {
                return res.status(403).json({ error: 'Access denied to this record' });
            }
        }

        const { error } = await supabase
            .from('trip_rolling')
            .delete()
            .eq('id', recordId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to delete rolling record',
                details: error.message
            });
        }

        // Update customer trip stats after rolling record deletion
        await updateCustomerTripStats(existingRecord.trip_id, existingRecord.customer_id);

        // Update trip statistics
        await updateTripStats(existingRecord.trip_id);

        // Update trip sharing calculations
        await updateTripSharing(existingRecord.trip_id);

        // Update customer's total rolling amount across all trips
        await updateCustomerTotalRolling(existingRecord.customer_id);
        
        console.log(`🎲 Rolling record deleted and customer data synchronized for customer: ${existingRecord.customer_id}`);

        res.json({
            success: true,
            message: 'Rolling record deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default router;
