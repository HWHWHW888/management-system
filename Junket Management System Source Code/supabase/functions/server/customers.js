import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';
const router = Router();
// Initialize Supabase client with service role key
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
// =====================================================
// CUSTOMERS API ENDPOINTS
// =====================================================
/**
 * GET /customers
 * All roles can view customers
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone,
          agent_id,
          agent_name,
          total_rolling,
          total_win_loss,
          total_buy_in,
          total_buy_out,
          credit_limit,
          available_credit,
          rolling_percentage,
          is_agent,
          source_agent_id,
          total_spent,
          status,
          vip_level,
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  });
  
  /**
   * GET /customers/:id
   */
  router.get('/:id', authenticateToken, async (req, res) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone,
          agent_id,
          agent_name,
          total_rolling,
          total_win_loss,
          total_buy_in,
          total_buy_out,
          credit_limit,
          available_credit,
          rolling_percentage,
          is_agent,
          source_agent_id,
          total_spent,
          status,
          vip_level,
          created_at,
          updated_at
        `)
        .eq('id', req.params.id)
        .single();
  
      if (error) {
        return res.status(404).json({ error: 'Customer not found' });
      }
  
      res.json({ success: true, data: customer });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
  
  /**
   * POST /customers
   * Only admin can create
   */
  router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { name, email, phone, status, vip_level, agent_id, ...rest } = req.body;
  
      if (!name || !email) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'email']
        });
      }
  
      // Check duplicate email
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .single();
  
      if (existingCustomer) {
        return res.status(409).json({ error: 'Customer with this email already exists' });
      }

      if (!agent_id) {
        return res.status(400).json({
          error: 'Customer must be linked to an agent',
          required: ['agent_id']
        });
      }
  
      const { data: customer, error } = await supabase
        .from('customers')
        .insert({
          name,
          email,
          phone: phone || null,
          agent_id,
          status: status || 'active',
          vip_level: vip_level || 'Silver',
          rolling_percentage: 0
        })
        .select()
        .single();
  
      if (error) {
        return res.status(500).json({ error: 'Failed to create customer', details: error.message });
      }
  
      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
  
  /**
   * PUT /customers/:id
   * Only admin can update
   */
  router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const customerId = req.params.id;
      const updateData = req.body;
  
      // Ensure vip_level is valid
      if (updateData.vip_level && !['Silver', 'Gold', 'Platinum'].includes(updateData.vip_level)) {
        return res.status(400).json({
          error: 'Invalid vip_level. Must be Silver, Gold, or Platinum.'
        });
      }
  
      // Update customer
      const { data: updatedCustomer, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ 
          error: 'Failed to update customer', 
          details: error.message 
        });
      }

      // Debug: Check customer fields for agent sync
      console.log('🔍 Customer sync check:', {
        isAgent: updatedCustomer.is_agent,
        sourceAgentId: updatedCustomer.source_agent_id,
        agentId: updatedCustomer.agent_id,
        allFields: Object.keys(updatedCustomer)
      });

      // Sync with agent table if this customer is also an agent
      // Check multiple possible field names for compatibility
      const isCustomerAgent = updatedCustomer.is_agent || updatedCustomer.isAgent;
      const agentId = updatedCustomer.source_agent_id || updatedCustomer.sourceAgentId || updatedCustomer.agent_id;
      
      if (isCustomerAgent && agentId) {
        try {
          console.log('🔄 Syncing customer update to agent:', agentId);
          
          const syncResult = await supabase
            .from('agents')
            .update({
              name: updateData.name,
              email: updateData.email,
              phone: updateData.phone
            })
            .eq('id', agentId);
          
          console.log('✅ Synced customer update to agent table:', syncResult);
        } catch (syncError) {
          console.error('⚠️ Failed to sync customer update to agent:', syncError);
        }
      } else {
        console.log('🔍 No agent sync needed - not an agent or no agent ID');
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: updatedCustomer
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
  
  /**
   * DELETE /customers/:id
   * Only admin can delete customers
   * Comprehensive deletion that removes customer from all related tables
   */
  router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const customerId = req.params.id;
      
      console.log('🗑️ Backend - Starting customer deletion:', customerId);
      
      // Check if customer exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        return res.status(404).json({ 
          error: 'Customer not found' 
        });
      }

      console.log('🗑️ Backend - Deleting customer:', customer.name);

      // Start transaction-like deletion process
      // Delete from related tables first to maintain referential integrity
      
      // 1. Delete customer details
      const { error: detailsError } = await supabase
        .from('customer_details')
        .delete()
        .eq('customer_id', customerId);
      
      if (detailsError) {
        console.error('⚠️ Error deleting customer details:', detailsError);
      } else {
        console.log('✅ Deleted customer details');
      }

      // 2. Delete from trip_customer_stats
      const { error: statsError } = await supabase
        .from('trip_customer_stats')
        .delete()
        .eq('customer_id', customerId);
      
      if (statsError) {
        console.error('⚠️ Error deleting trip customer stats:', statsError);
      } else {
        console.log('✅ Deleted trip customer stats');
      }

      // 3. Delete from trip_customers
      const { error: tripCustomersError } = await supabase
        .from('trip_customers')
        .delete()
        .eq('customer_id', customerId);
      
      if (tripCustomersError) {
        console.error('⚠️ Error deleting trip customers:', tripCustomersError);
      } else {
        console.log('✅ Deleted trip customers');
      }

      // 4. Delete transactions
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('customer_id', customerId);
      
      if (transactionsError) {
        console.error('⚠️ Error deleting transactions:', transactionsError);
      } else {
        console.log('✅ Deleted transactions');
      }

      // 5. Delete rolling records
      const { error: rollingError } = await supabase
        .from('rolling_records')
        .delete()
        .eq('customer_id', customerId);
      
      if (rollingError) {
        console.error('⚠️ Error deleting rolling records:', rollingError);
      } else {
        console.log('✅ Deleted rolling records');
      }

      // 6. Delete buy-in/out records
      const { error: buyInOutError } = await supabase
        .from('buy_in_out_records')
        .delete()
        .eq('customer_id', customerId);
      
      if (buyInOutError) {
        console.error('⚠️ Error deleting buy-in/out records:', buyInOutError);
      } else {
        console.log('✅ Deleted buy-in/out records');
      }

      // 7. Finally, delete the customer record itself
      const { error: customerDeleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (customerDeleteError) {
        console.error('❌ Failed to delete customer:', customerDeleteError);
        return res.status(500).json({ 
          error: 'Failed to delete customer', 
          details: customerDeleteError.message 
        });
      }

      console.log('✅ Customer deleted successfully:', customer.name);

      res.json({
        success: true,
        message: `Customer "${customer.name}" deleted successfully`,
        data: { deletedCustomerId: customerId }
      });
    } catch (error) {
      console.error('❌ Error in customer deletion:', error);
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      });
    }
  });

  /**
   * GET /customers/vip/:level
   */
  router.get('/vip/:level', authenticateToken, async (req, res) => {
    try {
      const vipLevel = req.params.level;
      if (!['Silver', 'Gold', 'Platinum'].includes(vipLevel)) {
        return res.status(400).json({ error: 'Invalid VIP level' });
      }
  
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
        .order('created_at', { ascending: false });
  
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch VIP customers', details: error.message });
      }
  
      res.json({ success: true, data: customers, total: customers?.length || 0 });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

// =====================================================
// CUSTOMER DETAILS API ENDPOINTS
// =====================================================

/**
 * GET /customers/:id/details
 * Get customer details by customer ID
 */
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: customerDetails, error } = await supabase
      .from('customer_details')
      .select('*')
      .eq('customer_id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      return res.status(500).json({ 
        error: 'Failed to fetch customer details', 
        details: error.message 
      });
    }

    // Return empty details if none found
    if (!customerDetails) {
      return res.json({ 
        success: true, 
        data: null,
        message: 'No details found for this customer'
      });
    }

    res.json({ success: true, data: customerDetails });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

/**
 * POST /customers/:id/details
 * Create customer details for a customer
 */
router.post('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      passport_number,
      id_number,
      nationality,
      date_of_birth,
      address,
      occupation,
      hobby,
      gaming_preferences,
      emergency_contact,
      emergency_phone,
      marital_status,
      education_level,
      income_range,
      preferred_language,
      notes,
      special_requirements
    } = req.body;

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    // Check if details already exist
    const { data: existingDetails } = await supabase
      .from('customer_details')
      .select('id')
      .eq('customer_id', id)
      .single();

    if (existingDetails) {
      return res.status(409).json({ 
        error: 'Customer details already exist. Use PUT to update.' 
      });
    }

    const { data: customerDetails, error } = await supabase
      .from('customer_details')
      .insert({
        customer_id: id,
        passport_number: passport_number || null,
        id_number: id_number || null,
        nationality: nationality || null,
        date_of_birth: date_of_birth || null,
        address: address || null,
        occupation: occupation || null,
        hobby: hobby || null,
        gaming_preferences: gaming_preferences || null,
        emergency_contact: emergency_contact || null,
        emergency_phone: emergency_phone || null,
        marital_status: marital_status || null,
        education_level: education_level || null,
        income_range: income_range || null,
        preferred_language: preferred_language || 'English',
        notes: notes || null,
        special_requirements: special_requirements || null,
        created_by: req.user?.id || null
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ 
        error: 'Failed to create customer details', 
        details: error.message 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Customer details created successfully',
      data: customerDetails
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

/**
 * PUT /customers/:id/details
 * Update customer details for a customer
 */
router.put('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔍 Backend Debug: Log received data
    console.log('🔍 Backend - PUT /customers/:id/details');
    console.log('🔍 Backend - Customer ID:', id);
    console.log('🔍 Backend - req.body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Backend - req.user:', req.user);
    
    const {
      passport_number,
      id_number,
      nationality,
      date_of_birth,
      address,
      occupation,
      hobby,
      gaming_preferences,
      emergency_contact,
      emergency_phone,
      marital_status,
      education_level,
      income_range,
      preferred_language,
      notes,
      special_requirements
    } = req.body;

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    // Check if details exist, if not create them
    const { data: existingDetails } = await supabase
      .from('customer_details')
      .select('id')
      .eq('customer_id', id)
      .single();

    let customerDetails, error;

    if (existingDetails) {
      // Update existing details
      console.log('🔍 Backend - Updating existing details for customer:', id);
      const updateData = {
        passport_number: passport_number || null,
        id_number: id_number || null,
        nationality: nationality || null,
        date_of_birth: date_of_birth || null,
        address: address || null,
        occupation: occupation || null,
        hobby: hobby || null,
        gaming_preferences: gaming_preferences || null,
        emergency_contact: emergency_contact || null,
        emergency_phone: emergency_phone || null,
        marital_status: marital_status || null,
        education_level: education_level || null,
        income_range: income_range || null,
        preferred_language: preferred_language || 'English',
        notes: notes || null,
        special_requirements: special_requirements || null
      };
      console.log('🔍 Backend - Update data:', JSON.stringify(updateData, null, 2));
      
      const result = await supabase
        .from('customer_details')
        .update(updateData)
        .eq('customer_id', id)
        .select()
        .single();
      
      customerDetails = result.data;
      error = result.error;
      console.log('🔍 Backend - Update result:', { data: customerDetails, error });
    } else {
      // Create new details
      console.log('🔍 Backend - Creating new details for customer:', id);
      const insertData = {
        customer_id: id,
        passport_number: passport_number || null,
        id_number: id_number || null,
        nationality: nationality || null,
        date_of_birth: date_of_birth || null,
        address: address || null,
        occupation: occupation || null,
        hobby: hobby || null,
        gaming_preferences: gaming_preferences || null,
        emergency_contact: emergency_contact || null,
        emergency_phone: emergency_phone || null,
        marital_status: marital_status || null,
        education_level: education_level || null,
        income_range: income_range || null,
        preferred_language: preferred_language || 'English',
        notes: notes || null,
        special_requirements: special_requirements || null
      };
      console.log('🔍 Backend - Insert data:', JSON.stringify(insertData, null, 2));
      
      const result = await supabase
        .from('customer_details')
        .insert(insertData)
        .select()
        .single();
      
      customerDetails = result.data;
      error = result.error;
      console.log('🔍 Backend - Insert result:', { data: customerDetails, error });
    }

    if (error) {
      console.error('🔍 Backend - SQL/ORM Error:', error);
      console.error('🔍 Backend - Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: 'Failed to update customer details', 
        details: error.message,
        sqlError: error
      });
    }

    res.json({
      success: true,
      message: 'Customer details updated successfully',
      data: customerDetails
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

/**
 * DELETE /customers/:id/details
 * Delete customer details for a customer
 */
router.delete('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    const { error } = await supabase
      .from('customer_details')
      .delete()
      .eq('customer_id', id);

    if (error) {
      return res.status(500).json({ 
        error: 'Failed to delete customer details', 
        details: error.message 
      });
    }

    res.json({
      success: true,
      message: 'Customer details deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// File upload endpoints for customers
router.post('/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { attachments } = req.body;

    console.log('🔍 Backend - POST /customers/:id/attachments');
    console.log('🔍 Backend - Customer ID:', id);
    console.log('🔍 Backend - Attachments count:', attachments?.length || 0);

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if customer details exist
    const { data: existingDetails } = await supabase
      .from('customer_details')
      .select('attachments')
      .eq('customer_id', id)
      .single();

    let result, error;

    if (existingDetails) {
      // Update existing details with new attachments
      const existingAttachments = existingDetails.attachments || [];
      const updatedAttachments = [...existingAttachments, ...attachments];

      const updateResult = await supabase
        .from('customer_details')
        .update({ attachments: updatedAttachments })
        .eq('customer_id', id)
        .select()
        .single();

      result = updateResult;
      error = updateResult.error;
    } else {
      // Create new customer details with attachments
      const insertResult = await supabase
        .from('customer_details')
        .insert({
          customer_id: id,
          attachments: attachments,
          preferred_language: 'English'
        })
        .select()
        .single();

      result = insertResult;
      error = insertResult.error;
    }

    if (error) {
      console.error('🔍 Backend - SQL/ORM Error:', error);
      return res.status(500).json({
        error: 'Failed to upload attachments',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Attachments uploaded successfully',
      data: result.data
    });
  } catch (error) {
    console.error('🔍 Backend - Upload Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

router.get('/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Backend - GET /customers/:id/attachments');
    console.log('🔍 Backend - Customer ID:', id);

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get attachments from customer_details
    const { data: customerDetails, error } = await supabase
      .from('customer_details')
      .select('attachments')
      .eq('customer_id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('🔍 Backend - Get attachments error:', error);
      return res.status(500).json({
        error: 'Failed to get attachments',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: customerDetails?.attachments || []
    });
  } catch (error) {
    console.error('🔍 Backend - Get attachments error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

router.delete('/:id/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    console.log('🔍 Backend - DELETE /customers/:id/attachments/:attachmentId');
    console.log('🔍 Backend - Customer ID:', id);
    console.log('🔍 Backend - Attachment ID:', attachmentId);

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get current customer details attachments
    const { data: customerDetails, error: getError } = await supabase
      .from('customer_details')
      .select('attachments')
      .eq('customer_id', id)
      .single();

    if (getError && getError.code !== 'PGRST116') {
      console.error('🔍 Backend - Get customer details error:', getError);
      return res.status(500).json({
        error: 'Failed to get customer details',
        details: getError.message
      });
    }

    if (!customerDetails) {
      return res.status(404).json({ error: 'Customer details not found' });
    }

    // Remove the specific attachment
    const updatedAttachments = (customerDetails.attachments || []).filter(
      att => att.id !== attachmentId
    );

    // Update customer details
    const { data: updatedCustomerDetails, error } = await supabase
      .from('customer_details')
      .update({ attachments: updatedAttachments })
      .eq('customer_id', id)
      .select()
      .single();

    if (error) {
      console.error('🔍 Backend - Delete attachment error:', error);
      return res.status(500).json({
        error: 'Failed to delete attachment',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Attachment deleted successfully',
      data: updatedCustomerDetails
    });
  } catch (error) {
    console.error('🔍 Backend - Delete attachment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});
  
  export default router;