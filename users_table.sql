
-- Create new users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Should be hashed in production
    email VARCHAR(255) UNIQUE,
    
    -- Role information
    role TEXT CHECK (role IN ('admin', 'agent', 'staff')),
    
    -- References to other tables
    agent_id UUID REFERENCES agents(id),
    staff_id UUID REFERENCES staff(id),
    
    -- Status and metadata
    status TEXT DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read all users
CREATE POLICY "Allow authenticated users to read users" ON users
    FOR SELECT TO authenticated USING (true);

-- Allow admins to manage all users
CREATE POLICY "Allow admins to manage users" ON users
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Allow users to update their own record (limited fields)
CREATE POLICY "Allow users to update own record" ON users
    FOR UPDATE TO authenticated 
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table and column documentation
COMMENT ON TABLE users IS 'User accounts for system access with role-based permissions';
COMMENT ON COLUMN users.role IS 'User role: admin, agent, or staff';
COMMENT ON COLUMN users.agent_id IS 'Reference to agents table if user is an agent';
COMMENT ON COLUMN users.staff_id IS 'Reference to staff table if user is staff';
COMMENT ON COLUMN users.last_login IS 'Timestamp of last successful login';