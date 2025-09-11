# Supabase Database Setup Guide

## Issue: Permission Denied for Schema Public

The error "permission denied for schema public" occurs because the Supabase database needs proper configuration.

## Solution Steps:

### 1. Create Tables in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `rtjdqnuzeupbgbovbriy`
3. Navigate to **SQL Editor**
4. Run the following SQL commands:

```sql
-- Enable Row Level Security (RLS) but allow public access for development
-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  commission_rate DECIMAL DEFAULT 0.05,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  agent_id TEXT REFERENCES public.agents(id),
  agent_name TEXT,
  vip_level TEXT DEFAULT 'Bronze',
  total_spent DECIMAL DEFAULT 0,
  total_rolling DECIMAL DEFAULT 0,
  total_win_loss DECIMAL DEFAULT 0,
  total_buy_in DECIMAL DEFAULT 0,
  total_buy_out DECIMAL DEFAULT 0,
  credit_limit DECIMAL DEFAULT 0,
  available_credit DECIMAL DEFAULT 0,
  rolling_percentage DECIMAL DEFAULT 1.4,
  is_active BOOLEAN DEFAULT true,
  is_agent BOOLEAN DEFAULT false,
  source_agent_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL,
  agent_id TEXT REFERENCES public.agents(id),
  agent_name TEXT,
  total_rolling DECIMAL DEFAULT 0,
  total_win_loss DECIMAL DEFAULT 0,
  total_buy_in DECIMAL DEFAULT 0,
  total_buy_out DECIMAL DEFAULT 0,
  calculated_total_rolling DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Rolling records table
CREATE TABLE IF NOT EXISTS public.rolling_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT REFERENCES public.customers(id),
  trip_id TEXT REFERENCES public.trips(id),
  amount DECIMAL NOT NULL,
  win_loss DECIMAL DEFAULT 0,
  game_type TEXT,
  recorded_at TIMESTAMP DEFAULT NOW(),
  recorded_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Buy in/out records table
CREATE TABLE IF NOT EXISTS public.buy_in_out_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT REFERENCES public.customers(id),
  trip_id TEXT REFERENCES public.trips(id),
  type TEXT NOT NULL CHECK (type IN ('buy_in', 'buy_out')),
  amount DECIMAL NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  recorded_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff shifts table
CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  staff_id TEXT REFERENCES public.staff(id),
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  check_in_photo TEXT,
  check_out_photo TEXT,
  status TEXT DEFAULT 'checked_in',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Disable RLS for development (IMPORTANT!)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rolling_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.buy_in_out_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts DISABLE ROW LEVEL SECURITY;

-- Insert default admin user
INSERT INTO public.users (id, username, password, email, role, status) 
VALUES ('admin-1', 'admin', 'admin123', 'admin@casino.com', 'admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample agent
INSERT INTO public.agents (id, name, email, phone, commission_rate, status)
VALUES ('agent-1', 'Sample Agent', 'agent@casino.com', '+1234567890', 0.05, 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert agent user
INSERT INTO public.users (id, username, password, email, role, status)
VALUES ('agent-user-1', 'agent1', 'agent123', 'agent@casino.com', 'agent', 'active')
ON CONFLICT (id) DO NOTHING;
```

### 2. Verify Database Configuration

After running the SQL:
1. Go to **Table Editor** in Supabase Dashboard
2. Verify all tables are created
3. Check that RLS is disabled for all tables (important for development)

### 3. Test Connection

Refresh your application at `http://localhost:3000` and try logging in with:
- Username: `admin`
- Password: `admin123`

## Alternative: Use Service Role Key

If you continue to have permission issues, you may need to use the service role key instead of the anon key:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the `service_role` key (not the `anon` key)
3. Replace the key in `src/utils/supabase/supabaseClients.ts`

**⚠️ Warning**: Only use service role key in development, never in production!

## Troubleshooting

- **Still getting permission errors?** Make sure RLS is disabled on all tables
- **Tables not appearing?** Check the SQL ran without errors in the SQL Editor
- **Login not working?** Verify the admin user was inserted correctly
