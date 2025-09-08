import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// CHIP EXCHANGES API ENDPOINTS
// =====================================================

/**
 * GET /chip-exchanges
 * Get all chip exchanges with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { customer_id, exchange_type, limit = 50, offset = 0 } = req.query;
        const userRole = req.user.role;

        let query = supabase
            .from('chip_exchanges')
            .select(`
                id,
                customer_id,
                customer_name,
                staff_id,
                staff_name,
                amount,
                exchange_type,
                timestamp,
                proof_photo
            `)
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (exchange_type) query = query.eq('exchange_type', exchange_type);

        // Staff can only see their own exchanges
        if (userRole === 'staff') {
            query = query.eq('staff_id', req.user.id);
        }

        const { data: exchanges, error } = await query;

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch chip exchanges',
                details: error.message
            });
        }

        // Calculate totals by exchange type
        const totals = exchanges?.reduce((acc, exchange) => {
            const type = exchange.exchange_type || 'unknown';
            if (!acc[type]) acc[type] = 0;
            acc[type] += exchange.amount || 0;
            acc.total_amount += exchange.amount || 0;
            return acc;
        }, { total_amount: 0 });

        res.json({
            success: true,
            data: exchanges,
            totals,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: exchanges?.length || 0
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
 * GET /chip-exchanges/:id
 * Get a specific chip exchange
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const exchangeId = req.params.id;
        const userRole = req.user.role;

        const { data: exchange, error } = await supabase
            .from('chip_exchanges')
            .select('*')
            .eq('id', exchangeId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Chip exchange not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch chip exchange',
                details: error.message
            });
        }

        // Staff can only access their own exchanges
        if (userRole === 'staff' && exchange.staff_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to this exchange' });
        }

        res.json({
            success: true,
            data: exchange
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /chip-exchanges
 * Create a new chip exchange
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            customer_id,
            customer_name,
            amount,
            exchange_type,
            proof_photo
        } = req.body;

        const userId = req.user.id;

        // Validate required fields
        if (!customer_id || !amount || !exchange_type) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['customer_id', 'amount', 'exchange_type']
            });
        }

        // Validate exchange type
        const validTypes = ['cash_to_chips', 'chips_to_cash', 'chip_denomination_change'];
        if (!validTypes.includes(exchange_type)) {
            return res.status(400).json({
                error: 'Invalid exchange type',
                validTypes
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                error: 'Amount must be greater than 0'
            });
        }

        // Get staff info
        const { data: staff } = await supabase
            .from('staff')
            .select('name')
            .eq('id', userId)
            .single();

        const exchangeData = {
            customer_id,
            customer_name,
            staff_id: userId,
            staff_name: staff?.name || 'Unknown Staff',
            amount,
            exchange_type,
            timestamp: new Date().toISOString(),
            proof_photo
        };

        const { data: exchange, error } = await supabase
            .from('chip_exchanges')
            .insert(exchangeData)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to create chip exchange',
                details: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Chip exchange created successfully',
            data: exchange
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * PUT /chip-exchanges/:id
 * Update a chip exchange
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const exchangeId = req.params.id;
        const updateData = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        // Check if exchange exists
        const { data: existingExchange, error: checkError } = await supabase
            .from('chip_exchanges')
            .select('id, staff_id')
            .eq('id', exchangeId)
            .single();

        if (checkError || !existingExchange) {
            return res.status(404).json({ error: 'Chip exchange not found' });
        }

        // Staff can only update their own exchanges, admin can update any
        if (userRole === 'staff' && existingExchange.staff_id !== userId) {
            return res.status(403).json({ error: 'Access denied to this exchange' });
        }

        // Validate exchange type if updating
        if (updateData.exchange_type) {
            const validTypes = ['cash_to_chips', 'chips_to_cash', 'chip_denomination_change'];
            if (!validTypes.includes(updateData.exchange_type)) {
                return res.status(400).json({
                    error: 'Invalid exchange type',
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

        const { data: exchange, error } = await supabase
            .from('chip_exchanges')
            .update(updateData)
            .eq('id', exchangeId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to update chip exchange',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Chip exchange updated successfully',
            data: exchange
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * DELETE /chip-exchanges/:id
 * Delete a chip exchange (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const exchangeId = req.params.id;

        const { error } = await supabase
            .from('chip_exchanges')
            .delete()
            .eq('id', exchangeId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to delete chip exchange',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Chip exchange deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /chip-exchanges/customer/:customerId/summary
 * Get chip exchanges summary for a customer
 */
router.get('/customer/:customerId/summary', authenticateToken, async (req, res) => {
    try {
        const customerId = req.params.customerId;
        const userRole = req.user.role;

        let query = supabase
            .from('chip_exchanges')
            .select('exchange_type, amount, timestamp')
            .eq('customer_id', customerId);

        // Staff can only see their own exchanges
        if (userRole === 'staff') {
            query = query.eq('staff_id', req.user.id);
        }

        const { data: exchanges, error } = await query;

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch chip exchanges summary',
                details: error.message
            });
        }

        const summary = exchanges?.reduce((acc, exchange) => {
            const type = exchange.exchange_type;
            if (!acc.by_type[type]) acc.by_type[type] = 0;
            acc.by_type[type] += exchange.amount || 0;
            acc.total_amount += exchange.amount || 0;
            acc.total_exchanges++;
            
            return acc;
        }, {
            by_type: {},
            total_amount: 0,
            total_exchanges: 0
        });

        res.json({
            success: true,
            data: summary || {
                by_type: {},
                total_amount: 0,
                total_exchanges: 0
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
 * GET /chip-exchanges/staff/:staffId/summary
 * Get chip exchanges summary for a staff member (admin only)
 */
router.get('/staff/:staffId/summary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const staffId = req.params.staffId;

        const { data: exchanges, error } = await supabase
            .from('chip_exchanges')
            .select('exchange_type, amount, timestamp, customer_id')
            .eq('staff_id', staffId);

        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch chip exchanges summary',
                details: error.message
            });
        }

        const summary = exchanges?.reduce((acc, exchange) => {
            const type = exchange.exchange_type;
            if (!acc.by_type[type]) acc.by_type[type] = 0;
            acc.by_type[type] += exchange.amount || 0;
            acc.total_amount += exchange.amount || 0;
            acc.total_exchanges++;
            
            // Count unique customers
            if (!acc.unique_customers.has(exchange.customer_id)) {
                acc.unique_customers.add(exchange.customer_id);
            }
            
            return acc;
        }, {
            by_type: {},
            total_amount: 0,
            total_exchanges: 0,
            unique_customers: new Set()
        });

        if (summary) {
            summary.unique_customers_count = summary.unique_customers.size;
            delete summary.unique_customers; // Remove Set object before sending response
        }

        res.json({
            success: true,
            data: summary || {
                by_type: {},
                total_amount: 0,
                total_exchanges: 0,
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

export default router;
