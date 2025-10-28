import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, canAccessTrip } from './auth.js';
import crypto from 'crypto';
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
      return { total_win_loss: 0, total_buy_in: 0, total_cash_out: 0, net_result: 0, rolling_amount: 0 };
    }

    // Get rolling records data from trip_rolling table with commission rates
    const { data: rollingRecords, error: rollingError } = await supabase
      .from('trip_rolling')
      .select('rolling_amount, commission_rate, commission_earned')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId);

    if (rollingError) {
      console.error('Error fetching rolling records:', rollingError);
      // If rolling_records table doesn't exist, continue without it
    }

    let total_buy_in = 0;
    let total_cash_out = 0;
    let rolling_amount = 0;
    let total_commission_earned = 0;

    // Process transactions - only handle database-allowed types
    transactions?.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      switch (transaction.transaction_type) {
        case 'buy-in':
          total_buy_in += amount;
          break;
        case 'cash-out':
          total_cash_out += amount;
          break;
        // Note: 'win' and 'loss' types are not supported by database constraints
        // Win/loss calculations should be derived from buy-in/cash-out differences
        default:
          console.warn(`Unsupported transaction type: ${transaction.transaction_type}`);
          break;
      }
    });

    // Process rolling records - calculate total rolling amount and commission earned dynamically
    rollingRecords?.forEach(record => {
      const rollingAmt = parseFloat(record.rolling_amount) || 0;
      const commissionEarned = parseFloat(record.commission_earned) || 0;
      
      rolling_amount += rollingAmt;
      total_commission_earned += commissionEarned;
    });

    // Calculate win/loss: buy-in - cash-out (simple difference)
    // Positive = customer won money, Negative = customer lost money
    const total_win_loss = total_buy_in - total_cash_out;

    // Calculate net result for customer: total_win_loss - total_commission_earned
    // This represents the customer's actual profit/loss after commission
    const net_result = total_win_loss - total_commission_earned;

    return {
      total_win_loss,
      total_buy_in,
      total_cash_out,
      net_result,
      rolling_amount,
      total_commission_earned
    };
  } catch (error) {
    console.error('Error in calculateCustomerTripStats:', error);
    return { total_win_loss: 0, total_buy_in: 0, total_cash_out: 0, net_result: 0, rolling_amount: 0, total_commission_earned: 0 };
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
      total_win_loss: stats.total_win_loss,
      net_result: stats.net_result,
      rolling_amount: stats.rolling_amount,
      total_commission_earned: stats.total_commission_earned,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'trip_id,customer_id'
    });

  if (error) {
    console.error('Error updating customer trip stats:', error);
  }

  // Update customer's total win/loss in customers table
  await updateCustomerTotalWinLoss(customerId);
  
  // Update customer's total buy-in and buy-out in customers table
  await updateCustomerTotalBuyInOut(customerId);

  // Update customer's total rolling amount across all trips
  await updateCustomerTotalRolling(customerId);

  return stats;
}

// Helper function to update customer's total win/loss across all trips
async function updateCustomerTotalWinLoss(customerId) {
  try {
    console.log(`📊 Updating customer ${customerId} total win/loss - preserving other data...`);
    
    // Calculate total win/loss from all trip customer stats
    const { data: allStats, error } = await supabase
      .from('trip_customer_stats')
      .select('total_win_loss, net_result')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching customer trip stats:', error);
      return;
    }

    let totalWinLoss = 0;
    allStats?.forEach(stat => {
      totalWinLoss += parseFloat(stat.net_result) || 0;
    });

    console.log(`💰 Customer ${customerId} calculated total win/loss: ${totalWinLoss}`);

    // ⚠️ IMPORTANT: Only update specific fields to preserve other customer data
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_win_loss: totalWinLoss,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer total win/loss:', updateError);
    } else {
      console.log(`✅ Updated customer ${customerId}: total_win_loss=${totalWinLoss} (other fields preserved)`);
    }

  } catch (error) {
    console.error('Error in updateCustomerTotalWinLoss:', error);
  }
}

// Helper function to update customer's total buy-in and buy-out across all trips
async function updateCustomerTotalBuyInOut(customerId) {
  try {
    console.log(`📊 Updating customer ${customerId} total buy-in/buy-out - preserving other data...`);
    
    // Calculate total buy-in and buy-out from all trip customer stats
    const { data: allStats, error } = await supabase
      .from('trip_customer_stats')
      .select('total_buy_in, total_cash_out')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching customer trip stats for buy-in/out:', error);
      return;
    }

    let totalBuyIn = 0;
    let totalBuyOut = 0;
    
    allStats?.forEach(stat => {
      totalBuyIn += parseFloat(stat.total_buy_in) || 0;
      totalBuyOut += parseFloat(stat.total_cash_out) || 0;
    });

    console.log(`💰 Customer ${customerId} calculated totals: buy-in=${totalBuyIn}, buy-out=${totalBuyOut}`);

    // ⚠️ IMPORTANT: Only update specific fields to preserve other customer data
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_buy_in: totalBuyIn,
        total_buy_out: totalBuyOut,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer total buy-in/out:', updateError);
    } else {
      console.log(`✅ Updated customer ${customerId}: total_buy_in=${totalBuyIn}, total_buy_out=${totalBuyOut} (other fields preserved)`);
    }

  } catch (error) {
    console.error('Error in updateCustomerTotalBuyInOut:', error);
  }
}

// Helper function to update customer's total rolling amount across all trips
async function updateCustomerTotalRolling(customerId) {
  try {
    console.log(`🎲 Updating customer ${customerId} total rolling amount - preserving other data...`);
    
    // Calculate total rolling amount from all trip customer stats
    const { data: allStats, error } = await supabase
      .from('trip_customer_stats')
      .select('rolling_amount')
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error fetching customer trip stats for rolling:', error);
      return;
    }

    let totalRolling = 0;
    
    allStats?.forEach(stat => {
      totalRolling += parseFloat(stat.rolling_amount) || 0;
    });

    console.log(`🎲 Customer ${customerId} calculated total rolling: ${totalRolling}`);

    // ⚠️ IMPORTANT: Only update specific fields to preserve other customer data
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_rolling: totalRolling,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer total rolling:', updateError);
    } else {
      console.log(`✅ Updated customer ${customerId}: total_rolling=${totalRolling} (other fields preserved)`);
    }

  } catch (error) {
    console.error('Error in updateCustomerTotalRolling:', error);
  }
}

// Helper function to deduct trip-specific data from customer totals when customer is removed from trip
async function deductTripDataFromCustomer(tripId, customerId) {
  try {
    console.log(`🔄 Deducting trip ${tripId} data from customer ${customerId} totals...`);
    
    // Get the customer's trip stats before deletion
    const { data: tripStats, error: statsError } = await supabase
      .from('trip_customer_stats')
      .select('total_buy_in, total_cash_out, total_win_loss, net_result, rolling_amount')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .single();

    if (statsError || !tripStats) {
      console.log(`No trip stats found for customer ${customerId} in trip ${tripId}, skipping deduction`);
      return;
    }

    console.log(`📊 Trip stats to deduct:`, tripStats);

    // Get current customer totals
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('total_rolling, total_win_loss, total_buy_in, total_buy_out')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Error fetching customer data:', customerError);
      return;
    }

    console.log(`📊 Current customer totals:`, customer);

    // Calculate new totals by deducting trip data
    const newTotalRolling = (parseFloat(customer.total_rolling) || 0) - (parseFloat(tripStats.rolling_amount) || 0);
    const newTotalWinLoss = (parseFloat(customer.total_win_loss) || 0) - (parseFloat(tripStats.total_win_loss) || 0);
    const newTotalBuyIn = (parseFloat(customer.total_buy_in) || 0) - (parseFloat(tripStats.total_buy_in) || 0);
    const newTotalBuyOut = (parseFloat(customer.total_buy_out) || 0) - (parseFloat(tripStats.total_cash_out) || 0);

    console.log(`📊 New customer totals after deduction:`, {
      total_rolling: newTotalRolling,
      total_win_loss: newTotalWinLoss,
      total_buy_in: newTotalBuyIn,
      total_buy_out: newTotalBuyOut
    });

    // Update customer totals
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_rolling: newTotalRolling,
        total_win_loss: newTotalWinLoss,
        total_buy_in: newTotalBuyIn,
        total_buy_out: newTotalBuyOut,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer totals after deduction:', updateError);
    } else {
      console.log(`✅ Successfully deducted trip data from customer ${customerId} totals`);
    }

  } catch (error) {
    console.error('Error in deductTripDataFromCustomer:', error);
  }
}

// Helper function to add trip-specific data to customer totals when customer is added to trip
async function addTripDataToCustomer(tripId, customerId) {
  try {
    console.log(`🔄 Adding trip ${tripId} data to customer ${customerId} totals...`);
    
    // Get the customer's trip stats after addition
    const { data: tripStats, error: statsError } = await supabase
      .from('trip_customer_stats')
      .select('total_buy_in, total_cash_out, total_win_loss, net_result, rolling_amount')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .single();

    if (statsError || !tripStats) {
      console.log(`No trip stats found for customer ${customerId} in trip ${tripId}, skipping addition`);
      return;
    }

    console.log(`📊 Trip stats to add:`, tripStats);

    // Get current customer totals
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('total_rolling, total_win_loss, total_buy_in, total_buy_out')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Error fetching customer data:', customerError);
      return;
    }

    console.log(`📊 Current customer totals:`, customer);

    // Calculate new totals by adding trip data
    const newTotalRolling = (parseFloat(customer.total_rolling) || 0) + (parseFloat(tripStats.rolling_amount) || 0);
    const newTotalWinLoss = (parseFloat(customer.total_win_loss) || 0) + (parseFloat(tripStats.total_win_loss) || 0);
    const newTotalBuyIn = (parseFloat(customer.total_buy_in) || 0) + (parseFloat(tripStats.total_buy_in) || 0);
    const newTotalBuyOut = (parseFloat(customer.total_buy_out) || 0) + (parseFloat(tripStats.total_cash_out) || 0);

    console.log(`📊 New customer totals after addition:`, {
      total_rolling: newTotalRolling,
      total_win_loss: newTotalWinLoss,
      total_buy_in: newTotalBuyIn,
      total_buy_out: newTotalBuyOut
    });

    // Update customer totals
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        total_rolling: newTotalRolling,
        total_win_loss: newTotalWinLoss,
        total_buy_in: newTotalBuyIn,
        total_buy_out: newTotalBuyOut,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer totals after addition:', updateError);
    } else {
      console.log(`✅ Successfully added trip data to customer ${customerId} totals`);
    }

  } catch (error) {
    console.error('Error in addTripDataToCustomer:', error);
  }
}

// Comprehensive function to synchronize all customer data
async function synchronizeCustomerData(customerId) {
  try {
    console.log(`🔄 Starting comprehensive customer data synchronization for customer: ${customerId}`);
    
    // Update all customer statistics
    await updateCustomerTotalWinLoss(customerId);
    await updateCustomerTotalBuyInOut(customerId);
    await updateCustomerTotalRolling(customerId);
    
    console.log(`✅ Completed comprehensive customer data synchronization for customer: ${customerId}`);
  } catch (error) {
    console.error(`Error in synchronizeCustomerData for customer ${customerId}:`, error);
  }
}

// Helper function to calculate trip statistics (no longer updates trips table)
async function calculateTripStats(tripId) {
  try {
    console.log('📊 Calculating trip statistics for trip:', tripId);
    
    // Get all customer stats for this trip
    const { data: customerStats, error } = await supabase
      .from('trip_customer_stats')
      .select('total_buy_in, total_cash_out, total_win_loss, net_result')
      .eq('trip_id', tripId);

    if (error) {
      console.error('Error calculating trip stats:', error);
      return { total_win_loss: 0, net_profit: 0, total_buy_in: 0, total_cash_out: 0 };
    }

    let total_win_loss = 0;
    let total_buy_in = 0;
    let total_cash_out = 0;

    customerStats?.forEach(stats => {
      total_win_loss += parseFloat(stats.total_win_loss) || 0;
      total_buy_in += parseFloat(stats.total_buy_in) || 0;
      total_cash_out += parseFloat(stats.total_cash_out) || 0;
    });

    // Net profit is the sum of all customer win/loss (total_buy_in - total_cash_out)
    // This represents the total win/loss from customer perspective
    const net_profit = total_win_loss;

    return {
      total_win_loss,
      net_profit,
      total_buy_in,
      total_cash_out
    };
  } catch (error) {
    console.error('Error in calculateTripStats:', error);
    return { total_win_loss: 0, net_profit: 0, total_buy_in: 0, total_cash_out: 0 };
  }
}

// Helper function to update trip statistics (now only calculates, doesn't update trips table)
async function updateTripStats(tripId) {
  const stats = await calculateTripStats(tripId);
  
  console.log('📊 Calculated trip stats:', {
    tripId,
    stats
  });
  
  // Note: Financial stats are now stored in trip_sharing table, not trips table
  console.log('✅ Trip stats calculated successfully (stored in trip_sharing)');
  
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

    // Get customer stats data (commission data now comes from trip_rolling)
    const { data: customerStats, error: statsError } = await supabase
      .from('trip_customer_stats')
      .select('customer_id, rolling_amount, total_commission_earned, net_result')
      .eq('trip_id', tripId);

    if (statsError) {
      console.error('Error fetching customer stats for sharing:', statsError);
      return;
    }

    // Check if there are any customers - if not, set sharing values to 0 but preserve expenses
    const hasCustomers = customerStats && customerStats.length > 0;
    
    // Get rolling data with commission information from trip_rolling table
    const { data: tripRollingRecords, error: rollingError } = await supabase
      .from('trip_rolling')
      .select('rolling_amount, commission_rate, commission_earned')
      .eq('trip_id', tripId);

    if (rollingError) {
      console.error('Error fetching trip rolling records:', rollingError);
      // Try the rolling_records table as fallback
      const { data: legacyRollingRecords, error: legacyError } = await supabase
        .from('rolling_records')
        .select('rolling_amount')
        .eq('trip_id', tripId);
        
      if (legacyError) {
        console.error('Error fetching legacy rolling records:', legacyError);
      } else if (legacyRollingRecords && legacyRollingRecords.length > 0) {
        console.log('Found rolling data in legacy rolling_records table:', legacyRollingRecords.length, 'records');
        tripRollingRecords = legacyRollingRecords;
      }
    }

    // Calculate total rolling and commission from trip_rolling table (dynamic rates)
    let totalRollingFromTable = 0;
    let totalRollingCommission = 0;
    
    if (tripRollingRecords && tripRollingRecords.length > 0) {
      tripRollingRecords.forEach(record => {
        const rollingAmount = parseFloat(record.rolling_amount) || 0;
        const commissionEarned = parseFloat(record.commission_earned) || 0;
        
        totalRollingFromTable += rollingAmount;
        totalRollingCommission += commissionEarned;
      });
    }
      
    console.log('📊 Dynamic Rolling Commission Calculation:');
    console.log('- Total rolling records:', tripRollingRecords?.length || 0);
    console.log('- Total rolling amount from trip_rolling:', totalRollingFromTable);
    console.log('- Total rolling commission (dynamic rates):', totalRollingCommission);
    
    // Get total rolling from customer stats for comparison
    const totalRolling = hasCustomers ? 
      customerStats.reduce((sum, stat) => sum + (parseFloat(stat.rolling_amount) || 0), 0) : 0;
    
    console.log('🎲 Rolling Data Comparison:');
    console.log('- hasCustomers:', hasCustomers);
    console.log('- totalRolling (customer stats):', totalRolling);
    console.log('- totalRollingFromTable (trip_rolling):', totalRollingFromTable);
    console.log('- totalRollingCommission (dynamic):', totalRollingCommission);

    // Calculate net cash flow and result from company perspective
    let netCashFlow, netResult;
    
    if (hasCustomers) {
      netCashFlow = (tripStats.total_cash_out || 0) - (tripStats.total_buy_in || 0);
      // Net result for trip_sharing: total_win_loss - total_expenses - total_rolling_commission
      netResult = (tripStats.total_win_loss || 0) - totalExpenses - totalRollingCommission;
    } else {
      // No customers: cash flow is 0, result is negative expenses only
      netCashFlow = 0;
      netResult = -totalExpenses; // Only expenses affect the result
    }

    // Get actual agent profit sharing rates from trip_agent_customers table
    const { data: agentCustomers, error: agentError } = await supabase
      .from('trip_agent_customers')
      .select('agent_id, customer_id, profit_sharing_rate')
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
              
              if (customerNet > 0) {
                // Customer won, agent gets profit share (positive)
                agentCommission = (customerNet * parseFloat(agent.commission_rate) / 100);
              } else if (customerNet < 0) {
                // Customer lost, agent shares the loss (negative)
                agentCommission = (customerNet * parseFloat(agent.commission_rate) / 100);
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
          
          console.log(`💰 Customer ${ac.customer_id}: net=${customerNet}, winLoss=${winLossAmount}, rate=${ac.profit_sharing_rate}%`);
          
          if (customerNet > 0) {
            // Customer won, agent gets profit share (positive)
            agentCommission = (customerNet * parseFloat(ac.profit_sharing_rate) / 100);
            console.log(`📈 Customer won, agent gets profit share: ${agentCommission}`);
          } else if (customerNet < 0) {
            // Customer lost, agent shares the loss (negative)
            agentCommission = (customerNet * parseFloat(ac.profit_sharing_rate) / 100);
            console.log(`📉 Customer lost, agent shares loss: ${agentCommission}`);
          } else {
            console.log(`⚖️ Customer broke even, no commission`);
          }
          
          if (!agentBreakdownMap[ac.agent_id]) {
            agentBreakdownMap[ac.agent_id] = {
              agent_id: ac.agent_id,
              profit_sharing_rate: parseFloat(ac.profit_sharing_rate),
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
    
    // Get total_agent_share from trip_agent_summary table (sum of all agents' total_commission)
    const { data: agentSummaries, error: summaryError } = await supabase
      .from('trip_agent_summary')
      .select('total_commission')
      .eq('trip_id', tripId);
    
    if (summaryError) {
      console.error('Error fetching agent summaries for trip sharing:', summaryError);
    }
    
    // Calculate total_agent_share from trip_agent_summary table
    const totalAgentShare = agentSummaries?.reduce((sum, summary) => 
      sum + (parseFloat(summary.total_commission) || 0), 0
    ) || 0;
    
    console.log('📊 Agent share calculation:');
    console.log('- Agent summaries from trip_agent_summary:', agentSummaries);
    console.log('- Total agent share (from trip_agent_summary):', totalAgentShare);
    console.log('- Total agent commission (from current calculation):', totalAgentCommission);
    
    // Calculate company_share = net_result - total_agent_share
    const companyShare = netResult - totalAgentShare;
    
    // Calculate total amount for percentage calculation using totalAgentShare
    const totalAmount = Math.abs(totalAgentShare) + Math.abs(companyShare);
    
    // Calculate percentages using |amount|/|total|, direction indicated by total amount sign
    let agentSharePercentage = 0;
    let companySharePercentage = 0;
    
    if (totalAmount > 0) {
      agentSharePercentage = Math.round((Math.abs(totalAgentShare) / totalAmount) * 10000) / 100;
      companySharePercentage = Math.round((Math.abs(companyShare) / totalAmount) * 10000) / 100;
    }
    
    console.log('💰 Trip Sharing Calculation (Updated Logic):');
    console.log('- Net result:', netResult);
    console.log('- Total agent share (from trip_agent_summary):', totalAgentShare);
    console.log('- Company share = net_result - total_agent_share');
    console.log(`- Company share = ${netResult} - ${totalAgentShare} = ${companyShare}`);
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
      total_agent_share: totalAgentShare,
      company_share: companyShare,
      agent_share_percentage: agentSharePercentage,
      company_share_percentage: companySharePercentage,
      agent_breakdown: agentBreakdown,
      total_rolling: totalRolling // Total rolling amount from customer stats (trip_customer_stats)
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
      
      // Update trip_agent_summary table with detailed agent profit sharing
      await updateTripAgentSummary(tripId, agentBreakdown, tripStats);
    }
    
  } catch (error) {
    console.error('Error updating trip sharing:', error);
  }
}

// Helper function to recalculate agent statistics from actual data
async function recalculateAgentStatistics(agentId) {
  try {
    console.log('🔄 Recalculating agent statistics for agent:', agentId);
    
    // Get all trips this agent is assigned to
    const { data: tripAgents, error: tripError } = await supabase
      .from('trip_agents')
      .select('trip_id')
      .eq('agent_id', agentId);
    
    if (tripError) {
      console.error('Error fetching agent trips:', tripError);
      return;
    }
    
    const totalTrips = tripAgents.length;
    let totalCommission = 0;
    
    // Calculate total commission from trip_sharing records
    for (const tripAgent of tripAgents) {
      const { data: sharing, error: sharingError } = await supabase
        .from('trip_sharing')
        .select('agent_breakdown')
        .eq('trip_id', tripAgent.trip_id)
        .single();
      
      if (!sharingError && sharing?.agent_breakdown) {
        const agentShare = sharing.agent_breakdown.find(a => a.agent_id === agentId);
        if (agentShare) {
          totalCommission += parseFloat(agentShare.share_amount || 0);
        }
      }
    }
    
    // Update agent statistics with calculated totals
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        total_commission: totalCommission,
        total_trips: totalTrips
      })
      .eq('id', agentId);
    
    if (updateError) {
      console.error(`Error updating agent ${agentId} statistics:`, updateError);
    } else {
      console.log(`✅ Recalculated agent ${agentId}: ${totalCommission} commission, ${totalTrips} trips`);
    }
    
  } catch (error) {
    console.error('Error in recalculateAgentStatistics:', error);
  }
}

// Helper function to update agent statistics
async function updateAgentStatistics(tripId, agentBreakdown) {
  try {
    console.log('📊 Updating agent statistics for trip:', tripId);
    
    // Get all agents involved in this trip
    const { data: tripAgents, error: tripAgentsError } = await supabase
      .from('trip_agents')
      .select('agent_id')
      .eq('trip_id', tripId);
    
    if (tripAgentsError) {
      console.error('Error fetching trip agents:', tripAgentsError);
      return;
    }
    
    // Recalculate statistics for all agents involved in this trip
    const agentIds = tripAgents.map(ta => ta.agent_id);
    
    for (const agentId of agentIds) {
      await recalculateAgentStatistics(agentId);
    }
    
  } catch (error) {
    console.error('Error in updateAgentStatistics:', error);
  }
}

// Helper function to update trip_agent_summary table
async function updateTripAgentSummary(tripId, agentBreakdown, tripStats) {
  try {
    console.log('📊 Updating trip_agent_summary for trip:', tripId);
    
    // Get all customer stats for this trip to calculate agent-specific totals
    const { data: customerStats, error: customerError } = await supabase
      .from('trip_customer_stats')
      .select('*')
      .eq('trip_id', tripId);
    
    if (customerError) {
      console.error('Error fetching customer stats:', customerError);
      return;
    }
    
    // Get agent-customer relationships with profit sharing rates
    const { data: agentCustomers, error: agentError } = await supabase
      .from('trip_agent_customers')
      .select('agent_id, customer_id, profit_sharing_rate')
      .eq('trip_id', tripId);
    
    if (agentError) {
      console.error('Error fetching agent customers:', agentError);
      return;
    }
    
    // Calculate detailed summary for each agent
    for (const agentData of agentBreakdown) {
      const agentId = agentData.agent_id;
      
      // Get customers managed by this agent
      const agentCustomerIds = agentCustomers
        .filter(ac => ac.agent_id === agentId)
        .map(ac => ac.customer_id);
      
      // Calculate totals for customers managed by this agent
      const agentCustomerStats = customerStats.filter(cs => 
        agentCustomerIds.includes(cs.customer_id)
      );
      
      const totalWinLoss = agentCustomerStats.reduce((sum, cs) => 
        sum + (cs.total_win_loss || 0), 0
      );
      
      const totalProfit = agentCustomerStats.reduce((sum, cs) => 
        sum + (cs.net_result || 0), 0
      );
      
      // Agent's commission from this trip (from agentBreakdown)
      const totalCommission = agentData.share_amount || 0;
      
      // Agent's profit share = their actual profit sharing amount (positive = profit, negative = loss)
      const agentProfitShare = totalCommission;
      
      console.log(`💰 Agent ${agentId} summary:`, {
        totalWinLoss,
        totalCommission,
        totalProfit,
        agentProfitShare,
        customerCount: agentCustomerStats.length
      });
      
      // Upsert to trip_agent_summary table
      const summaryData = {
        trip_id: tripId,
        agent_id: agentId,
        total_win_loss: totalWinLoss,
        total_commission: totalCommission,
        total_profit: totalProfit,
        agent_profit_share: agentProfitShare,
        updated_at: new Date().toISOString()
      };
      
      const { data: summaryResult, error: summaryError } = await supabase
        .from('trip_agent_summary')
        .upsert(summaryData, { 
          onConflict: 'trip_id,agent_id',
          ignoreDuplicates: false 
        })
        .select();
      
      if (summaryError) {
        console.error(`Error updating trip_agent_summary for agent ${agentId}:`, summaryError);
      } else {
        console.log(`✅ Trip agent summary updated for agent ${agentId}:`, summaryResult);
      }
    }
    
  } catch (error) {
    console.error('Error in updateTripAgentSummary:', error);
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
        
        let trips = [];
        
        if (userRole === 'staff') {
            // For staff, get trips through trip_staff relationship table
            const staffId = req.user.staff_id;
            
            if (!staffId) {
                return res.status(400).json({
                    error: 'Staff ID not found for user'
                });
            }
            
            // First get trip IDs from trip_staff table
            const { data: tripStaffData, error: tripStaffError } = await supabase
                .from('trip_staff')
                .select('trip_id')
                .eq('staff_id', staffId);
            
            if (tripStaffError) {
                return res.status(500).json({
                    error: 'Failed to fetch staff trip assignments',
                    details: tripStaffError.message
                });
            }
            
            const tripIds = tripStaffData.map(ts => ts.trip_id);
            
            if (tripIds.length === 0) {
                trips = [];
            } else {
                // Get trip details for assigned trips
                const { data: staffTrips, error: staffError } = await supabase
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
                        activecustomerscount
                    `)
                    .in('id', tripIds)
                    .eq('status', 'active');
                    
                if (staffError) {
                    return res.status(500).json({
                        error: 'Failed to fetch staff trips',
                        details: staffError.message
                    });
                }
                
                trips = staffTrips || [];
            }
        } else {
            // For admin/other roles, get all active trips
            const { data: allTrips, error } = await supabase
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
                    activecustomerscount
                `)
                .eq('status', 'active');
                
            if (error) {
                return res.status(500).json({
                    error: 'Failed to fetch trips',
                    details: error.message
                });
            }
            
            trips = allTrips || [];
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
          created_at,
          updated_at,
          activecustomerscount,
          currency,
          exchange_rate_peso,
          exchange_rate_hkd,
          exchange_rate_myr,
          staff!staff_id(id, name, email)
        `);
        // Staff can only see their assigned trips
        if (userRole === 'staff') {
            // Query trips through trip_staff relationship table
            const staffId = req.user.staff_id;
            const { data: tripStaffData, error: tripStaffError } = await supabase
                .from('trip_staff')
                .select('trip_id')
                .eq('staff_id', staffId);
            
            if (tripStaffError) {
                return res.status(500).json({
                    error: 'Failed to fetch staff trips',
                    details: tripStaffError.message
                });
            }
            
            const tripIds = tripStaffData.map(ts => ts.trip_id);
            if (tripIds.length === 0) {
                // No trips assigned to this staff
                return res.json({
                    success: true,
                    data: [],
                    userRole,
                    totalTrips: 0
                });
            }
            
            query = query.in('id', tripIds);
        }
        const { data: trips, error } = await query;
        if (error) {
            return res.status(500).json({
                error: 'Failed to fetch trips',
                details: error.message
            });
        }

        // Fetch trip sharing data for all trips
        const tripsWithSharing = await Promise.all(trips.map(async (trip) => {
            const { data: sharing, error: sharingError } = await supabase
                .from('trip_sharing')
                .select('*')
                .eq('trip_id', trip.id)
                .single();

            // Convert database column names to camelCase for frontend consistency
            const normalizedSharing = sharing ? {
                totalWinLoss: sharing.total_win_loss || 0,
                totalExpenses: sharing.total_expenses || 0,
                totalRolling: sharing.total_rolling || 0, // Add missing totalRolling field
                totalRollingCommission: (sharing.total_rolling || 0) * 0.014, // Calculate commission
                totalBuyIn: sharing.total_buy_in || 0,
                totalBuyOut: sharing.total_buy_out || 0,
                netCashFlow: sharing.net_cash_flow || 0,
                netResult: sharing.net_result || 0,
                totalAgentShare: sharing.total_agent_share || 0,
                companyShare: sharing.company_share || 0,
                agentSharePercentage: sharing.agent_share_percentage || 0,
                companySharePercentage: sharing.company_share_percentage || 100,
                agentBreakdown: sharing.agent_breakdown || [],
                // Also include snake_case versions for backward compatibility
                total_rolling: sharing.total_rolling || 0,
                total_win_loss: sharing.total_win_loss || 0,
                total_expenses: sharing.total_expenses || 0
            } : {
                totalWinLoss: 0,
                totalExpenses: 0,
                totalRolling: 0, // Add missing totalRolling field
                totalRollingCommission: 0,
                totalBuyIn: 0,
                totalBuyOut: 0,
                netCashFlow: 0,
                netResult: 0,
                totalAgentShare: 0,
                companyShare: 0,
                agentSharePercentage: 0,
                companySharePercentage: 100,
                agentBreakdown: [],
                // Also include snake_case versions for backward compatibility
                total_rolling: 0,
                total_win_loss: 0,
                total_expenses: 0
            };

            return {
                ...trip,
                sharing: normalizedSharing
            };
        }));

        res.json({
            success: true,
            data: tripsWithSharing,
            userRole,
            totalTrips: tripsWithSharing?.length || 0
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
        const { trip_name, destination, start_date, end_date, total_budget, staff_id, currency, exchange_rate_peso, exchange_rate_hkd, exchange_rate_myr } = req.body;
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
            status: 'active',
            currency: currency || 'HKD',
            exchange_rate_peso: exchange_rate_peso || 1.0000,
            exchange_rate_hkd: exchange_rate_hkd || 1.0000,
            exchange_rate_myr: exchange_rate_myr || 1.0000
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

        // Comprehensive customer data synchronization when trip is completed
        console.log('🎯 Trip completed, performing comprehensive customer data synchronization...');
        
        // 1. Update all customer trip statistics (including rolling amounts)
        const { data: tripCustomers } = await supabase
          .from('trip_customers')
          .select('customer_id')
          .eq('trip_id', tripId);
          
        if (tripCustomers) {
          console.log(`📊 Updating statistics for ${tripCustomers.length} customers...`);
          for (const tc of tripCustomers) {
            // Update customer trip stats (includes rolling amounts from trip_rolling table)
            await updateCustomerTripStats(tripId, tc.customer_id);
            
            // Update customer's total win/loss across all trips
            await updateCustomerTotalWinLoss(tc.customer_id);
            
            // Update customer's total buy-in/buy-out across all trips
            await updateCustomerTotalBuyInOut(tc.customer_id);
            
            // Update customer's total rolling amount across all trips
            await updateCustomerTotalRolling(tc.customer_id);
          }
        }
        
        // 2. Update trip-level statistics and sharing
        const tripStats = await updateTripStats(tripId);
        
        // 3. Update trip sharing calculations (includes rolling commission)
        await updateTripSharing(tripId, tripStats);
        
        console.log('✅ Customer data synchronization completed for trip:', tripId);
        
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
        total_win_loss: 0,
        net_result: 0,
        rolling_amount: 0,
        total_commission_earned: 0
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
            profit_sharing_rate: agentData?.commission_rate || 0
          });

      } catch (agentError) {
        console.error('Error adding agent to trip:', agentError);
        // Don't fail the customer addition if agent addition fails
      }
    }

    // Add trip data to customer totals after successful addition
    await addTripDataToCustomer(tripId, customer_id);

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
    const { customer_id, profit_sharing_rate } = req.body;

    if (!customer_id || profit_sharing_rate === undefined) {
      return res.status(400).json({
        error: 'Customer ID and profit sharing rate are required'
      });
    }

    // Update the profit sharing rate for this agent-customer relationship
    const { data, error } = await supabase
      .from('trip_agent_customers')
      .update({
        profit_sharing_rate: profit_sharing_rate,
        updated_at: new Date().toISOString()
      })
      .eq('trip_id', tripId)
      .eq('agent_id', agentId)
      .eq('customer_id', customer_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to update profit sharing rate',
        details: error.message
      });
    }

    // Recalculate trip sharing after profit sharing rate change
    try {
      const tripStats = await calculateTripStats(tripId);
      await updateTripSharing(tripId, tripStats);
      console.log('✅ Trip sharing recalculated after profit sharing rate update');
    } catch (sharingError) {
      console.error('⚠️ Failed to recalculate trip sharing:', sharingError);
    }

    res.json({
      success: true,
      message: 'Profit sharing rate updated successfully',
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
                profit_sharing_rate: agentData?.commission_rate || 0
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
        profit_sharing_rate
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
        total_win_loss,
        net_result,
        rolling_amount,
        commission_rate,
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
      const commissionRate = item.profit_sharing_rate || 0;
      
      const agent = agentMap[agentId];
      const customer = customerMap[customerId];
      const customerStats = statsMap[customerId] || {
        total_buy_in: 0,
        total_cash_out: 0,
        total_win_loss: 0,
        net_result: 0,
        rolling_amount: 0,
        commission_rate: 0.014,
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
      
      // Agent Commission: Based on customer profit sharing
      let agentCommission = 0;
      
      if (customerNet > 0) {
        // Customer made profit, agent gets profit sharing percentage
        agentCommission = (customerNet * commissionRate / 100);
      } else if (customerNet < 0) {
        // Customer lost money, agent shares the loss (negative commission)
        agentCommission = (customerNet * commissionRate / 100);
      }
      // If customerNet = 0, agentCommission remains 0
      
      // Rolling Commission: Junket revenue based on customer rolling amount (default 1.4%)
      const rollingCommissionRate = 1.4; // Default 1.4%, can be made configurable later
      const rollingCommission = (rollingAmount * rollingCommissionRate / 100);
      
      console.log(`💰 Profit sharing calculation for ${customer ? customer.name : customerId}:`, {
        commissionRate,
        buyIn,
        cashOut,
        customerNet,
        rollingAmount,
        agentCommission,
        rollingCommission,
        rollingCommissionRate,
        scenario: customerNet > 0 ? 'Customer profit - Agent gets share' : 
                 customerNet < 0 ? 'Customer loss - Agent shares loss' : 'Break even'
      });

      agentProfitMap[agentId].customers.push({
        customer_id: customerId,
        customer_name: customer ? customer.name : 'Unknown Customer',
        profit_sharing_rate: commissionRate,
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

    // IMPORTANT: Deduct trip data from customer totals BEFORE deleting the stats
    await deductTripDataFromCustomer(tripId, customerId);

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
    
    // Recalculate agent statistics
    await recalculateAgentStatistics(agent_id);

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
 * POST /trips/:id/staff
 * Add staff to trip
 */
router.post('/:id/staff', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { staff_id } = req.body;
    
    console.log('POST /trips/:id/staff - Request data:', {
      tripId,
      body: req.body,
      staff_id
    });
    
    if (!staff_id) {
      console.log('Missing staff_id in request body');
      return res.status(400).json({
        error: 'Staff ID is required'
      });
    }

    // Check if staff exists
    console.log('🔍 Looking for staff with ID:', staff_id);
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, name, email, position')
      .eq('id', staff_id)
      .single();

    console.log('📊 Staff lookup result:', { staff, staffError });

    if (staffError || !staff) {
      console.log('❌ Staff not found:', staffError);
      return res.status(404).json({
        error: 'Staff member not found',
        debug: { staffError, staff_id }
      });
    }

    // Check if staff is already assigned to this trip
    const { data: existing, error: existingError } = await supabase
      .from('trip_staff')
      .select('id')
      .eq('trip_id', tripId)
      .eq('staff_id', staff_id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing staff:', existingError);
      return res.status(500).json({
        error: 'Failed to check existing staff assignment',
        details: existingError.message
      });
    }

    if (existing) {
      return res.status(400).json({
        error: 'Staff member is already assigned to this trip'
      });
    }

    // Add staff to trip
    const { data: tripStaff, error } = await supabase
      .from('trip_staff')
      .insert({
        trip_id: tripId,
        staff_id: staff_id,
        created_at: new Date().toISOString()
      })
      .select(`
        id,
        staff_id,
        created_at
      `)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Failed to add staff to trip',
        details: error.message
      });
    }

    // Update trip stats after staff addition
    await updateTripStats(tripId);

    res.status(201).json({
      success: true,
      message: `Staff member ${staff.name} added to trip successfully`,
      data: {
        ...tripStaff,
        staff: staff
      }
    });

  } catch (error) {
    console.error('Error adding staff to trip:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /trips/:id/staff/:staffId
 * Remove staff from trip
 */
router.delete('/:id/staff/:staffId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tripId = req.params.id;
    const staffId = req.params.staffId;

    // Check if staff assignment exists
    const { data: existing, error: checkError } = await supabase
      .from('trip_staff')
      .select('id')
      .eq('trip_id', tripId)
      .eq('staff_id', staffId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        error: 'Staff assignment not found'
      });
    }

    // Remove staff from trip
    const { error } = await supabase
      .from('trip_staff')
      .delete()
      .eq('trip_id', tripId)
      .eq('staff_id', staffId);

    if (error) {
      return res.status(500).json({
        error: 'Failed to remove staff from trip',
        details: error.message
      });
    }

    // Update trip stats after staff removal
    await updateTripStats(tripId);

    res.json({
      success: true,
      message: 'Staff member removed from trip successfully'
    });

  } catch (error) {
    console.error('Error removing staff from trip:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /trips/:id/staff
 * Get all staff assigned to trip
 */
router.get('/:id/staff', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;

    // Get trip staff assignments
    const { data: tripStaff, error } = await supabase
      .from('trip_staff')
      .select('id, staff_id, created_at')
      .eq('trip_id', tripId);

    if (error) {
      console.error('Error fetching trip staff:', error);
      return res.status(500).json({
        error: 'Failed to fetch trip staff',
        details: error.message
      });
    }

    // Get staff details separately
    const staffIds = (tripStaff || []).map(ts => ts.staff_id);
    console.log('🔍 Staff IDs to fetch:', staffIds);
    let staffDetails = [];
    
    if (staffIds.length > 0) {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, name, email, position, status')
        .in('id', staffIds);
        
      console.log('📊 Staff details fetch result:', { staff, staffError });
        
      if (staffError) {
        console.error('Error fetching staff details:', staffError);
      } else {
        staffDetails = staff || [];
      }
    }

    // Get shift photos for each staff member for this trip
    const transformedStaff = await Promise.all((tripStaff || []).map(async (ts) => {
      const staffInfo = staffDetails.find(s => s.id === ts.staff_id);
      
      // Get shift photos for this staff member during this trip
      const { data: shiftPhotos, error: shiftError } = await supabase
        .from('staff_shifts')
        .select('id, check_in_photo, check_out_photo, shift_date, created_at')
        .eq('staff_id', ts.staff_id)
        .gte('shift_date', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString()) // Last 30 days
        .order('shift_date', { ascending: false });
      
      if (shiftError) {
        console.error('Error fetching shift photos for staff:', ts.staff_id, shiftError);
      }
      
      // Transform shift photos for PhotoDisplay component
      const shift_photos = [];
      if (shiftPhotos) {
        shiftPhotos.forEach(shift => {
          if (shift.check_in_photo) {
            shift_photos.push({
              id: `${shift.id}-checkin`,
              photo_data: shift.check_in_photo,
              data: shift.check_in_photo,
              filename: `check-in-${shift.shift_date}`,
              type: 'image/jpeg',
              status: 'approved',
              upload_date: shift.created_at,
              shift_date: shift.shift_date
            });
          }
          if (shift.check_out_photo) {
            shift_photos.push({
              id: `${shift.id}-checkout`,
              photo_data: shift.check_out_photo,
              data: shift.check_out_photo,
              filename: `check-out-${shift.shift_date}`,
              type: 'image/jpeg',
              status: 'approved',
              upload_date: shift.created_at,
              shift_date: shift.shift_date
            });
          }
        });
      }
      
      return {
        id: ts.id,
        staffId: ts.staff_id,
        staff_id: ts.staff_id,
        name: staffInfo?.name,
        email: staffInfo?.email,
        position: staffInfo?.position,
        staffName: staffInfo?.name,
        staffEmail: staffInfo?.email,
        staffPosition: staffInfo?.position,
        staff: staffInfo,
        created_at: ts.created_at,
        shift_photos: shift_photos
      };
    }));

    res.json({
      success: true,
      data: transformedStaff
    });

  } catch (error) {
    console.error('Error fetching trip staff:', error);
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
    
    // Recalculate agent statistics
    await recalculateAgentStatistics(agentId);

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
    const { 
      customer_id, 
      agent_id, 
      amount, 
      transaction_type, 
      venue, 
      status = 'completed',
      recorded_by_staff_id,
      updated_at
    } = req.body;
    
    console.log('🔄 Transaction request received:', {
      tripId,
      body: req.body,
      user: req.user?.id
    });
    
    // Validate required fields
    if (!customer_id || !amount || !transaction_type) {
      console.log('❌ Missing required fields:', { customer_id, amount, transaction_type });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_id', 'amount', 'transaction_type']
      });
    }

    // Validate transaction type - must match database constraint
    const validTypes = ['buy-in', 'cash-out'];
    if (!validTypes.includes(transaction_type)) {
      return res.status(400).json({
        error: 'Invalid transaction type',
        allowed: validTypes,
        note: 'Database only supports buy-in and cash-out transaction types'
      });
    }

    // Verify customer exists and is part of the trip
    const { data: tripCustomer, error: customerError } = await supabase
      .from('trip_customers')
      .select('customer_id')
      .eq('trip_id', tripId)
      .eq('customer_id', customer_id)
      .single();

    if (customerError || !tripCustomer) {
      console.log('❌ Customer not found in trip:', { customer_id, tripId, customerError });
      return res.status(400).json({
        error: 'Customer not found in this trip'
      });
    }

    console.log('✅ Customer verified in trip');

    // Get customer's agent if not provided, but validate it exists
    let finalAgentId = agent_id;
    if (!finalAgentId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('agent_id')
        .eq('id', customer_id)
        .single();
      
      if (customer?.agent_id) {
        // Verify agent exists before using it
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('id')
          .eq('id', customer.agent_id)
          .single();
        
        if (agent && !agentError) {
          finalAgentId = customer.agent_id;
        } else {
          console.warn(`Customer ${customer_id} has invalid agent_id: ${customer.agent_id}`);
          finalAgentId = null; // Leave null if agent doesn't exist
        }
      }
    } else {
      // If agent_id provided, verify it exists
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('id', agent_id)
        .single();
      
      if (agentError || !agent) {
        console.warn(`Provided agent_id ${agent_id} does not exist`);
        finalAgentId = null; // Leave null if agent doesn't exist
      }
    }

    // Handle recorded_by_staff_id - only set if user is staff or if explicitly provided
    let recordedByStaffId = recorded_by_staff_id;
    if (!recordedByStaffId && req.user.role === 'staff') {
      recordedByStaffId = req.user.id; // Only if user is staff
    }
    // If user is admin or no valid staff ID, leave it null (allowed by schema)

    const transactionData = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      customer_id,
      agent_id: finalAgentId,
      amount: parseFloat(amount),
      transaction_type,
      status: status || 'completed',
      venue: venue || null,
      recorded_by_staff_id: recordedByStaffId, // Can be null
      created_at: new Date().toISOString(),
      updated_at: updated_at || new Date().toISOString() // Use provided updated_at or current time as fallback
    };

    console.log('🔄 Inserting transaction:', transactionData);
    console.log('🔍 Updated_at value being inserted:', {
      original: updated_at,
      processed: updated_at || new Date().toISOString(),
      final: transactionData.updated_at
    });

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Database error inserting transaction:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      });
      
      // Handle specific constraint violations
      if (error.code === '23503') { // Foreign key violation
        if (error.message.includes('customer_id')) {
          return res.status(400).json({
            error: 'Invalid customer ID - customer not found',
            details: error.message
          });
        } else if (error.message.includes('agent_id')) {
          return res.status(400).json({
            error: 'Invalid agent ID - agent not found',
            details: error.message
          });
        } else if (error.message.includes('staff_id')) {
          return res.status(400).json({
            error: 'Invalid staff ID - staff not found',
            details: error.message
          });
        } else if (error.message.includes('trip_id')) {
          return res.status(400).json({
            error: 'Invalid trip ID - trip not found',
            details: error.message
          });
        }
      } else if (error.code === '23514') { // Check constraint violation
        if (error.message.includes('transaction_type')) {
          return res.status(400).json({
            error: 'Invalid transaction type - must be buy-in or cash-out',
            details: error.message
          });
        } else if (error.message.includes('status')) {
          return res.status(400).json({
            error: 'Invalid status - must be pending, completed, or cancelled',
            details: error.message
          });
        }
      }
      
      return res.status(500).json({
        error: 'Failed to add transaction',
        details: error.message,
        code: error.code
      });
    }

    console.log('✅ Transaction created successfully:', transaction);

    // Update customer trip stats automatically
    try {
      await updateCustomerTripStats(tripId, customer_id);
      console.log('✅ Customer trip stats updated');
    } catch (statsError) {
      console.error('⚠️ Failed to update customer trip stats:', statsError);
    }

    // Update trip statistics and sharing
    try {
      const updatedStats = await updateTripStats(tripId);
      await updateTripSharing(tripId, updatedStats);
      console.log('✅ Trip stats and sharing updated');
    } catch (statsError) {
      console.error('⚠️ Failed to update trip stats:', statsError);
      // Don't fail the request if stats update fails
    }

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: transaction
    });

  } catch (error) {
    console.error('❌ Unexpected error in transaction endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

    // Calculate agent share and company share
    const agentShare = netResult * agent_share_percentage / 100;
    const companyShare = netResult - agentShare; // company_share = net_result - agent_share
    
    // Update with custom percentages
    const { data: sharing, error } = await supabase
      .from('trip_sharing')
      .update({
        agent_share_percentage,
        company_share_percentage,
        total_agent_share: agentShare,
        company_share: companyShare
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
      .select('id, trip_name, total_budget')
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
          commission_rate: 0.014
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
      total_win_loss, 
      rolling_amount
    } = req.body;

    // Get commission earned from trip_rolling records for this customer
    const { data: rollingRecords } = await supabase
      .from('trip_rolling')
      .select('commission_earned')
      .eq('trip_id', tripId)
      .eq('customer_id', customerId);

    // Calculate total commission earned from rolling records
    const total_commission_earned = rollingRecords?.reduce((sum, record) => 
      sum + (parseFloat(record.commission_earned) || 0), 0) || 0;

    // Calculate net result: total_win_loss - total_commission_earned
    const net_result = (parseFloat(total_win_loss) || 0) - total_commission_earned;

    const { data: stats, error } = await supabase
      .from('trip_customer_stats')
      .upsert({
        trip_id: tripId,
        customer_id: customerId,
        total_buy_in: parseFloat(total_buy_in) || 0,
        total_cash_out: parseFloat(total_cash_out) || 0,
        total_win_loss: parseFloat(total_win_loss) || 0,
        net_result,
        rolling_amount: parseFloat(rolling_amount) || 0,
        total_commission_earned,
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

    // Update customer's total rolling amount across all trips
    await updateCustomerTotalRolling(customerId);

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

    console.log('🔍 Fetching customer stats for trip:', tripId);
    
    const { data: customerStats, error } = await supabase
      .from('trip_customer_stats')
      .select(`
        *,
        customer:customers(id, name, email, vip_level, total_spent)
      `)
      .eq('trip_id', tripId)
      .order('net_result', { ascending: false });
      
    console.log('📊 Customer stats result:', { count: customerStats?.length, error });

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
    
    // Also update trip sharing to ensure total_rolling is correct
    await updateTripSharing(tripId, stats);

    res.json({
      success: true,
      message: 'Trip stats and sharing recalculated successfully',
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
 * POST /trips/:id/rolling-records
 * Admin function to add rolling record to a trip
 */
router.post('/:id/rolling-records', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tripId = req.params.id;
    console.log('🎯 Rolling record request received:', { tripId, body: req.body });
    
    const {
      customer_id,
      staff_id,
      game_type,
      rolling_amount,
      venue,
      attachment_id,
      updated_at,
      commission_rate = 0.014  // Default 1.4% commission rate
    } = req.body;

    // Validate required fields
    if (!customer_id || !staff_id || !game_type || !rolling_amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_id', 'staff_id', 'game_type', 'rolling_amount']
      });
    }

    // Verify customer is in the trip
    const { data: tripCustomer, error: customerError } = await supabase
      .from('trip_customers')
      .select('id')
      .eq('trip_id', tripId)
      .eq('customer_id', customer_id)
      .single();

    if (customerError || !tripCustomer) {
      return res.status(400).json({
        error: 'Customer not found in this trip'
      });
    }

    // Create rolling record with commission rate
    const { data: rollingRecord, error: rollingError } = await supabase
      .from('trip_rolling')
      .insert({
        trip_id: tripId,
        customer_id: customer_id,
        staff_id: staff_id,
        game_type: game_type,
        rolling_amount: parseFloat(rolling_amount),
        venue: venue || null,
        attachment_id: attachment_id || null,
        commission_rate: parseFloat(commission_rate) || 0.014,
        created_at: new Date().toISOString(),
        updated_at: updated_at || new Date().toISOString() // Use provided updated_at or current time as fallback
      })
      .select()
      .single();

    if (rollingError) {
      console.error('❌ Rolling record creation error:', rollingError);
      return res.status(500).json({
        error: 'Failed to create rolling record',
        details: rollingError.message
      });
    }

    // Update customer trip stats to include rolling amount
    await updateCustomerTripStats(tripId, customer_id);

    // Update trip statistics
    await updateTripStats(tripId);

    res.status(201).json({
      success: true,
      message: 'Rolling record added successfully',
      data: rollingRecord
    });

  } catch (error) {
    console.error('❌ Rolling record endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Export helper functions for use in other modules
export { 
  updateCustomerTripStats, 
  updateTripStats, 
  updateTripSharing, 
  updateCustomerTotalWinLoss,
  updateCustomerTotalBuyInOut,
  updateCustomerTotalRolling,
  synchronizeCustomerData
};

/**
 * POST /trips/:id/sync-customer-data
 * Manually trigger comprehensive customer data synchronization for a trip
 */
router.post('/:id/sync-customer-data', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const tripId = req.params.id;
    
    console.log(`🔄 Manual customer data synchronization triggered for trip: ${tripId}`);
    
    // Get all customers in this trip
    const { data: tripCustomers, error } = await supabase
      .from('trip_customers')
      .select('customer_id')
      .eq('trip_id', tripId);
      
    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch trip customers',
        details: error.message
      });
    }
    
    if (!tripCustomers || tripCustomers.length === 0) {
      return res.json({
        success: true,
        message: 'No customers found in trip',
        synchronized_customers: 0
      });
    }
    
    // Synchronize data for each customer
    const results = [];
    for (const tc of tripCustomers) {
      try {
        // Update customer trip stats (includes rolling amounts)
        await updateCustomerTripStats(tripId, tc.customer_id);
        
        // Comprehensive customer data sync
        await synchronizeCustomerData(tc.customer_id);
        
        results.push({
          customer_id: tc.customer_id,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error synchronizing customer ${tc.customer_id}:`, error);
        results.push({
          customer_id: tc.customer_id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Update trip-level statistics
    const tripStats = await updateTripStats(tripId);
    await updateTripSharing(tripId, tripStats);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    res.json({
      success: true,
      message: `Customer data synchronization completed for trip ${tripId}`,
      synchronized_customers: successCount,
      failed_customers: errorCount,
      details: results
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error during customer data synchronization',
      details: error.message
    });
  }
});

/**
 * POST /trips/recalculate-agent-statistics
 * Recalculate statistics for all agents
 */
router.post('/recalculate-agent-statistics', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting recalculation of all agent statistics...');
    
    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name');
    
    if (agentsError) {
      return res.status(500).json({
        error: 'Failed to fetch agents',
        details: agentsError.message
      });
    }
    
    const results = [];
    
    // Recalculate statistics for each agent
    for (const agent of agents) {
      try {
        await recalculateAgentStatistics(agent.id);
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          status: 'success'
        });
        console.log(`✅ Recalculated statistics for agent: ${agent.name}`);
      } catch (error) {
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          status: 'error',
          error: error.message
        });
        console.error(`❌ Failed to recalculate statistics for agent ${agent.name}:`, error);
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    res.json({
      success: true,
      message: `Agent statistics recalculation completed`,
      total_agents: agents.length,
      successful_recalculations: successCount,
      failed_recalculations: errorCount,
      details: results
    });
    
  } catch (error) {
    console.error('Error in recalculate-agent-statistics:', error);
    res.status(500).json({
      error: 'Internal server error during agent statistics recalculation',
      details: error.message
    });
  }
});

/**
 * GET /trips/:id/customers/:customerId/photos
 * Get customer photos (transaction and rolling photos) for a specific trip
 */
router.get('/:id/customers/:customerId/photos', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId, customerId } = req.params;

    console.log('🔍 Loading customer photos for:', { tripId, customerId });

    // Get customer photos from customer_photos table
    const { data: photos, error } = await supabase
      .from('customer_photos')
      .select(`
        id,
        photo_type,
        photo,
        uploaded_by,
        upload_date,
        transaction_date,
        status,
        trip_id,
        customer_id
      `)
      .eq('trip_id', tripId)
      .eq('customer_id', customerId)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching customer photos:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch customer photos',
        details: error.message
      });
    }

    // Transform the data for frontend consumption
    const transformedPhotos = (photos || []).map(photo => {
      const photoData = photo.photo || {};
      return {
        id: photo.id,
        file_name: photoData.filename || photoData.name || 'Unknown',
        file_type: photoData.type || 'image/jpeg',
        file_size: photoData.size || 0,
        file_data: photoData.data || photoData.file_data,
        type: photo.photo_type, // 'transaction' or 'rolling'
        amount: photoData.amount || 0,
        venue: photoData.venue || '',
        uploaded_at: photo.upload_date,
        uploaded_by: photo.uploaded_by,
        transaction_date: photo.transaction_date,
        status: photo.status
      };
    });

    console.log('📸 Customer photos loaded successfully:', {
      tripId,
      customerId,
      photoCount: transformedPhotos.length
    });

    res.json({
      success: true,
      data: transformedPhotos
    });

  } catch (error) {
    console.error('Error in get customer photos:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching customer photos',
      details: error.message
    });
  }
});

/**
 * GET /trips/:id/agent-summary
 * Get detailed agent profit sharing summary for a specific trip
 */
router.get('/:id/agent-summary', authenticateToken, canAccessTrip, async (req, res) => {
  try {
    const { id: tripId } = req.params;
    
    console.log('📊 Loading agent summary for trip:', tripId);
    
    // Get trip agent summary data
    const { data: agentSummaries, error: summaryError } = await supabase
      .from('trip_agent_summary')
      .select(`
        *,
        agents!fk_trip_agent_summary_agent (
          id,
          name,
          commission_rate
        )
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    
    if (summaryError) {
      console.error('Error fetching agent summaries:', summaryError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch agent summaries',
        details: summaryError.message
      });
    }
    
    // Get agent-customer relationships for additional context
    const { data: agentCustomers, error: acError } = await supabase
      .from('trip_agent_customers')
      .select(`
        agent_id,
        customer_id,
        profit_sharing_rate,
        customers!fk_trip_agent_customers_customer (
          id,
          name
        )
      `)
      .eq('trip_id', tripId);
    
    if (acError) {
      console.error('Error fetching agent-customer relationships:', acError);
    }

    // Get customer statistics to include net_result
    const { data: customerStats, error: customerStatsError } = await supabase
      .from('trip_customer_stats')
      .select('customer_id, net_result')
      .eq('trip_id', tripId);
    
    if (customerStatsError) {
      console.error('Error fetching customer stats:', customerStatsError);
    }
    
    // Enrich agent summaries with customer details
    const enrichedSummaries = agentSummaries.map(summary => {
      const agentCustomerRelations = agentCustomers?.filter(ac => 
        ac.agent_id === summary.agent_id
      ) || [];
      
      return {
        ...summary,
        agent_name: summary.agents?.name || 'Unknown Agent',
        agent_commission_rate: summary.agents?.commission_rate || 0,
        customers: agentCustomerRelations.map(ac => {
          const customerStat = customerStats?.find(cs => cs.customer_id === ac.customer_id);
          return {
            customer_id: ac.customer_id,
            customer_name: ac.customers?.name || 'Unknown Customer',
            profit_sharing_rate: ac.profit_sharing_rate,
            net_result: customerStat?.net_result || 0
          };
        }),
        customer_count: agentCustomerRelations.length
      };
    });
    
    console.log(`✅ Found ${enrichedSummaries.length} agent summaries for trip ${tripId}`);
    
    res.json({
      success: true,
      data: enrichedSummaries,
      trip_id: tripId,
      total_agents: enrichedSummaries.length
    });
    
  } catch (error) {
    console.error('Error in get agent summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching agent summary',
      details: error.message
    });
  }
});

export default router;
//# sourceMappingURL=trips.js.map