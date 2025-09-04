import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, canAccessTrip } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to calculate trip win/loss statistics
async function calculateTripStats(tripId) {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, transaction_type')
      .eq('trip_id', tripId)
      .eq('status', 'completed');

    if (error) {
      console.error('Error calculating trip stats:', error);
      return { total_win: 0, total_loss: 0, net_profit: 0 };
    }

    let total_win = 0;
    let total_loss = 0;
    let total_buy_in = 0;
    let total_cash_out = 0;

    transactions?.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      switch (transaction.transaction_type) {
        case 'win':
          total_win += amount;
          break;
        case 'loss':
          total_loss += amount;
          break;
        case 'buy-in':
          total_buy_in += amount;
          break;
        case 'cash-out':
          total_cash_out += amount;
          break;
      }
    });

    // Calculate net profit: (cash-out + wins) - (buy-in + losses)
    const net_profit = (total_cash_out + total_win) - (total_buy_in + total_loss);

    return {
      total_win,
      total_loss,
      net_profit,
      total_buy_in,
      total_cash_out
    };
  } catch (error) {
    console.error('Error in calculateTripStats:', error);
    return { total_win: 0, total_loss: 0, net_profit: 0, total_buy_in: 0, total_cash_out: 0 };
  }
}

// Helper function to update trip statistics
async function updateTripStats(tripId) {
  const stats = await calculateTripStats(tripId);
  
  const { error } = await supabase
    .from('trips')
    .update({
      total_win: stats.total_win,
      total_loss: stats.total_loss,
      net_profit: stats.net_profit,
      updated_at: new Date().toISOString()
    })
    .eq('id', tripId);

  if (error) {
    console.error('Error updating trip stats:', error);
  }

  return stats;
}
// =====================================================
// TRIPS API ENDPOINTS
// =====================================================
/**
 * GET /trips/my-schedule
 * Staff can only see their assigned trips
 * Admin can see all trips
 */
router.get('/my-schedule', authenticateToken, async (req, res) => {
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
          total_win,
          total_loss,
          net_profit,
          created_at,
          updated_at,
          staff!staff_id(id, name, email),
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
router.get('/', authenticateToken, async (req, res) => {
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
          total_win,
          total_loss,
          net_profit,
          created_at,
          updated_at,
          staff!staff_id(id, name, email)
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
router.get('/:id', authenticateToken, canAccessTrip, async (req, res) => {
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
          total_win,
          total_loss,
          net_profit,
          created_at,
          updated_at,
          staff!staff_id(id, name, email, phone),
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
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
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
router.put('/:id', authenticateToken, canAccessTrip, async (req, res) => {
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
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
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
router.post('/:id/check-in', authenticateToken, canAccessTrip, async (req, res) => {
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
router.post('/:id/check-out', authenticateToken, canAccessTrip, async (req, res) => {
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
// =====================================================
// TRIP CUSTOMERS MANAGEMENT
// =====================================================

/**
 * POST /trips/:id/customers
 * Add customer to trip
 */
router.post('/:id/customers', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { customer_id } = req.body;
    
    if (!customer_id) {
      return res.status(400).json({
        error: 'Customer ID is required'
      });
    }

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    // Check if customer is already in this trip
    const { data: existing, error: existingError } = await supabase
      .from('trip_customers')
      .select('id')
      .eq('trip_id', tripId)
      .eq('customer_id', customer_id)
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'Customer is already added to this trip'
      });
    }

    // Add customer to trip
    const { data: tripCustomer, error } = await supabase
      .from('trip_customers')
      .insert({
        trip_id: tripId,
        customer_id: customer_id
      })
      .select(`
        id,
        customer:customers(id, name, email, vip_level, total_spent)
      `)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add customer to trip',
        details: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: `Customer ${customer.name} added to trip successfully`,
      data: tripCustomer
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /trips/:id/customers/:customerId
 * Remove customer from trip
 */
router.delete('/:id/customers/:customerId', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, customerId } = req.params;

    const { error } = await supabase
      .from('trip_customers')
      .delete()
      .eq('trip_id', tripId)
      .eq('customer_id', customerId);

    if (error) {
      return res.status(500).json({
        error: 'Failed to remove customer from trip',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Customer removed from trip successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// =====================================================
// TRIP AGENTS MANAGEMENT
// =====================================================

/**
 * POST /trips/:id/agents
 * Add agent to trip
 */
router.post('/:id/agents', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { agent_id } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({
        error: 'Agent ID is required'
      });
    }

    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found'
      });
    }

    // Check if agent is already in this trip
    const { data: existing, error: existingError } = await supabase
      .from('trip_agents')
      .select('id')
      .eq('trip_id', tripId)
      .eq('agent_id', agent_id)
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'Agent is already added to this trip'
      });
    }

    // Add agent to trip
    const { data: tripAgent, error } = await supabase
      .from('trip_agents')
      .insert({
        trip_id: tripId,
        agent_id: agent_id
      })
      .select(`
        id,
        agent:agents(id, name, email, commission_rate)
      `)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add agent to trip',
        details: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: `Agent ${agent.name} added to trip successfully`,
      data: tripAgent
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /trips/:id/agents/:agentId
 * Remove agent from trip
 */
router.delete('/:id/agents/:agentId', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, agentId } = req.params;

    const { error } = await supabase
      .from('trip_agents')
      .delete()
      .eq('trip_id', tripId)
      .eq('agent_id', agentId);

    if (error) {
      return res.status(500).json({
        error: 'Failed to remove agent from trip',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Agent removed from trip successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// =====================================================
// TRIP EXPENSES MANAGEMENT
// =====================================================

/**
 * POST /trips/:id/expenses
 * Add expense to trip
 */
router.post('/:id/expenses', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { expense_type, amount, description, expense_date } = req.body;
    
    if (!expense_type || !amount) {
      return res.status(400).json({
        error: 'Expense type and amount are required'
      });
    }

    const { data: expense, error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id: tripId,
        expense_type,
        amount,
        description,
        expense_date: expense_date || new Date().toISOString().split('T')[0],
        recorded_by: req.user.id
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add expense',
        details: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: expense
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /trips/:id/expenses/:expenseId
 * Update trip expense
 */
router.put('/:id/expenses/:expenseId', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, expenseId } = req.params;
    const { expense_type, amount, description, expense_date } = req.body;

    const updateData = {};
    if (expense_type !== undefined) updateData.expense_type = expense_type;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (expense_date !== undefined) updateData.expense_date = expense_date;

    const { data: expense, error } = await supabase
      .from('trip_expenses')
      .update(updateData)
      .eq('id', expenseId)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update expense',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /trips/:id/expenses/:expenseId
 * Delete trip expense
 */
router.delete('/:id/expenses/:expenseId', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, expenseId } = req.params;

    const { error } = await supabase
      .from('trip_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('trip_id', tripId);

    if (error) {
      return res.status(500).json({
        error: 'Failed to delete expense',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// =====================================================
// TRIP TRANSACTIONS MANAGEMENT
// =====================================================

/**
 * GET /trips/:id/transactions
 * Get all transactions for a trip
 */
router.get('/:id/transactions', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        transaction_type,
        status,
        created_at,
        customer:customers(id, name, email),
        agent:agents(id, name, email)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch transactions',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: transactions,
      total: transactions?.length || 0
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /trips/:id/transactions
 * Add transaction to trip
 */
router.post('/:id/transactions', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { customer_id, agent_id, amount, transaction_type, notes } = req.body;
    
    if (!amount || !transaction_type) {
      return res.status(400).json({
        error: 'Amount and transaction type are required'
      });
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        trip_id: tripId,
        customer_id,
        agent_id,
        amount,
        transaction_type,
        notes,
        status: 'completed',
        recorded_by_staff_id: req.user.staff?.id
      })
      .select(`
        id,
        amount,
        transaction_type,
        status,
        created_at,
        customer:customers(id, name, email),
        agent:agents(id, name, email)
      `)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add transaction',
        details: error.message
      });
    }

    // Update trip statistics after adding transaction
    const updatedStats = await updateTripStats(tripId);

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: {
        ...transaction,
        trip_stats: updatedStats
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// =====================================================
// TRIP STATISTICS MANAGEMENT
// =====================================================

/**
 * GET /trips/:id/statistics
 * Get detailed win/loss statistics for a trip
 */
router.get('/:id/statistics', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    // Get current trip data
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, trip_name, total_win, total_loss, net_profit, total_budget')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return res.status(404).json({
        error: 'Trip not found'
      });
    }

    // Calculate real-time statistics
    const stats = await calculateTripStats(tripId);

    // Get transaction breakdown
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select(`
        transaction_type,
        amount,
        status,
        created_at,
        customer:customers(name),
        agent:agents(name)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (transError) {
      return res.status(500).json({
        error: 'Failed to fetch transaction details',
        details: transError.message
      });
    }

    // Group transactions by type
    const transactionSummary = {
      'buy-in': { count: 0, total: 0 },
      'cash-out': { count: 0, total: 0 },
      'win': { count: 0, total: 0 },
      'loss': { count: 0, total: 0 },
      'rolling': { count: 0, total: 0 },
      'commission': { count: 0, total: 0 }
    };

    transactions?.forEach(transaction => {
      const type = transaction.transaction_type;
      const amount = parseFloat(transaction.amount) || 0;
      
      if (transactionSummary[type]) {
        transactionSummary[type].count++;
        transactionSummary[type].total += amount;
      }
    });

    res.json({
      success: true,
      data: {
        trip: {
          id: trip.id,
          name: trip.trip_name,
          budget: trip.total_budget
        },
        statistics: {
          total_win: stats.total_win,
          total_loss: stats.total_loss,
          net_profit: stats.net_profit,
          total_buy_in: stats.total_buy_in,
          total_cash_out: stats.total_cash_out,
          profit_margin: stats.total_buy_in > 0 ? ((stats.net_profit / stats.total_buy_in) * 100).toFixed(2) : 0
        },
        transaction_summary: transactionSummary,
        recent_transactions: transactions?.slice(0, 10) || []
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
 * PUT /trips/:id/statistics/refresh
 * Recalculate and update trip statistics
 */
router.put('/:id/statistics/refresh', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    // Recalculate statistics
    const stats = await updateTripStats(tripId);

    res.json({
      success: true,
      message: 'Trip statistics refreshed successfully',
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

export default router;
//# sourceMappingURL=trips.js.map