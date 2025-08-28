import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware, requireAdmin } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// CUSTOMERS API ENDPOINTS
// =====================================================
/**
 * GET /customers
 * All roles can view customers
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select(`
          id,
          name,
          email,
          phone,
          vip_level,
          total_spent,
          status,
          created_at,
          updated_at
        `)
            .order('name');
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch customers',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: customers,
            total: customers?.length || 0
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
 * GET /customers/:id
 * All roles can view specific customer
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const customerId = req.params.id;
        const { data: customer, error } = await supabase
            .from('customers')
            .select(`
          id,
          name,
          email,
          phone,
          vip_level,
          total_spent,
          status,
          created_at,
          updated_at,
          trips:trip_customers(
            trip:trips(
              id,
              trip_name,
              destination,
              start_date,
              end_date,
              status
            )
          ),
          transactions:transactions(
            id,
            amount,
            transaction_type,
            status,
            created_at
          )
        `)
            .eq('id', customerId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Customer not found' });
            }
            return res.status(500).json({
                error: 'Failed to fetch customer',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: customer
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
 * POST /customers
 * Only admin can create new customers
 */
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, vip_level, total_spent, status } = req.body;
        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'email']
            });
        }
        // Check if customer with same email already exists
        const { data: existingCustomer, error: checkError } = await supabase
            .from('customers')
            .select('id')
            .eq('email', email)
            .single();
        if (existingCustomer) {
            return res.status(409).json({
                error: 'Customer with this email already exists'
            });
        }
        const { data: customer, error } = await supabase
            .from('customers')
            .insert({
            name,
            email,
            phone: phone || null,
            vip_level: vip_level || 'standard',
            total_spent: total_spent || 0,
            status: status || 'active'
        })
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to create customer',
                details: error.message
            });
        }
        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: customer
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
 * PUT /customers/:id
 * Only admin can update customers
 */
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const customerId = req.params.id;
        const updateData = req.body;
        // Check if customer exists
        const { data: existingCustomer, error: checkError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .single();
        if (checkError || !existingCustomer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // If updating email, check for duplicates
        if (updateData.email) {
            const { data: duplicateCustomer, error: duplicateError } = await supabase
                .from('customers')
                .select('id')
                .eq('email', updateData.email)
                .neq('id', customerId)
                .single();
            if (duplicateCustomer) {
                return res.status(409).json({
                    error: 'Another customer with this email already exists'
                });
            }
        }
        const { data: customer, error } = await supabase
            .from('customers')
            .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
            .eq('id', customerId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                error: 'Failed to update customer',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Customer updated successfully',
            data: customer
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
 * DELETE /customers/:id
 * Only admin can delete customers
 */
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const customerId = req.params.id;
        // Check if customer exists
        const { data: existingCustomer, error: checkError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .single();
        if (checkError || !existingCustomer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Check if customer has related transactions
        const { data: relatedTransactions, error: transactionError } = await supabase
            .from('transactions')
            .select('id')
            .eq('customer_id', customerId)
            .limit(1);
        if (transactionError) {
            return res.status(500).json({
                error: 'Failed to check customer dependencies',
                details: transactionError.message
            });
        }
        if (relatedTransactions && relatedTransactions.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with existing transactions',
                message: 'Please delete related transactions first'
            });
        }
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', customerId);
        if (error) {
            return res.status(500).json({
                error: 'Failed to delete customer',
                details: error.message
            });
        }
        res.json({
            success: true,
            message: 'Customer deleted successfully'
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
 * GET /customers/:id/transactions
 * Get all transactions for a specific customer
 */
router.get('/:id/transactions', authMiddleware, async (req, res) => {
    try {
        const customerId = req.params.id;
        const userRole = req.user.role;
        let query = supabase
            .from('transactions')
            .select(`
          id,
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
            query = query.in('trip_id', supabase.from('trips').select('id').eq('staff_id', req.user.id));
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
 * GET /customers/vip/:level
 * Get customers by VIP level
 */
router.get('/vip/:level', authMiddleware, async (req, res) => {
    try {
        const vipLevel = req.params.level;
        const { data: customers, error } = await supabase
            .from('customers')
            .select(`
          id,
          name,
          email,
          phone,
          vip_level,
          total_spent,
          status,
          created_at
        `)
            .eq('vip_level', vipLevel)
            .order('total_spent', { ascending: false });
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch VIP customers',
                details: error.message
            });
        }
        res.json({
            success: true,
            data: customers,
            vipLevel,
            total: customers?.length || 0
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
//# sourceMappingURL=customers.js.map