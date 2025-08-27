import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware, requireAdmin, canAccessTrip } from '../middleware/auth';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// TRIPS API ENDPOINTS
// =====================================================
/**
 * GET /trips/my-schedule
 * Staff can only see their assigned trips
 * Admin can see all trips
 */
router.get('/my-schedule', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        let query = supabase
            .from('trips')
            .select(`
          id,
          trip_name,
          destination,
          start_date,
          end_date,
          status,
          total_budget,
          created_at,
          updated_at,
          staff:staff(id, name, email),
          customers:trip_customers(
            customer:customers(id, name, email, vip_level)
          ),
          expenses:trip_expenses(id, expense_type, amount, description, expense_date)
        `);
        // Staff can only see their assigned trips
        if (userRole === 'staff') {
            query = query.eq('staff_id', userId);
        }
        // Add filters for active trips
        query = query.eq('status', 'active');
        const { data: trips, error } = await query;
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch trips',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: trips,
            userRole,
            totalTrips: trips?.length || 0
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
 * GET /trips
 * Admin can see all trips
 * Staff can only see their assigned trips
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        let query = supabase
            .from('trips')
            .select(`
          id,
          trip_name,
          destination,
          start_date,
          end_date,
          status,
          total_budget,
          created_at,
          updated_at,
          staff:staff(id, name, email)
        `);
        // Staff can only see their assigned trips
        if (userRole === 'staff') {
            query = query.eq('staff_id', userId);
        }
        const { data: trips, error } = await query;
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch trips',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: trips,
            userRole,
            totalTrips: trips?.length || 0
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
 * GET /trips/:id
 * Admin can see any trip
 * Staff can only see their assigned trips
 */
router.get('/:id', authenticateUser, requirePermission('trips:read'), canAccessTrip, async (req, res) => {
    try {
        const tripId = req.params.id;
        const { data: trip, error } = await supabase
            .from('trips')
            .select(`
          id,
          trip_name,
          destination,
          start_date,
          end_date,
          status,
          total_budget,
          created_at,
          updated_at,
          staff:staff(id, name, email, phone),
          customers:trip_customers(
            customer:customers(id, name, email, vip_level, total_spent)
          ),
          agents:trip_agents(
            agent:agents(id, name, email, commission_rate)
          ),
          expenses:trip_expenses(id, expense_type, amount, description, expense_date),
          transactions:transactions(id, amount, transaction_type, status, created_at)
        `)
            .eq('id', tripId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Trip not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch trip',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: trip
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
 * POST /trips
 * Only admin can create new trips
 */
router.post('/', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { trip_name, destination, start_date, end_date, total_budget, staff_id } = req.body;
        // Validate required fields
        if (!trip_name || !destination || !start_date || !end_date) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['trip_name', 'destination', 'start_date', 'end_date']
            });
        }
        const { data: trip, error } = await supabase
            .from('trips')
            .insert({
            trip_name,
            destination,
            start_date,
            end_date,
            total_budget: total_budget || 0,
            staff_id,
            status: 'active'
        })
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to create trip',
                details: error.message
            });
        }
        res.status(201).json({
            success: true,
            message: 'Trip created successfully',
            data: trip
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
 * PUT /trips/:id
 * Admin can update any trip
 * Staff can only update their assigned trips (for check-in/check-out)
 */
router.put('/:id', authenticateUser, requirePermission('trips:update'), canAccessTrip, async (req, res) => {
    try {
        const tripId = req.params.id;
        const userRole = req.user.role;
        const updateData = req.body;
        // Staff can only update specific fields (check-in/check-out)
        if (userRole === 'staff') {
            const allowedFields = ['status', 'check_in_time', 'check_out_time', 'notes'];
            const filteredData = {};
            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    filteredData[field] = updateData[field];
                }
            });
            // Staff cannot update critical fields
            if (Object.keys(filteredData).length === 0) {
                return res.status(400).json({
                    error: 'No allowed fields to update',
                    allowedFields
                });
            }
            updateData = filteredData;
        }
        const { data: trip, error } = await supabase
            .from('trips')
            .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
            .eq('id', tripId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to update trip',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Trip updated successfully',
            data: trip
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
 * DELETE /trips/:id
 * Only admin can delete trips
 */
router.delete('/:id', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const tripId = req.params.id;
        // Check if trip has related data
        const { data: relatedData, error: checkError } = await supabase
            .from('transactions')
            .select('id')
            .eq('trip_id', tripId)
            .limit(1);
        if (checkError) {
            return res.status(500).json({
                error: 'Failed to check trip dependencies',
                details: checkError.message
            });
        }
        if (relatedData && relatedData.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete trip with existing transactions',
                message: 'Please delete related transactions first'
            });
        }
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', tripId);
        if (error) {
            return res.status(500).json({
                error: 'Failed to delete trip',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Trip deleted successfully'
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
 * POST /trips/:id/check-in
 * Staff can check-in to their assigned trips
 */
router.post('/:id/check-in', authenticateUser, requirePermission('trips:update'), canAccessTrip, async (req, res) => {
    try {
        const tripId = req.params.id;
        const { check_in_time, notes } = req.body;
        const { data: trip, error } = await supabase
            .from('trips')
            .update({
            status: 'in-progress',
            check_in_time: check_in_time || new Date().toISOString(),
            check_in_notes: notes,
            updated_at: new Date().toISOString()
        })
            .eq('id', tripId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to check-in',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Check-in successful',
            data: trip
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
 * POST /trips/:id/check-out
 * Staff can check-out from their assigned trips
 */
router.post('/:id/check-out', authenticateUser, requirePermission('trips:update'), canAccessTrip, async (req, res) => {
    try {
        const tripId = req.params.id;
        const { check_out_time, notes } = req.body;
        const { data: trip, error } = await supabase
            .from('trips')
            .update({
            status: 'completed',
            check_out_time: check_out_time || new Date().toISOString(),
            check_out_notes: notes,
            updated_at: new Date().toISOString()
        })
            .eq('id', tripId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to check-out',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Check-out successful',
            data: trip
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
//# sourceMappingURL=trips.js.map