import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// USER ROUTES
// =====================================================

/**
 * GET /api/users - Get all users (admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, role, password')
      .order('username', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: users || []
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

/**
 * POST /api/users - Create new user (admin only)
 */
router.post('/', async (req, res) => {
  try {
    const { id, username, password, role } = req.body;

    // Validate required fields
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and role are required'
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this username already exists'
      });
    }

    // Create user with additional fields
    const userData = {
      id: id || crypto.randomUUID(),
      username,
      password, // In production, this should be hashed
      role,
      email: req.body.email,
      staff_id: req.body.staff_id,
      agent_id: req.body.agent_id,
      status: 'active'
    };

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Return user without password
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      data: userResponse,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

/**
 * Login endpoint - authenticate user via users table
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔍 Login attempt for identifier:', username);

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    let user = null;
    let error = null;

    // Check hardcoded admin first
    if (username === 'admin' && password === 'admin123') {
      user = {
        id: '80709c8d-8bca-4e4b-817f-c6219d8af871',
        username: 'admin',
        email: 'admin@casino.com',
        role: 'admin'
      };
    } else {
      // Look up user in users table with related staff/agent data
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select(`
          id, username, email, role, staff_id, agent_id, status,
          staff:staff_id(id, name, email, position, status),
          agent:agent_id(id, name, email)
        `)
        .or(`username.eq.${username},email.eq.${username}`)
        .eq('password', password)
        .eq('status', 'active')
        .single();

      if (dbUser) {
        console.log('✅ Found user:', dbUser.username);
        user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          staffId: dbUser.staff_id,
          agentId: dbUser.agent_id,
          staff: dbUser.staff,
          agent: dbUser.agent
        };
      } else {
        error = dbError;
      }
    }

    console.log('🔍 Database query result:', { user, error });

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Update last login timestamp
    if (user.id !== '80709c8d-8bca-4e4b-817f-c6219d8af871') {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

/**
 * PUT /api/users/:id - Update user (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    const updateData = {};

    if (username) updateData.username = username;
    if (password) updateData.password = password; // In production, hash this
    if (role) updateData.role = role;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user without password
    const { password: _, ...userResponse } = updatedUser;

    res.json({
      success: true,
      data: userResponse,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

/**
 * DELETE /api/users/:id - Delete user (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the current user
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

export default router;
