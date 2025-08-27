import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-86a1418e/health", (c) => {
  return c.json({ status: "ok" });
});

// Generic route handlers for casino data
const dataRoutes = [
  'users',
  'agents', 
  'customers',
  'transactions',
  'trips',
  'staff',
  'shifts',
  'chipExchanges',
  'gameTypes',
  'rollingRecords',
  'staffAccounts',
  'buyInOutRecords' // Added missing buy-in/buy-out records endpoint
];

// GET routes for all data types
dataRoutes.forEach(route => {
  app.get(`/make-server-86a1418e/${route}`, async (c) => {
    try {
      console.log(`Fetching ${route} data`);
      const data = await kv.get(`casino_${route}`);
      return c.json({ 
        data: data || [], 
        message: `${route} data retrieved successfully` 
      });
    } catch (error) {
      console.error(`Error fetching ${route}:`, error);
      return c.json(
        { error: `Failed to fetch ${route}`, details: error.message },
        500
      );
    }
  });

  // POST routes for all data types
  app.post(`/make-server-86a1418e/${route}`, async (c) => {
    try {
      const body = await c.req.json();
      const { data } = body;
      
      if (!data) {
        return c.json({ error: "Data field is required" }, 400);
      }

      console.log(`Saving ${route} data:`, data);
      await kv.set(`casino_${route}`, data);
      
      return c.json({ 
        message: `${route} data saved successfully`,
        data: data 
      });
    } catch (error) {
      console.error(`Error saving ${route}:`, error);
      return c.json(
        { error: `Failed to save ${route}`, details: error.message },
        500
      );
    }
  });
});

// UPDATED: Enhanced login endpoint that checks database users first
app.post("/make-server-86a1418e/login", async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ error: "Username and password are required" }, 400);
    }

    console.log(`🔐 Login attempt for username: ${username}`);

    let allUsers = [];

    // STEP 1: Check database users table for admin accounts (highest priority)
    try {
      const databaseUsers = await kv.get('casino_users') || [];
      console.log(`📊 Found ${databaseUsers.length} users in database`);
      
      // Add database users (especially admin accounts)
      allUsers.push(...databaseUsers.map(user => ({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        isActive: user.isActive !== false, // Default to true if not specified
        agentId: user.agentId,
        staffId: user.staffId
      })));
      
      console.log(`✅ Added ${databaseUsers.length} database users to login pool`);
    } catch (error) {
      console.warn(`⚠️ Could not load database users: ${error.message}`);
    }

    // STEP 2: Initialize default admin if no database users exist
    if (allUsers.length === 0) {
      console.log('🔧 No database users found, creating default admin account...');
      
      const defaultAdmin = {
        id: 'admin_001',
        username: 'admin',
        password: 'admin@8888',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy: 'system'
      };

      // Save default admin to database
      try {
        await kv.set('casino_users', [defaultAdmin]);
        allUsers.push(defaultAdmin);
        console.log('✅ Created and saved default admin account: admin/admin@8888');
      } catch (error) {
        console.error('❌ Failed to create default admin:', error);
      }
    }

    // STEP 3: Add legacy fallback users (agent accounts)
    const legacyUsers = [
      { id: 'agent-1', username: 'agent1', password: 'agent123', role: 'agent', agentId: 'agent-1' }
    ];
    allUsers.push(...legacyUsers);

    // STEP 4: Initialize and add staff accounts if needed
    await initializeStaffAccountsIfNeeded();
    
    // Get managed staff accounts
    const staffAccounts = await kv.get('casino_staffAccounts') || [];
    const activeStaffAccounts = staffAccounts.filter(account => account.isActive);
    
    // Add active staff accounts
    allUsers.push(...activeStaffAccounts.map(account => ({
      id: account.id,
      username: account.username,
      password: account.password,
      role: account.role,
      staffId: account.staffId
    })));

    console.log(`🔍 Total users available for login: ${allUsers.length}`);
    console.log(`🔍 Admin users: ${allUsers.filter(u => u.role === 'admin').length}`);
    console.log(`🔍 Agent users: ${allUsers.filter(u => u.role === 'agent').length}`);
    console.log(`🔍 Staff users: ${allUsers.filter(u => u.role === 'staff').length}`);

    // STEP 5: Find matching user
    const user = allUsers.find(u => {
      const usernameMatch = u.username === username;
      const passwordMatch = u.password === password;
      const isActiveUser = u.isActive !== false; // Default to true if not specified
      
      if (usernameMatch && !passwordMatch) {
        console.log(`⚠️ Username match but password mismatch for: ${username}`);
      }
      
      return usernameMatch && passwordMatch && isActiveUser;
    });

    if (!user) {
      console.log(`❌ No matching user found for: ${username}`);
      console.log(`🔍 Available usernames: ${allUsers.map(u => u.username).join(', ')}`);
      return c.json({ error: "Invalid credentials" }, 401);
    }

    console.log(`✅ Login successful for: ${user.username} (${user.role})`);

    // Update last login time for database users
    if (user.role === 'admin' || user.role === 'agent') {
      try {
        const databaseUsers = await kv.get('casino_users') || [];
        const updatedUsers = databaseUsers.map(dbUser =>
          dbUser.id === user.id
            ? { ...dbUser, lastLogin: new Date().toISOString() }
            : dbUser
        );
        await kv.set('casino_users', updatedUsers);
        console.log(`📅 Updated last login time for ${user.username}`);
      } catch (error) {
        console.warn('⚠️ Could not update last login time:', error);
      }
    }

    // Update last login time for staff accounts
    if (user.role === 'staff') {
      try {
        const updatedStaffAccounts = staffAccounts.map(account =>
          account.id === user.id
            ? { ...account, lastLogin: new Date().toISOString() }
            : account
        );
        await kv.set('casino_staffAccounts', updatedStaffAccounts);
        console.log(`📅 Updated last login time for staff ${user.username}`);
      } catch (error) {
        console.warn('⚠️ Could not update staff last login time:', error);
      }
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;
    
    return c.json({ 
      user: userResponse,
      message: "Login successful" 
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return c.json(
      { error: "Login failed", details: error.message },
      500
    );
  }
});

// Data migration endpoint to help migrate from localStorage
app.post("/make-server-86a1418e/migrate", async (c) => {
  try {
    const body = await c.req.json();
    console.log('Migration request received:', Object.keys(body));
    
    // Migrate each data type
    for (const [key, data] of Object.entries(body)) {
      if (data && Array.isArray(data)) {
        console.log(`Migrating ${key}: ${data.length} items`);
        await kv.set(`casino_${key}`, data);
      }
    }
    
    return c.json({ 
      message: "Data migration completed successfully",
      migratedKeys: Object.keys(body)
    });
  } catch (error) {
    console.error('Migration error:', error);
    return c.json(
      { error: "Migration failed", details: error.message },
      500
    );
  }
});

// Endpoint to clear all data (useful for development)
app.delete("/make-server-86a1418e/clear-all", async (c) => {
  try {
    for (const route of dataRoutes) {
      await kv.del(`casino_${route}`);
    }
    await kv.del('casino_users');
    
    return c.json({ message: "All casino data cleared successfully" });
  } catch (error) {
    console.error('Clear all error:', error);
    return c.json(
      { error: "Failed to clear data", details: error.message },
      500
    );
  }
});

// Helper function to initialize staff accounts if needed
async function initializeStaffAccountsIfNeeded() {
  try {
    const staffAccounts = await kv.get('casino_staffAccounts');
    
    // Only create sample staff accounts if none exist and we want sample data
    // For now, keep this empty since we want a fresh start
    if (!staffAccounts) {
      // Initialize empty staff accounts for fresh start
      await kv.set('casino_staffAccounts', []);
      console.log('✅ Initialized empty staff accounts for fresh start');
    }
  } catch (error) {
    console.warn('⚠️ Could not initialize staff accounts:', error);
  }
}

Deno.serve(app.fetch);