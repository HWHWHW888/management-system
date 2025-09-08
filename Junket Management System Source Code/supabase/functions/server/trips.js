import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, canAccessTrip } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to calculate individual customer stats for a trip
async function calculateCustomerTripStats(tripId, customerId) {
  try {
    // Get transactions data
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, transaction_type')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .eq('status', 'completed');

    if (error) {
      console.error('Error calculating customer trip stats:', error);
      return { total_win: 0, total_loss: 0, total_buy_in: 0, total_cash_out: 0, net_result: 0, rolling_amount: 0 };
    }

    // Get rolling records data - using actual table structure
    const { data: rollingRecords, error: rollingError } = await supabase
      .from('rolling_records')
      .select('rolling_amount')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .eq('verified', true); // Only include verified records

    if (rollingError) {
      console.error('Error fetching rolling records:', rollingError);
      // If rolling_records table doesn't exist, continue without it
    }

    let total_win = 0;
    let total_loss = 0;
    let total_buy_in = 0;
    let total_cash_out = 0;
    let rolling_amount = 0;

    // Process transactions
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

    // Process rolling records - only rolling amounts (win/loss handled by trip_customer_stats)
    rollingRecords?.forEach(record => {
      const rollingAmt = parseFloat(record.rolling_amount) || 0;
      // Add to rolling amount
      rolling_amount += rollingAmt;
    });

    // If no rolling records found, try to get rolling amount from trip_customer_stats
    if (!rollingRecords || rollingRecords.length === 0) {
      const { data: customerStats } = await supabase
        .from('trip_customer_stats')
        .select('rolling_amount, net_result, total_buy_in, total_cash_out, total_win, total_loss')
        .eq('trip_id', tripId)
        .eq('customer_id', customerId)
        .single();

      if (customerStats) {
        rolling_amount = parseFloat(customerStats.rolling_amount) || 0;
        // Use stats from trip_customer_stats if available
        total_buy_in = parseFloat(customerStats.total_buy_in) || total_buy_in;
        total_cash_out = parseFloat(customerStats.total_cash_out) || total_cash_out;
        total_win = parseFloat(customerStats.total_win) || total_win;
        total_loss = parseFloat(customerStats.total_loss) || total_loss;
      }
    }

    // Calculate net result: (cash-out + wins) - (buy-in + losses)
    const net_result = (total_cash_out + total_win) - (total_buy_in + total_loss);

    return {
      total_win,
      total_loss,
      total_buy_in,
      total_cash_out,
      net_result,
      rolling_amount
    };
  } catch (error) {
    console.error('Error in calculateCustomerTripStats:', error);
    return { total_win: 0, total_loss: 0, total_buy_in: 0, total_cash_out: 0, net_result: 0, rolling_amount: 0 };
  }
}

// Helper function to update customer stats in trip_customer_stats table
async function updateCustomerTripStats(tripId, customerId) {
  const stats = await calculateCustomerTripStats(tripId, customerId);
  
  const { error } = await supabase
    .from('trip_customer_stats')
    .upsert({
      trip_id: tripId,
      customer_id: customerId,
      total_buy_in: stats.total_buy_in,
      total_cash_out: stats.total_cash_out,
      total_win: stats.total_win,
      total_loss: stats.total_loss,
      net_result: stats.net_result,
      rolling_amount: stats.rolling_amount,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'trip_id,customer_id'
    });

  if (error) {
    console.error('Error updating customer trip stats:', error);
  }

  // Update customer's total win/loss in customers table
  await updateCustomerTotalWinLoss(customerId);

  return stats;
}

// Helper function to update customer's total win/loss across all trips
async function updateCustomerTotalWinLoss(customerId) {
  try {
    // Calculate total win/loss from all trip customer stats
    const { data: allStats, error } = await supabase
      .from('trip_customer_stats')
      .select('total_win, total_loss, net_result')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching customer trip stats:', error);
      return;
    }

    let totalWinLoss = 0;
    allStats?.forEach(stat => {
      totalWinLoss += parseFloat(stat.net_result) || 0;
    });

    // Update customer table
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_win_loss: totalWinLoss,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer total win/loss:', updateError);
    }

  } catch (error) {
    console.error('Error in updateCustomerTotalWinLoss:', error);
  }
}

// Helper function to calculate trip win/loss statistics from customer stats
async function calculateTripStats(tripId) {
  try {
    // Get all customer stats for this trip
    const { data: customerStats, error } = await supabase
      .from('trip_customer_stats')
      .select('total_buy_in, total_cash_out, total_win, total_loss, net_result')
      .eq('trip_id', tripId);

    if (error) {
      console.error('Error calculating trip stats:', error);
      return { total_win: 0, total_loss: 0, net_profit: 0 };
    }

    let total_win = 0;
    let total_loss = 0;
    let total_buy_in = 0;
    let total_cash_out = 0;

    customerStats?.forEach(stats => {
      total_win += parseFloat(stats.total_win) || 0;
      total_loss += parseFloat(stats.total_loss) || 0;
      total_buy_in += parseFloat(stats.total_buy_in) || 0;
      total_cash_out += parseFloat(stats.total_cash_out) || 0;
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
  // First, update all customer stats for this trip
  const { data: tripCustomers } = await supabase
    .from('trip_customers')
    .select('customer_id')
    .eq('trip_id', tripId);

  if (tripCustomers) {
    for (const tc of tripCustomers) {
      await updateCustomerTripStats(tripId, tc.customer_id);
    }
  }

  // Then calculate and update trip totals
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

  // Update trip sharing calculations
  await updateTripSharing(tripId, stats);

  return stats;
}

// Helper function to update trip sharing calculations
async function updateTripSharing(tripId, tripStats) {
  try {
    // Get trip expenses
    const { data: expenses, error: expenseError } = await supabase
      .from('trip_expenses')
      .select('amount')
      .eq('trip_id', tripId);

    if (expenseError) {
      console.error('Error fetching trip expenses:', expenseError);
      return;
    }

    const totalExpenses = expenses?.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0) || 0;

    // Get rolling commission data from trip customer stats
    const { data: customerStats, error: statsError } = await supabase
      .from('trip_customer_stats')
      .select('customer_id, rolling_amount, commission_earned, net_result')
      .eq('trip_id', tripId);

    if (statsError) {
      console.error('Error fetching customer stats for sharing:', statsError);
      return;
    }

    // Check if there are any customers - if not, set sharing values to 0 but preserve expenses
    const hasCustomers = customerStats && customerStats.length > 0;
    
    // Calculate Rolling Commission based on customer rolling amounts at 1.4%
    const totalRolling = hasCustomers ? 
      customerStats.reduce((sum, stat) => sum + (parseFloat(stat.rolling_amount) || 0), 0) : 0;
    const rollingCommissionRate = 1.4; // 1.4% rolling commission rate
    const totalRollingCommission = totalRolling * rollingCommissionRate / 100;
    
    console.log('🎲 Rolling Commission Debug:');
    console.log('- hasCustomers:', hasCustomers);
    console.log('- customerStats:', JSON.stringify(customerStats, null, 2));
    console.log('- totalRolling:', totalRolling);
    console.log('- rollingCommissionRate:', rollingCommissionRate);
    console.log('- totalRollingCommission:', totalRollingCommission);
    
    if (customerStats) {
      customerStats.forEach((stat, index) => {
        console.log(`- Customer ${index + 1} rolling_amount:`, stat.rolling_amount, typeof stat.rolling_amount);
      });
    }

    // Calculate net cash flow and result from company perspective
    let netCashFlow, netResult;
    
    if (hasCustomers) {
      netCashFlow = (tripStats.total_cash_out || 0) - (tripStats.total_buy_in || 0);
      // Net result from company perspective: house win - agent commission - rolling commission - expenses
      const houseWinLoss = -(tripStats.net_profit || 0); // Convert customer loss to house win
      netResult = houseWinLoss - totalRollingCommission - totalExpenses;
    } else {
      // No customers: cash flow is 0, result is negative expenses only
      netCashFlow = 0;
      netResult = -totalExpenses; // Only expenses affect the result
    }

    // Get actual agent commission rates from trip_agent_customers table
    const { data: agentCustomers, error: agentError } = await supabase
      .from('trip_agent_customers')
      .select('agent_id, customer_id, commission_rate')
      .eq('trip_id', tripId);

    if (agentError) {
      console.error('Error fetching agent customers for sharing:', agentError);
    }

    console.log('🤝 Agent-Customer relationships:', agentCustomers);

    // Calculate agent breakdown based on actual commission rates and customer performance
    const agentBreakdownMap = {};
    
    // If trip_agent_customers table doesn't exist or has no data, use fallback logic
    if (!agentCustomers || agentCustomers.length === 0) {
      console.log('⚠️ No trip_agent_customers data found, using fallback logic');
      
      // Get customers and their associated agents
      if (customerStats && customerStats.length > 0) {
        for (const customerStat of customerStats) {
          // Get customer's agent from customers table
          const { data: customer } = await supabase
            .from('customers')
            .select('agent_id')
            .eq('id', customerStat.customer_id)
            .single();
            
          if (customer && customer.agent_id) {
            // Get agent's default commission rate
            const { data: agent } = await supabase
              .from('agents')
              .select('commission_rate')
              .eq('id', customer.agent_id)
              .single();
              
            if (agent) {
              const customerNet = parseFloat(customerStat.net_result) || 0;
              const winLossAmount = Math.abs(customerNet);
              let agentCommission = 0;
              
              if (customerNet < 0) {
                // Customer lost, agent gets commission
                agentCommission = (winLossAmount * parseFloat(agent.commission_rate) / 100);
              } else if (customerNet > 0) {
                // Customer won, agent bears loss
                agentCommission = -(winLossAmount * parseFloat(agent.commission_rate) / 100);
              }
              
              if (!agentBreakdownMap[customer.agent_id]) {
                agentBreakdownMap[customer.agent_id] = {
                  agent_id: customer.agent_id,
                  commission_rate: parseFloat(agent.commission_rate),
                  share_amount: 0
                };
              }
              agentBreakdownMap[customer.agent_id].share_amount += agentCommission;
            }
          }
        }
      }
    } else {
      // Use trip_agent_customers data
      console.log('📊 Customer stats for matching:', customerStats?.map(cs => ({ 
        customer_id: cs.customer_id, 
        net_result: cs.net_result 
      })));
      
      agentCustomers.forEach(ac => {
        console.log(`🔍 Looking for customer ${ac.customer_id} in stats...`);
        const customerStat = customerStats.find(cs => cs.customer_id === ac.customer_id);
        console.log(`📋 Found customer stat:`, customerStat);
        
        if (customerStat) {
          const customerNet = parseFloat(customerStat.net_result) || 0;
          const winLossAmount = Math.abs(customerNet);
          let agentCommission = 0;
          
          console.log(`💰 Customer ${ac.customer_id}: net=${customerNet}, winLoss=${winLossAmount}, rate=${ac.commission_rate}%`);
          
          if (customerNet < 0) {
            // Customer lost, agent gets commission
            agentCommission = (winLossAmount * parseFloat(ac.commission_rate) / 100);
            console.log(`📈 Customer lost, agent gets commission: ${agentCommission}`);
          } else if (customerNet > 0) {
            // Customer won, agent bears loss
            agentCommission = -(winLossAmount * parseFloat(ac.commission_rate) / 100);
            console.log(`📉 Customer won, agent bears loss: ${agentCommission}`);
          } else {
            console.log(`⚖️ Customer broke even, no commission`);
          }
          
          if (!agentBreakdownMap[ac.agent_id]) {
            agentBreakdownMap[ac.agent_id] = {
              agent_id: ac.agent_id,
              commission_rate: parseFloat(ac.commission_rate),
              share_amount: 0
            };
          }
          agentBreakdownMap[ac.agent_id].share_amount += agentCommission;
          console.log(`🏦 Agent ${ac.agent_id} total commission: ${agentBreakdownMap[ac.agent_id].share_amount}`);
        } else {
          console.log(`❌ No customer stat found for customer ${ac.customer_id}`);
        }
      });
    }

    const agentBreakdown = Object.values(agentBreakdownMap);
    const totalAgentCommission = agentBreakdown.reduce((sum, agent) => sum + agent.share_amount, 0);
    
    // Calculate from company perspective: house_winloss - agent_commission + rolling_commission - expenses
    const houseWinLoss = -(tripStats.net_profit || 0); // Convert customer loss to house win (company perspective)
    const companyShare = houseWinLoss - totalAgentCommission + totalRollingCommission - totalExpenses;
    
    // Calculate total amount for percentage calculation
    const totalAmount = Math.abs(totalAgentCommission) + Math.abs(companyShare);
    
    // Calculate percentages using |amount|/|total|, direction indicated by total amount sign
    let agentSharePercentage = 0;
    let companySharePercentage = 0;
    
    if (totalAmount > 0) {
      agentSharePercentage = Math.round((Math.abs(totalAgentCommission) / totalAmount) * 10000) / 100;
      companySharePercentage = Math.round((Math.abs(companyShare) / totalAmount) * 10000) / 100;
    }
    
    console.log('💰 Company Perspective Calculation:');
    console.log('- Customer net_profit (customer perspective):', tripStats.net_profit || 0);
    console.log('- House win/loss (company perspective):', houseWinLoss);
    console.log('- Agent commission:', totalAgentCommission);
    console.log('- Rolling commission:', totalRollingCommission);
    console.log('- Total expenses:', totalExpenses);
    console.log('- Net result = house_winloss - rolling_commission - expenses');
    console.log(`- Net result = ${houseWinLoss} - ${totalRollingCommission} - ${totalExpenses} = ${netResult}`);
    console.log('- Company share = house_winloss - agent_commission + rolling_commission - expenses');
    console.log(`- Company share = ${houseWinLoss} - ${totalAgentCommission} + ${totalRollingCommission} - ${totalExpenses} = ${companyShare}`);
    console.log('- Total amount for percentage:', totalAmount);
    console.log('- Agent percentage:', agentSharePercentage + '%');
    console.log('- Company percentage:', companySharePercentage + '%');


    // Update trip_sharing table - always maintain record but adjust values based on customer presence
    const sharingData = {
      trip_id: tripId,
      total_win_loss: hasCustomers ? (tripStats.net_profit || 0) : 0,
      total_expenses: totalExpenses, // Always preserve expenses
      total_rolling_commission: totalRollingCommission,
      total_buy_in: hasCustomers ? (tripStats.total_buy_in || 0) : 0,
      total_buy_out: hasCustomers ? (tripStats.total_cash_out || 0) : 0,
      net_cash_flow: hasCustomers ? netCashFlow : 0,
      net_result: netResult,
      total_agent_share: totalAgentCommission,
      company_share: companyShare,
      agent_share_percentage: agentSharePercentage,
      company_share_percentage: companySharePercentage,
      agent_breakdown: agentBreakdown
    };
    
    console.log('Updating trip sharing with data:', sharingData);
    
    const { data: sharingResult, error: sharingError } = await supabase
      .from('trip_sharing')
      .upsert(sharingData)
      .select();

    if (sharingError) {
      console.error('Error updating trip sharing:', sharingError);
    } else {
      console.log('Trip sharing updated successfully:', sharingResult);
      
      // Update agent statistics in agents table
      await updateAgentStatistics(tripId, agentBreakdown);
    }
    
  } catch (error) {
    console.error('Error updating trip sharing:', error);
  }
}

// Helper function to update agent statistics
async function updateAgentStatistics(tripId, agentBreakdown) {
  try {
    console.log('📊 Updating agent statistics for trip:', tripId);
        
    for (const agent of agentBreakdown) {
      const { agent_id, share_amount } = agent;
          
      // Get current agent statistics
      const { data: currentAgent, error: fetchError } = await supabase
        .from('agents')
        .select('total_commission, total_trips')
        .eq('id', agent_id)
        .single();
            
      if (fetchError) {
        console.error(`Error fetching agent ${agent_id} stats:`, fetchError);
        continue;
      }
            
      // Check if this agent already has commission recorded for this trip
      const { data: existingRecord, error: checkError } = await supabase
        .from('trip_sharing')
        .select('agent_breakdown')
        .eq('trip_id', tripId)
        .single();
            
      if (checkError) {
        console.error('Error checking existing trip sharing:', checkError);
        continue;
      }
            
      // Calculate new totals
      const currentCommission = parseFloat(currentAgent?.total_commission || 0);
      const currentTrips = parseInt(currentAgent?.total_trips || 0);
      const newCommission = share_amount || 0;
            
      // Update agent statistics
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          total_commission: currentCommission + newCommission,
          total_trips: currentTrips + 1
        })
        .eq('id', agent_id);
            
      if (updateError) {
        console.error(`Error updating agent ${agent_id} statistics:`, updateError);
      } else {
        console.log(`✅ Updated agent ${agent_id}: +${newCommission} commission, +1 trip`);
        console.log(`   Total: ${currentCommission + newCommission} commission, ${currentTrips + 1} trips`);
      }
    }
  } catch (error) {
    console.error('Error in updateAgentStatistics:', error);
  }
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
            .select('*')
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

        // Update agent statistics when trip is completed
        console.log('🎯 Trip completed, updating agent statistics...');
        await updateTripSharing(tripId);
        
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

    // Skip customer verification, let the stored procedure handle it

    // First check if customer exists and get their agent info
    const { data: customerCheck, error: customerError } = await supabase
      .from('customers')
      .select('id, name, agent_id')
      .eq('id', customer_id)
      .single();

    if (customerError || !customerCheck) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    // Check if customer is already in trip using raw SQL
    const { data: existingRelation, error: relationError } = await supabase
      .from('trip_customers')
      .select('id')
      .eq('trip_id', tripId)
      .eq('customer_id', customer_id)
      .single();

    if (existingRelation) {
      return res.status(400).json({
        error: 'Customer already in trip'
      });
    }

    // Insert into trip_customers using raw SQL
    const { data: tripCustomerInsert, error: insertError } = await supabase
      .from('trip_customers')
      .insert({
        trip_id: tripId,
        customer_id: customer_id
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        error: 'Failed to add customer to trip',
        details: insertError.message
      });
    }

    // Insert into trip_customer_stats using raw SQL
    const { data: statsInsert, error: statsError } = await supabase
      .from('trip_customer_stats')
      .insert({
        trip_id: tripId,
        customer_id: customer_id,
        total_buy_in: 0,
        total_cash_out: 0,
        total_win: 0,
        total_loss: 0,
        net_result: 0,
        rolling_amount: 0,
        commission_earned: 0
      });

    if (statsError) {
      // If stats insert fails, we should rollback the trip_customers insert
      await supabase
        .from('trip_customers')
        .delete()
        .eq('trip_id', tripId)
        .eq('customer_id', customer_id);
      
      return res.status(500).json({
        error: 'Failed to initialize customer stats',
        details: statsError.message
      });
    }

    // Auto-add customer's agent to trip if they have one
    if (customerCheck.agent_id) {
      try {
        // Check if agent is already in trip
        const { data: existingAgent } = await supabase
          .from('trip_agents')
          .select('id')
          .eq('trip_id', tripId)
          .eq('agent_id', customerCheck.agent_id)
          .single();

        // Add agent to trip if not already present
        if (!existingAgent) {
          await supabase
            .from('trip_agents')
            .insert({
              trip_id: tripId,
              agent_id: customerCheck.agent_id
            });
        }

        // Get agent's default commission rate
        const { data: agentData } = await supabase
          .from('agents')
          .select('commission_rate')
          .eq('id', customerCheck.agent_id)
          .single();

        // Create agent-customer relationship with commission rate
        await supabase
          .from('trip_agent_customers')
          .insert({
            trip_id: tripId,
            agent_id: customerCheck.agent_id,
            customer_id: customer_id,
            commission_rate: agentData?.commission_rate || 0
          });

      } catch (agentError) {
        console.error('Error adding agent to trip:', agentError);
        // Don't fail the customer addition if agent addition fails
      }
    }

    res.status(201).json({
      success: true,
      message: `Customer ${customerCheck.name} added to trip successfully`,
      data: {
        trip_id: tripId,
        customer_id: customer_id,
        customer_name: customerCheck.name
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
 * PUT /trips/:id/agents/:agentId/commission
 * Update agent commission rate for specific customer in trip
 */
router.put('/:id/agents/:agentId/commission', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, agentId } = req.params;
    const { customer_id, commission_rate } = req.body;

    if (!customer_id || commission_rate === undefined) {
      return res.status(400).json({
        error: 'Customer ID and commission rate are required'
      });
    }

    // Update commission rate in trip_agent_customers table
    const { data, error } = await supabase
      .from('trip_agent_customers')
      .update({
        commission_rate: commission_rate,
        updated_at: new Date().toISOString()
      })
      .eq('trip_id', tripId)
      .eq('agent_id', agentId)
      .eq('customer_id', customer_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update commission rate',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Commission rate updated successfully',
      data
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /trips/:id/agents/profits
 * Get agent individual profits from their customers in this trip
 */
router.get('/:id/agents/profits', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId } = req.params;

    // First, ensure all trip customers have agent-customer relationships
    console.log('🔍 Checking trip customers for agent relationships...');
    const { data: tripCustomers, error: tripCustomersError } = await supabase
      .from('trip_customers')
      .select(`
        customer_id,
        customers!inner(id, name, agent_id)
      `)
      .eq('trip_id', tripId);

    console.log('🔍 Trip customers data:', tripCustomers);
    console.log('🔍 Trip customers error:', tripCustomersError);

    // Create missing agent-customer relationships
    if (tripCustomers) {
      console.log(`🔍 Processing ${tripCustomers.length} trip customers...`);
      for (const tripCustomer of tripCustomers) {
        const customer = tripCustomer.customers;
        console.log('🔍 Processing customer:', customer);
        
        if (customer.agent_id) {
          console.log(`🔍 Customer ${customer.id} has agent_id: ${customer.agent_id}`);
          
          // Check if relationship exists
          const { data: existingRelation, error: relationError } = await supabase
            .from('trip_agent_customers')
            .select('id')
            .eq('trip_id', tripId)
            .eq('agent_id', customer.agent_id)
            .eq('customer_id', customer.id)
            .single();

          console.log('🔍 Existing relation:', existingRelation);
          console.log('🔍 Relation error:', relationError);

          if (!existingRelation) {
            console.log(`🔍 Creating new agent-customer relationship...`);
            
            // Get agent's default commission rate
            const { data: agentData, error: agentError } = await supabase
              .from('agents')
              .select('commission_rate')
              .eq('id', customer.agent_id)
              .single();

            console.log('🔍 Agent data:', agentData);
            console.log('🔍 Agent error:', agentError);

            // Create the relationship
            const { data: insertResult, error: insertError } = await supabase
              .from('trip_agent_customers')
              .insert({
                trip_id: tripId,
                agent_id: customer.agent_id,
                customer_id: customer.id,
                commission_rate: agentData?.commission_rate || 0
              });

            console.log('🔍 Insert result:', insertResult);
            console.log('🔍 Insert error:', insertError);

            if (insertError) {
              console.error('❌ Failed to create agent-customer relationship:', insertError);
            } else {
              console.log(`✅ Created missing agent-customer relationship: agent ${customer.agent_id} -> customer ${customer.id}`);
            }
          } else {
            console.log(`✅ Agent-customer relationship already exists`);
          }
        } else {
          console.log(`⚠️ Customer ${customer.id} has no agent_id`);
        }
      }
    } else {
      console.log('❌ No trip customers found or error occurred');
    }

    // Get all agent-customer relationships with commission rates
    console.log('🔍 Querying agent profits data...');
    const { data: agentCustomers, error: agentCustomersError } = await supabase
      .from('trip_agent_customers')
      .select(`
        agent_id,
        customer_id,
        commission_rate
      `)
      .eq('trip_id', tripId);

    console.log('🔍 Agent customers query result:', { data: agentCustomers, error: agentCustomersError });

    if (agentCustomersError) {
      console.error('❌ Error fetching agent customers:', agentCustomersError);
      return res.status(500).json({
        error: 'Failed to fetch agent customers',
        details: agentCustomersError.message
      });
    }

    if (!agentCustomers || agentCustomers.length === 0) {
      console.log('ℹ️ No agent-customer relationships found');
      return res.json({
        success: true,
        data: []
      });
    }

    // Get agent details
    const agentIds = [...new Set(agentCustomers.map(ac => ac.agent_id))];
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, email')
      .in('id', agentIds);

    console.log('🔍 Agents query result:', { data: agents, error: agentsError });

    // Get customer details
    const customerIds = [...new Set(agentCustomers.map(ac => ac.customer_id))];
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds);

    console.log('🔍 Customers query result:', { data: customers, error: customersError });

    // Get customer stats
    const { data: customerStats, error: statsError } = await supabase
      .from('trip_customer_stats')
      .select(`
        customer_id,
        total_buy_in,
        total_cash_out,
        total_win,
        total_loss,
        net_result,
        rolling_amount,
        commission_earned
      `)
      .eq('trip_id', tripId)
      .in('customer_id', customerIds);

    console.log('🔍 Customer stats query result:', { data: customerStats, error: statsError });

    // Create maps for easy lookup
    const agentMap = {};
    if (agents) {
      agents.forEach(agent => {
        agentMap[agent.id] = agent;
      });
    }

    const customerMap = {};
    if (customers) {
      customers.forEach(customer => {
        customerMap[customer.id] = customer;
      });
    }

    const statsMap = {};
    if (customerStats) {
      customerStats.forEach(stat => {
        statsMap[stat.customer_id] = stat;
      });
    }

    // Group by agent and calculate individual profits
    const agentProfitMap = {};
    
    agentCustomers.forEach(item => {
      const agentId = item.agent_id;
      const customerId = item.customer_id;
      const commissionRate = item.commission_rate || 0;
      
      const agent = agentMap[agentId];
      const customer = customerMap[customerId];
      const customerStats = statsMap[customerId] || {
        total_buy_in: 0,
        total_cash_out: 0,
        total_win: 0,
        total_loss: 0,
        net_result: 0,
        rolling_amount: 0,
        commission_earned: 0
      };
      
      if (!agentProfitMap[agentId]) {
        agentProfitMap[agentId] = {
          agent_id: agentId,
          agent_name: agent ? agent.name : 'Unknown Agent',
          agent_email: agent ? agent.email : '',
          customers: [],
          total_agent_commission: 0,
          total_rolling_commission: 0,
          total_customer_net: 0
        };
      }

      // Calculate Agent Commission based on customer's win/loss
      const customerNet = customerStats.net_result || 0;
      const rollingAmount = customerStats.rolling_amount || 0;
      const buyIn = customerStats.total_buy_in || 0;
      const cashOut = customerStats.total_cash_out || 0;
      
      // Agent Commission: Based on customer win/loss
      const winLossAmount = Math.abs(customerNet);
      let agentCommission = 0;
      
      if (customerNet < 0) {
        // Customer lost money (buyin > cashout), junket wins, agent gets commission
        agentCommission = (winLossAmount * commissionRate / 100);
      } else if (customerNet > 0) {
        // Customer won money (cashout > buyin), junket loses, agent bears loss
        agentCommission = -(winLossAmount * commissionRate / 100);
      }
      
      // Rolling Commission: Junket revenue based on customer rolling amount (default 1.4%)
      const rollingCommissionRate = 1.4; // Default 1.4%, can be made configurable later
      const rollingCommission = (rollingAmount * rollingCommissionRate / 100);
      
      console.log(`💰 Commission calculation for ${customer ? customer.name : customerId}:`, {
        commissionRate,
        buyIn,
        cashOut,
        customerNet,
        rollingAmount,
        winLossAmount,
        agentCommission,
        rollingCommission,
        rollingCommissionRate,
        scenario: customerNet < 0 ? 'Customer lost - Agent gets commission' : 
                 customerNet > 0 ? 'Customer won - Agent bears loss' : 'Break even'
      });

      agentProfitMap[agentId].customers.push({
        customer_id: customerId,
        customer_name: customer ? customer.name : 'Unknown Customer',
        commission_rate: commissionRate,
        net_result: customerNet,
        rolling_amount: rollingAmount,
        agent_commission: agentCommission,
        rolling_commission: rollingCommission,
        buy_in: customerStats.total_buy_in || 0,
        cash_out: customerStats.total_cash_out || 0
      });

      agentProfitMap[agentId].total_agent_commission += agentCommission;
      agentProfitMap[agentId].total_rolling_commission += rollingCommission;
      agentProfitMap[agentId].total_customer_net += customerNet;
    });

    const finalResponse = Object.values(agentProfitMap);
    console.log('📤 Final agent profits response:', JSON.stringify(finalResponse, null, 2));
    
    res.json({
      success: true,
      data: finalResponse
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

    console.log('DELETE /trips/:id/customers/:customerId - Request data:', {
      tripId,
      customerId
    });

    // First check if the customer exists in the trip
    const { data: existing, error: checkError } = await supabase
      .from('trip_customers')
      .select('id')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing customer:', checkError);
      return res.status(500).json({
        error: 'Failed to check existing customer',
        details: checkError.message
      });
    }

    if (!existing) {
      console.log('Customer not found in trip');
      return res.status(404).json({
        error: 'Customer not found in this trip'
      });
    }

    console.log('Found customer in trip, proceeding with deletion:', existing);

    // Delete from trip_customers table
    const { error: tripCustomerError } = await supabase
      .from('trip_customers')
      .delete()
      .eq('trip_id', tripId)
      .eq('customer_id', customerId);

    if (tripCustomerError) {
      console.error('Error deleting customer from trip_customers:', tripCustomerError);
      return res.status(500).json({
        error: 'Failed to remove customer from trip',
        details: tripCustomerError.message
      });
    }

    console.log('Customer removed from trip_customers table');

    // Also delete from trip_customer_stats table
    const { error: statsError } = await supabase
      .from('trip_customer_stats')
      .delete()
      .eq('trip_id', tripId)
      .eq('customer_id', customerId);

    if (statsError) {
      console.error('Error deleting customer stats:', statsError);
      return res.status(500).json({
        error: 'Failed to remove customer stats',
        details: statsError.message
      });
    }

    console.log('Customer stats removed from trip_customer_stats table');
    console.log('Customer successfully removed from trip completely');

    // Update trip statistics after customer removal
    const updatedStats = await updateTripStats(tripId);
    
    // Update trip sharing calculations with new stats
    await updateTripSharing(tripId, updatedStats);
    
    console.log('Trip statistics and sharing updated after customer removal');

    res.json({
      success: true,
      message: 'Customer removed from trip successfully'
    });

  } catch (error) {
    console.error('Internal server error:', error);
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
    
    console.log('POST /trips/:id/agents - Request data:', {
      tripId,
      body: req.body,
      agent_id
    });
    
    if (!agent_id) {
      console.log('Missing agent_id in request body');
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
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing agent:', existingError);
      return res.status(500).json({
        error: 'Failed to check existing agent',
        details: existingError.message
      });
    }

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
        agent_id: agent_id,
        created_at: new Date().toISOString()
      })
      .select(`
        id,
        agent_id,
        created_at
      `)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add agent to trip',
        details: error.message
      });
    }

    // Get the full agent data for response
    const { data: fullAgent, error: agentFetchError } = await supabase
      .from('agents')
      .select('id, name, email, commission_rate')
      .eq('id', agent_id)
      .single();

    if (agentFetchError) {
      console.error('Error fetching agent details:', agentFetchError);
    }

    // Update trip stats after agent addition
    await updateTripStats(tripId);

    res.status(201).json({
      success: true,
      message: `Agent ${agent.name} added to trip successfully`,
      data: {
        ...tripAgent,
        agent: fullAgent
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
 * GET /trips/:id/agents
 * Get all agents for a trip
 */
router.get('/:id/agents', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    const { data: tripAgents, error } = await supabase
      .from('trip_agents')
      .select(`
        id,
        agent_id,
        created_at,
        agent:agents(id, name, email, commission_rate)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch trip agents',
        details: error.message
      });
    }

    // Transform the data to match frontend expectations
    const agents = tripAgents.map(ta => ({
      id: ta.id,
      agentId: ta.agent_id,
      agent_id: ta.agent_id,
      agentName: ta.agent?.name,
      agent: ta.agent,
      created_at: ta.created_at
    }));

    res.json({
      success: true,
      data: agents
    });

  } catch (error) {
    console.error('Error fetching trip agents:', error);
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

    // Update trip stats after agent removal
    await updateTripStats(tripId);

    res.json({
      success: true,
      message: 'Agent removed from trip successfully'
    });

  } catch (error) {
    console.error('Error removing agent from trip:', error);
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
 * GET /trips/:id/expenses
 * Get all expenses for a trip
 */
router.get('/:id/expenses', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    const { data: expenses, error } = await supabase
      .from('trip_expenses')
      .select(`
        id,
        expense_type,
        amount,
        description,
        expense_date,
        recorded_by,
        created_at
      `)
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch expenses',
        details: error.message
      });
    }

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

    res.json({
      success: true,
      data: {
        expenses,
        total_expenses: totalExpenses,
        count: expenses.length
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

    // Recalculate trip statistics and sharing after adding expense
    await updateTripStats(tripId);

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

    // Recalculate trip statistics and sharing after updating expense
    await updateTripStats(tripId);

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

    // Recalculate trip statistics and sharing after deleting expense
    await updateTripStats(tripId);

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
// TRIP SHARING MANAGEMENT
// =====================================================

/**
 * GET /trips/:id/sharing
 * Get trip sharing and profit distribution details
 */
router.get('/:id/sharing', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    // Always recalculate to ensure fresh data
    console.log(' Recalculating trip sharing for trip:', tripId);
    const stats = await calculateTripStats(tripId);
    await updateTripSharing(tripId, stats);
    
    // Fetch the updated sharing data
    const { data: sharing, error } = await supabase
      .from('trip_sharing')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch trip sharing data',
        details: error.message
      });
    }

    console.log(' Returning sharing data:', sharing);
    res.json({
      success: true,
      data: sharing
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /trips/:id/sharing
 * Update trip sharing percentages and recalculate
 */
router.put('/:id/sharing', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { agent_share_percentage, company_share_percentage } = req.body;

    // Validate percentages
    if (agent_share_percentage + company_share_percentage !== 100) {
      return res.status(400).json({
        error: 'Agent and company share percentages must total 100%'
      });
    }

    // Recalculate with new percentages
    const stats = await calculateTripStats(tripId);
    await updateTripSharing(tripId, stats);

    // Get current sharing data first
    const { data: currentSharing } = await supabase
      .from('trip_sharing')
      .select('net_result')
      .eq('trip_id', tripId)
      .single();

    const netResult = currentSharing?.net_result || 0;

    // Update with custom percentages
    const { data: sharing, error } = await supabase
      .from('trip_sharing')
      .update({
        agent_share_percentage,
        company_share_percentage,
        total_agent_share: netResult * agent_share_percentage / 100,
        company_share: netResult * company_share_percentage / 100
      })
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update trip sharing',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Trip sharing updated successfully',
      data: sharing
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

// =====================================================
// CUSTOMER TRIP STATS MANAGEMENT
// =====================================================

/**
 * GET /trips/:id/customers/:customerId/stats
 * Get individual customer stats for a specific trip
 */
router.get('/:id/customers/:customerId/stats', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, customerId } = req.params;

    // Get customer stats from trip_customer_stats table
    const { data: stats, error } = await supabase
      .from('trip_customer_stats')
      .select(`
        *,
        customer:customers(id, name, email, vip_level)
      `)
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({
        error: 'Failed to fetch customer stats',
        details: error.message
      });
    }

    // If no stats exist, calculate from transactions
    if (!stats) {
      const calculatedStats = await calculateCustomerTripStats(tripId, customerId);
      
      // Get customer info
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, email, vip_level')
        .eq('id', customerId)
        .single();

      return res.json({
        success: true,
        data: {
          trip_id: tripId,
          customer_id: customerId,
          customer,
          ...calculatedStats,
          rolling_amount: 0,
          commission_earned: 0,
          notes: null
        }
      });
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /trips/:id/customers/:customerId/stats
 * Update individual customer stats for a specific trip
 */
router.put('/:id/customers/:customerId/stats', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, customerId } = req.params;
    const { 
      total_buy_in, 
      total_cash_out, 
      total_win, 
      total_loss, 
      rolling_amount, 
      commission_earned, 
      notes 
    } = req.body;

    // Calculate net result
    const net_result = (parseFloat(total_cash_out) + parseFloat(total_win)) - 
                      (parseFloat(total_buy_in) + parseFloat(total_loss));

    const { data: stats, error } = await supabase
      .from('trip_customer_stats')
      .upsert({
        trip_id: tripId,
        customer_id: customerId,
        total_buy_in: parseFloat(total_buy_in) || 0,
        total_cash_out: parseFloat(total_cash_out) || 0,
        total_win: parseFloat(total_win) || 0,
        total_loss: parseFloat(total_loss) || 0,
        net_result,
        rolling_amount: parseFloat(rolling_amount) || 0,
        commission_earned: parseFloat(commission_earned) || 0,
        notes,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'trip_id,customer_id'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update customer stats',
        details: error.message
      });
    }

    // Update trip sharing calculations with new customer stats
    const tripStats = await calculateTripStats(tripId);
    await updateTripSharing(tripId, tripStats);

    res.json({
      success: true,
      message: 'Customer stats updated successfully',
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /trips/:id/customer-stats
 * Get all customer stats for a specific trip
 */
router.get('/:id/customer-stats', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    const { data: customerStats, error } = await supabase
      .from('trip_customer_stats')
      .select(`
        *,
        customer:customers(id, name, email, vip_level, total_spent)
      `)
      .eq('trip_id', tripId)
      .order('net_result', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch customer stats',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: customerStats || [],
      total: customerStats?.length || 0
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /trips/:id/recalculate-stats
 * Recalculate all stats for a trip from transactions
 */
router.post('/:id/recalculate-stats', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    // Update all customer stats and trip totals
    const stats = await updateTripStats(tripId);

    res.json({
      success: true,
      message: 'Trip stats recalculated successfully',
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