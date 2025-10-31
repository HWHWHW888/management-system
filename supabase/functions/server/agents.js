import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';
import pkg from 'pg';
const { Pool } = pkg;

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

console.log('Supabase client initialized with:', {
    url: process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});
// =====================================================
// AGENTS API ENDPOINTS
// =====================================================
/**
 * GET /agents
 * All roles can view agents
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { data: agents, error } = await supabase
            .from('agents')
            .select(`
          id,
          name,
          email,
          phone,
          commission_rate,
          status,
          total_commission,
          total_trips,
          parent_agent_id,
          created_at,
          updated_at
        `)
            .order('name');
            
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch agents',
                error: error.message
            });
        }

        // Manually fetch parent and child agent information for each agent
        const agentsWithRelations = await Promise.all(agents.map(async (agent) => {
            let parentAgent = null;
            let childAgents = [];
            
            // Fetch parent agent if exists
            if (agent.parent_agent_id) {
                const { data: parent, error: parentError } = await supabase
                    .from('agents')
                    .select('id, name, email')
                    .eq('id', agent.parent_agent_id)
                    .single();
                
                if (!parentError && parent) {
                    parentAgent = parent;
                }
            }
            
            // Fetch child agents
            const { data: children, error: childrenError } = await supabase
                .from('agents')
                .select('id, name, email, status')
                .eq('parent_agent_id', agent.id);
            
            if (!childrenError && children) {
                childAgents = children;
            }
            
            return {
                ...agent,
                parent_agent: parentAgent ? [parentAgent] : [],
                child_agents: childAgents
            };
        }));
        
        res.json({
            success: true,
            data: agentsWithRelations,
            total: agents?.length || 0
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * GET /agents/hierarchy
 * Get complete agent hierarchy tree
 */
router.get('/hierarchy', authenticateToken, async (req, res) => {
    try {
        // Get all agents with their parent information
        const { data: agents, error } = await supabase
            .from('agents')
            .select(`
                id,
                name,
                email,
                phone,
                commission_rate,
                status,
                total_commission,
                total_trips,
                parent_agent_id,
                created_at
            `)
            .order('name');
            
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch agents hierarchy',
                error: error.message
            });
        }
        
        // Build hierarchy tree
        const agentMap = new Map();
        const rootAgents = [];
        
        // First pass: create agent objects with children array
        agents.forEach(agent => {
            agentMap.set(agent.id, { ...agent, children: [] });
        });
        
        // Second pass: build parent-child relationships
        agents.forEach(agent => {
            if (agent.parent_agent_id) {
                const parent = agentMap.get(agent.parent_agent_id);
                if (parent) {
                    parent.children.push(agentMap.get(agent.id));
                }
            } else {
                rootAgents.push(agentMap.get(agent.id));
            }
        });
        
        res.json({
            success: true,
            data: {
                hierarchy: rootAgents,
                total_agents: agents.length
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agents hierarchy',
            error: error.message
        });
    }
});

/**
 * GET /agents/:id
 * All roles can view specific agent
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { data: agent, error } = await supabase
            .from('agents')
            .select(`
          id,
          name,
          email,
          phone,
          commission_rate,
          status,
          total_commission,
          total_trips,
          parent_agent_id,
          parent_agent:agents!parent_agent_id(
            id,
            name,
            email
          ),
          child_agents:agents!parent_agent_id(
            id,
            name,
            email,
            status
          ),
          created_at,
          updated_at,
          trips:trip_agents(
            trip:trips(
              id,
              trip_name,
              destination,
              start_date,
              end_date,
              status
            )
          )
        `)
            .eq('id', agentId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent not found'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch agent',
                error: error.message
            });
        }
        res.json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
/**
 * POST /agents
 * Only admin can create agents
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, commission_rate, status, parent_agent_id } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }

        // Check if agent with email already exists
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('email', email)
            .single();

        // If there's an error other than "not found", return error
        if (checkError && checkError.code !== 'PGRST116') {
            return res.status(500).json({
                success: false,
                message: 'Error checking existing agent',
                error: checkError.message
            });
        }

        // If agent exists (no error and data found)
        if (existingAgent) {
            return res.status(409).json({
                success: false,
                message: 'Agent with this email already exists'
            });
        }

        // Validate parent_agent_id if provided
        if (parent_agent_id) {
            const { data: parentAgent, error: parentError } = await supabase
                .from('agents')
                .select('id')
                .eq('id', parent_agent_id)
                .single();
            
            if (parentError || !parentAgent) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parent agent ID'
                });
            }
        }

        // Create new agent
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .insert({
                name,
                email,
                phone,
                commission_rate: commission_rate || 0,
                status: status || 'active',
                parent_agent_id,
                created_by: req.user.id
            })
            .select()
            .single();

if (agentError || !agent) {
  return res.status(500).json({
      success: false,
      message: 'Failed to create agent',
      error: agentError?.message || 'No agent returned'
  });
}

// ✅ After creating agent, also create corresponding customer
const { data: customer, error: customerError } = await supabase
  .from('customers')
  .insert({
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      agent_id: agent.id,   // 自己就是自己的 agent
      status: 'active',
      vip_level: 'Silver',   // 默认 VIP 级别
      rolling_percentage: 0  // 必需字段
  })
  .select()
  .single();

if (customerError) {
  console.error('Customer insert error:', customerError);
  return res.status(500).json({
    success: false,
    message: 'Failed to create customer 3',
    error: customerError.message,
    details: customerError.details,
    hint: customerError.hint,
    code: customerError.code
  });
}

        res.status(201).json({
            success: true,
            message: 'Agent (and corresponding customer) created successfully',
            data: agent
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create agent',
            error: error.message
        });
    }
});

/**
 * PUT /agents/:id
 * Only admin can update agents
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        const updateData = req.body;
        // Remove fields that shouldn't be updated
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.created_by;
        // Check if agent exists
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .single();
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Check if email is already taken by another agent
        if (updateData.email) {
            const { data: emailCheck, error: emailError } = await supabase
                .from('agents')
                .select('id')
                .eq('email', updateData.email)
                .neq('id', agentId)
                .single();
            if (emailCheck) {
                return res.status(409).json({
                    success: false,
                    message: 'Email is already taken by another agent'
                });
            }
        }
        // Validate parent_agent_id if being updated
        if (updateData.parent_agent_id) {
            // Check if parent agent exists
            const { data: parentAgent, error: parentError } = await supabase
                .from('agents')
                .select('id')
                .eq('id', updateData.parent_agent_id)
                .single();
            
            if (parentError || !parentAgent) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parent agent ID'
                });
            }
            
            // Prevent circular reference (agent cannot be its own parent or descendant)
            if (updateData.parent_agent_id === agentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Agent cannot be its own parent'
                });
            }
        }

        // Update agent
        const { data: agent, error } = await supabase
            .from('agents')
            .update(updateData)
            .eq('id', agentId)
            .select()
            .single();
        
        console.log('Agent update attempt:', { agentId, updateData });
        console.log('Agent update result:', { agent, error });
        
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update agent',
                error: error.message
            });
        }
        // Debug: Check agent fields for customer sync
        console.log('🔍 Agent sync check:', {
            isCustomer: agent.is_customer,
            customerId: agent.customer_id,
            allFields: Object.keys(agent)
        });

        // Sync with customer table if this agent is also a customer
        // Check multiple possible field names for compatibility
        const isAgentCustomer = agent.is_customer || agent.isCustomer;
        const customerId = agent.customer_id || agent.customerId;
        
        if (isAgentCustomer && customerId) {
            try {
                console.log('🔄 Syncing agent update to customer:', customerId);
                
                const syncResult = await supabase
                    .from('customers')
                    .update({
                        name: updateData.name,
                        email: updateData.email,
                        phone: updateData.phone
                    })
                    .eq('id', customerId);
                
                console.log('✅ Synced agent update to customer table:', syncResult);
            } catch (syncError) {
                console.error('⚠️ Failed to sync agent update to customer:', syncError);
            }
        } else {
            console.log('🔍 No customer sync needed - not a customer or no customer ID');
        }

        res.json({
            success: true,
            message: 'Agent updated successfully',
            data: agent
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update agent',
            error: error.message
        });
    }
});
/**
 * DELETE /agents/:id
 * Only admin can delete agents
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        // Check if agent exists
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .single();
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Check if agent has associated trips
        const { data: trips, error: tripsError } = await supabase
            .from('trip_agents')
            .select('id')
            .eq('agent_id', agentId)
            .limit(1);
        if (trips && trips.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete agent with associated trips'
            });
        }
        // First, update any customers that were promoted from this agent
        // Reset their is_agent and source_agent_id fields
        const { error: customerUpdateError } = await supabase
            .from('customers')
            .update({
                is_agent: false,
                source_agent_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('source_agent_id', agentId);

        if (customerUpdateError) {
            console.error('Error updating customers when deleting agent:', customerUpdateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to update related customers',
                error: customerUpdateError.message
            });
        }

        // Delete agent
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('id', agentId);
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete agent',
                error: error.message
            });
        }
        res.json({
            success: true,
            message: 'Agent deleted successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete agent',
            error: error.message
        });
    }
});
/**
 * GET /agents/:id/trips
 * Get all trips for a specific agent
 */
router.get('/:id/trips', authenticateToken, async (req, res) => {
    try {
        const agentId = req.params.id;
        // Check if agent exists
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name')
            .eq('id', agentId)
            .single();
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Get agent's trips
        const { data: trips, error } = await supabase
            .from('trip_agents')
            .select(`
          trip:trips(
            id,
            trip_name,
            destination,
            start_date,
            end_date,
            status,
            total_budget
          ),
          commission_rate,
          status
        `)
            .eq('agent_id', agentId)
            .order('trip.start_date', { ascending: false });
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch agent trips',
                error: error.message
            });
        }
        res.json({
            success: true,
            data: {
                agent,
                trips
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agent trips',
            error: error.message
        });
    }
});
/**
 * PUT /agents/:id/commission
 * Update agent's commission rate (Admin only)
 */
router.put('/:id/commission', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { commission_rate } = req.body;
        if (commission_rate === undefined || commission_rate < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid commission rate is required'
            });
        }
        // Check if agent exists
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .single();
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Update commission rate
        const { data: agent, error } = await supabase
            .from('agents')
            .update({
            commission_rate,
            updated_at: new Date().toISOString()
        })
            .eq('id', agentId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update commission rate',
                error: error.message
            });
        }
        res.json({
            success: true,
            message: 'Commission rate updated successfully',
            data: agent
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update commission rate',
            error: error.message
        });
    }
});

/**
 * GET /agents/:id/children
 * Get all child agents for a specific agent
 */
router.get('/:id/children', authenticateToken, async (req, res) => {
    try {
        const agentId = req.params.id;
        
        // Check if agent exists
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name')
            .eq('id', agentId)
            .single();
            
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        
        // Get child agents
        const { data: children, error } = await supabase
            .from('agents')
            .select(`
                id,
                name,
                email,
                phone,
                commission_rate,
                status,
                total_commission,
                total_trips,
                created_at
            `)
            .eq('parent_agent_id', agentId)
            .order('name');
            
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch child agents',
                error: error.message
            });
        }
        
        res.json({
            success: true,
            data: {
                parent: agent,
                children: children || []
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch child agents',
            error: error.message
        });
    }
});

/**
 * PUT /agents/:id/parent
 * Update agent's parent (Admin only)
 */
router.put('/:id/parent', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { parent_agent_id } = req.body;
        
        // Check if agent exists
        const { data: existingAgent, error: checkError } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .single();
            
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        
        // Validate parent_agent_id if provided
        if (parent_agent_id) {
            // Check if parent agent exists
            const { data: parentAgent, error: parentError } = await supabase
                .from('agents')
                .select('id')
                .eq('id', parent_agent_id)
                .single();
                
            if (parentError || !parentAgent) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parent agent ID'
                });
            }
            
            // Prevent circular reference
            if (parent_agent_id === agentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Agent cannot be its own parent'
                });
            }
        }
        
        // Update parent
        const { data: agent, error } = await supabase
            .from('agents')
            .update({
                parent_agent_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', agentId)
            .select(`
                id,
                name,
                email,
                parent_agent_id,
                parent_agent:agents!parent_agent_id(
                    id,
                    name,
                    email
                )
            `)
            .single();
            
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update agent parent',
                error: error.message
            });
        }
        
        res.json({
            success: true,
            message: 'Agent parent updated successfully',
            data: agent
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update agent parent',
            error: error.message
        });
    }
});

// Debug endpoint to check table structure using Supabase
router.get('/debug/tables', authenticateToken, async (req, res) => {
    try {
        // Try to get customers table info via Supabase
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .limit(1);
            
        // Try to get agents table info for comparison
        const { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('*')
            .limit(1);
            
        // Check what tables exist by trying to select from them
        const tableChecks = {
            customers: {
                exists: !customersError,
                error: customersError?.message || null,
                sample_data: customers || null
            },
            agents: {
                exists: !agentsError,
                error: agentsError?.message || null,
                sample_data: agents || null
            }
        };
        
        res.json({
            success: true,
            data: {
                table_checks: tableChecks,
                supabase_url: process.env.SUPABASE_URL,
                has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
            }
        });
        
    } catch (error) {
        console.error('Debug query error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.detail || null
        });
    }
});

export default router;
//# sourceMappingURL=agents.js.map