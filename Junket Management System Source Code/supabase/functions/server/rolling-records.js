import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// ROLLING RECORDS API ENDPOINTS
// =====================================================

/**
 * GET /rolling-records
 * Get all rolling records with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { trip_id, customer_id, agent_id, verified, limit = 50, offset = 0 } = req.query;
        const userRole = req.user.role;

        let query = supabase
            .from('rolling_records')
            .select(`
                id,
                customer_id,
                customer_name,
                agent_id,
                agent_name,
                staff_id,
                staff_name,
                rolling_amount,
                win_loss,
                buy_in_amount,
                buy_out_amount,
                game_type,
                venue,
                table_number,
                session_start_time,
                session_end_time,
                recorded_at,
                notes,
                verified,
                verified_by,
                verified_at,
                shift_id,
                trip_id
            `)
            .order('recorded_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (trip_id) query = query.eq('trip_id', trip_id);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (agent_id) query = query.eq('agent_id', agent_id);
        if (verified !== undefined) query = query.eq('verified', verified === 'true');

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
                error: 'Failed to fetch rolling records',
                details: error.message
            });
        }

        // Calculate totals
        const totals = records?.reduce((acc, record) => {
            acc.total_rolling += record.rolling_amount || 0;
            acc.total_win_loss += record.win_loss || 0;
            acc.total_buy_in += record.buy_in_amount || 0;
            acc.total_buy_out += record.buy_out_amount || 0;
            return acc;
        }, {
            total_rolling: 0,
            total_win_loss: 0,
            total_buy_in: 0,
            total_buy_out: 0
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
 * GET /rolling-records/:id
 * Get a specific rolling record
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        const userRole = req.user.role;

        const { data: record, error } = await supabase
            .from('rolling_records')
            .select(`
                *,
                attachments,
                ocr_data
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
            customer_id,
            customer_name,
            agent_id,
            agent_name,
            rolling_amount,
            win_loss,
            buy_in_amount,
            buy_out_amount,
            game_type,
            venue,
            table_number,
            session_start_time,
            session_end_time,
            notes,
            trip_id,
            shift_id,
            attachments,
            ocr_data
        } = req.body;

        const userRole = req.user.role;
        const userId = req.user.id;

        // Validate required fields
        if (!customer_id || !rolling_amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['customer_id', 'rolling_amount']
            });
        }

        // Validate amounts
        if (rolling_amount < 0) {
            return res.status(400).json({
                error: 'Rolling amount must be non-negative'
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
            agent_id,
            agent_name,
            staff_id: userId,
            staff_name: staff?.name || 'Unknown Staff',
            rolling_amount,
            win_loss: win_loss || 0,
            buy_in_amount: buy_in_amount || 0,
            buy_out_amount: buy_out_amount || 0,
            game_type,
            venue,
            table_number,
            session_start_time,
            session_end_time,
            recorded_at: new Date().toISOString(),
            notes,
            trip_id,
            shift_id,
            attachments,
            ocr_data,
            verified: false
        };

        const { data: record, error } = await supabase
            .from('rolling_records')
            .insert(recordData)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to create rolling record',
                details: error.message
            });
        }

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
            .from('rolling_records')
            .select('id, trip_id, verified')
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
            .from('rolling_records')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', recordId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to update rolling record',
                details: error.message
            });
        }

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
 * POST /rolling-records/:id/verify
 * Verify a rolling record (admin only)
 */
router.post('/:id/verify', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const recordId = req.params.id;
        const { notes } = req.body;
        const userId = req.user.id;

        const { data: record, error } = await supabase
            .from('rolling_records')
            .update({
                verified: true,
                verified_by: userId,
                verified_at: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', recordId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to verify rolling record',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Rolling record verified successfully',
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
 * Delete a rolling record (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const recordId = req.params.id;

        const { error } = await supabase
            .from('rolling_records')
            .delete()
            .eq('id', recordId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to delete rolling record',
                details: error.message
            });
        }

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

/**
 * GET /rolling-records/trip/:tripId/summary
 * Get rolling records summary for a trip
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
            .from('rolling_records')
            .select('rolling_amount, win_loss, buy_in_amount, buy_out_amount, verified, customer_id')
            .eq('trip_id', tripId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch rolling records summary',
                details: error.message
            });
        }

        const summary = records?.reduce((acc, record) => {
            acc.total_rolling += record.rolling_amount || 0;
            acc.total_win_loss += record.win_loss || 0;
            acc.total_buy_in += record.buy_in_amount || 0;
            acc.total_buy_out += record.buy_out_amount || 0;
            acc.total_records++;
            
            if (record.verified) acc.verified_records++;
            
            // Count unique customers
            if (!acc.unique_customers.has(record.customer_id)) {
                acc.unique_customers.add(record.customer_id);
            }
            
            return acc;
        }, {
            total_rolling: 0,
            total_win_loss: 0,
            total_buy_in: 0,
            total_buy_out: 0,
            total_records: 0,
            verified_records: 0,
            unique_customers: new Set()
        });

        if (summary) {
            summary.unique_customers_count = summary.unique_customers.size;
            delete summary.unique_customers; // Remove Set object before sending response
            summary.net_result = summary.total_buy_out - summary.total_buy_in + summary.total_win_loss;
            summary.verification_rate = summary.total_records > 0 ? 
                (summary.verified_records / summary.total_records * 100).toFixed(2) : 0;
        }

        res.json({
            success: true,
            data: summary || {
                total_rolling: 0,
                total_win_loss: 0,
                total_buy_in: 0,
                total_buy_out: 0,
                total_records: 0,
                verified_records: 0,
                unique_customers_count: 0,
                net_result: 0,
                verification_rate: 0
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
