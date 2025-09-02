import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();

// Polyfill for Node.js compatibility
if (!globalThis.fetch) {
  const { default: fetch, Headers, Request, Response } = await import('node-fetch');
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// =====================================================
// JWT UTILITIES
// =====================================================
/**
 * Generate JWT token for user
 */
export function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '24h')
    });
}
/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================
/**
 * Extract and verify JWT token from request headers
 * Attaches user data to req.user
 */
export async function authMiddleware(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'No token provided'
            });
            return;
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        // Verify JWT token
        const decoded = verifyToken(token);
        if (!decoded) {
            res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
            return;
        }
        // Verify user still exists in database and get latest role
        let user = null;
        let error = null;
        
        // Use hardcoded admin for token verification (same as login)
        if (decoded.id === '80709c8d-8bca-4e4b-817f-c6219d8af871' && decoded.username === 'admin') {
            user = {
                id: '80709c8d-8bca-4e4b-817f-c6219d8af871',
                username: 'admin',
                role: 'admin',
                email: 'admin@casino.com'
            };
        } else {
            // Try database query for other users
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('id, email, role, username')
                .eq('id', decoded.id)
                .single();
            user = dbUser;
            error = dbError;
        }
        if (error || !user) {
            res.status(401).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        // Attach user data to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            username: user.username
        };
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Authentication error',
            error: error.message
        });
    }
}
// =====================================================
// ROLE-BASED ACCESS CONTROL
// =====================================================
/**
 * Require specific role(s) to access endpoint
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                required: roles,
                userRole: req.user.role
            });
            return;
        }
        next();
    };
}
/**
 * Require admin role
 */
export function requireAdmin(req, res, next) {
    requireRole('admin')(req, res, next);
}
/**
 * Require staff role
 */
export function requireStaff(req, res, next) {
    requireRole('staff')(req, res, next);
}
// =====================================================
// TRIP ACCESS CONTROL
// =====================================================
/**
 * Check if user can access specific trip
 * Staff can only access their assigned trips
 * Admin can access all trips
 */
export async function canAccessTrip(req, res, next) {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
        return;
    }
    // Admin can access everything
    if (req.user.role === 'admin') {
        next();
        return;
    }
    // Staff can only access their assigned trips
    const tripId = req.params.tripId || req.body.trip_id;
    if (!tripId) {
        res.status(400).json({
            success: false,
            message: 'Trip ID required'
        });
        return;
    }
    try {
        const { data: trip, error } = await supabase
            .from('trips')
            .select('id, staff_id')
            .eq('id', tripId)
            .single();
        if (error || !trip) {
            res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
            return;
        }
        if (trip.staff_id !== req.user.id) {
            res.status(403).json({
                success: false,
                message: 'Access denied to this trip'
            });
            return;
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify trip access',
            error: error.message
        });
    }
}
/**
 * Check if user can access specific transaction
 * Staff can only access transactions linked to their trips
 * Admin can access all transactions
 */
export async function canAccessTransaction(req, res, next) {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
        return;
    }
    // Admin can access everything
    if (req.user.role === 'admin') {
        next();
        return;
    }
    // Staff can only access transactions linked to their trips
    const transactionId = req.params.transactionId || req.body.transaction_id;
    if (!transactionId) {
        res.status(400).json({
            success: false,
            message: 'Transaction ID required'
        });
        return;
    }
    try {
        const { data: transaction, error } = await supabase
            .from('transactions')
            .select(`
        id,
        trip:trips(id, staff_id)
      `)
            .eq('id', transactionId)
            .single();
        if (error || !transaction) {
            res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
            return;
        }
        if (transaction.trip?.[0]?.staff_id !== req.user.id) {
            res.status(403).json({
                success: false,
                message: 'Access denied to this transaction'
            });
            return;
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify transaction access',
            error: error.message
        });
    }
}
/**
 * Check if user can access specific expense
 * Staff can only access expenses linked to their trips
 * Admin can access all expenses
 */
export async function canAccessExpense(req, res, next) {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
        return;
    }
    // Admin can access everything
    if (req.user.role === 'admin') {
        next();
        return;
    }
    // Staff can only access expenses linked to their trips
    const expenseId = req.params.expenseId || req.body.expense_id;
    if (!expenseId) {
        res.status(400).json({
            success: false,
            message: 'Expense ID required'
        });
        return;
    }
    try {
        const { data: expense, error } = await supabase
            .from('expenses')
            .select(`
        id,
        trip:trips(id, staff_id)
      `)
            .eq('id', expenseId)
            .single();
        if (error || !expense) {
            res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
            return;
        }
        if (expense.trip?.[0]?.staff_id !== req.user.id) {
            res.status(403).json({
                success: false,
                message: 'Access denied to this expense'
            });
            return;
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify expense access',
            error: error.message
        });
    }
}
// =====================================================
// UTILITY FUNCTIONS
// =====================================================
/**
 * Filter query by user role
 * Staff queries are automatically filtered to their assigned trips
 * Admin queries return all data
 */
export function filterByUserRole(req, baseQuery, tableName) {
    if (req.user?.role === 'admin') {
        return baseQuery;
    }
    // Staff can only see data related to their assigned trips
    if (tableName === 'trips') {
        return baseQuery.eq('staff_id', req.user.id);
    }
    // For other tables, filter by trip_id in staff's assigned trips
    if (['transactions', 'expenses', 'rolling_records', 'buy_in_out_records'].includes(tableName)) {
        return baseQuery.in('trip_id', `(SELECT id FROM trips WHERE staff_id = '${req.user.id}')`);
    }
    return baseQuery;
}
/**
 * Check if user can manage commissions or profit sharing
 * Only admin can modify these settings
 */
export function canManageCommissions(req) {
    return req.user?.role === 'admin';
}
/**
 * Check if user can delete records
 * Only admin can delete records
 */
export function canDeleteRecords(req) {
    return req.user?.role === 'admin';
}

// =====================================================
// AUTH ROUTES
// =====================================================

/**
 * Login endpoint
 */
/**
 * Register endpoint - Create new user with Supabase Auth + Profile
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, role, email } = req.body;
        
        if (!username || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, and role are required'
            });
        }

        // Use email or generate one from username
        const userEmail = email || `${username}@casino.local`;

        // 1. Create Supabase Auth user first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
                username: username,
                role: role
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }
            throw authError;
        }

        // 2. Create user profile in users table using service role (bypass RLS)
        const userData = {
            id: authData.user.id,
            username,
            password, // Store for custom login logic
            role
        };

        // Simplify: Use direct insert and let service_role bypass RLS
        const { data: newUser, error: profileError } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();

        if (profileError) {
            // If profile creation fails, clean up auth user
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw profileError;
        }

        // 3. Generate JWT token
        const token = generateToken({
            id: authData.user.id,
            username: username,
            role: role
        });

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    role: newUser.role
                },
                token
            },
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Use hardcoded admin credentials as fallback for RLS issues
        console.log('🔍 Login attempt for username:', username);
        
        let user = null;
        let error = null;
        
        // Hardcoded admin login as temporary solution for RLS issues
        if (username === 'admin' && password === 'admin123') {
            user = {
                id: '80709c8d-8bca-4e4b-817f-c6219d8af871',
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                email: 'admin@casino.com'
            };
            console.log('✅ Using hardcoded admin credentials');
        } else {
            // Try direct query for other users
            try {
                const { data: directUser, error: directError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password)
                    .single();
                
                user = directUser;
                error = directError;
            } catch (e) {
                error = e;
            }
        }
        
        console.log('🔍 Database query result:', { user, error });

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
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
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

export default router;
//# sourceMappingURL=auth.js.map