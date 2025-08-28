import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware, requireAdmin } from './auth.js';
const router = Router();
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// AGENTS API ENDPOINTS
// =====================================================
/**
 * GET /agents
 * All roles can view agents
 */
router.get('/', authMiddleware, async (req, res) => {
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
        res.json({
            success: true,
            data: agents,
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
 * GET /agents/:id
 * All roles can view specific agent
 */
router.get('/:id', authMiddleware, async (req, res) => {
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
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, commission_rate, status } = req.body;
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
        if (existingAgent) {
            return res.status(409).json({
                success: false,
                message: 'Agent with this email already exists'
            });
        }
        // Create new agent
        const { data: agent, error } = await supabase
            .from('agents')
            .insert({
            name,
            email,
            phone,
            commission_rate: commission_rate || 0,
            status: status || 'active',
            created_by: req.user.id
        })
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create agent',
                error: error.message
            });
        }
        res.status(201).json({
            success: true,
            message: 'Agent created successfully',
            data: agent
        });
    }
    catch (error) {
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
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
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
        // Update agent
        const { data: agent, error } = await supabase
            .from('agents')
            .update({
            ...updateData,
            updated_at: new Date().toISOString()
        })
            .eq('id', agentId)
            .select()
            .single();
        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update agent',
                error: error.message
            });
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
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
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
router.get('/:id/trips', authMiddleware, async (req, res) => {
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
router.put('/:id/commission', authMiddleware, requireAdmin, async (req, res) => {
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
export default router;
//# sourceMappingURL=agents.js.map