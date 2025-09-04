-- Staff table for employee management
CREATE TABLE IF NOT EXISTS staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    position VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- In production, this should be hashed
    status TEXT DEFAULT 'active',
    attachments JSONB DEFAULT '[]'::jsonb, -- Store passport, photo, and other documents
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff shifts table for check-in/check-out tracking
CREATE TABLE IF NOT EXISTS staff_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    shift_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'checked-in' CHECK (status IN ('checked-in', 'checked-out')),
    check_in_photo JSONB, -- Store photo metadata and base64 data
    check_out_photo JSONB, -- Store photo metadata and base64 data
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_username ON staff(username);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_attachments ON staff USING GIN (attachments);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_date ON staff_shifts(staff_id, shift_date);

-- Add RLS policies for staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all staff
CREATE POLICY "Allow authenticated users to read staff" ON staff
    FOR SELECT TO authenticated USING (true);

-- Allow admins to insert, update, delete staff
CREATE POLICY "Allow admins to manage staff" ON staff
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Allow staff to update their own records (limited fields)
CREATE POLICY "Allow staff to update own record" ON staff
    FOR UPDATE TO authenticated 
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- Add RLS policies for staff_shifts table
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all shifts
CREATE POLICY "Allow authenticated users to read shifts" ON staff_shifts
    FOR SELECT TO authenticated USING (true);

-- Allow admins to manage all shifts
CREATE POLICY "Allow admins to manage shifts" ON staff_shifts
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Allow staff to manage their own shifts
CREATE POLICY "Allow staff to manage own shifts" ON staff_shifts
    FOR ALL TO authenticated 
    USING (auth.uid()::text = staff_id::text)
    WITH CHECK (auth.uid()::text = staff_id::text);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_shifts_updated_at BEFORE UPDATE ON staff_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data for testing (optional)
-- INSERT INTO staff (name, email, phone, position, username, password) VALUES
-- ('John Doe', 'john@casino.com', '+852-1234-5678', 'Floor Manager', 'john_doe', 'password123'),
-- ('Jane Smith', 'jane@casino.com', '+852-2345-6789', 'Dealer', 'jane_smith', 'password123'),
-- ('Mike Johnson', 'mike@casino.com', '+852-3456-7890', 'Security', 'mike_johnson', 'password123');

COMMENT ON TABLE staff IS 'Staff members with login credentials for the staff platform';
COMMENT ON TABLE staff_shifts IS 'Staff check-in/check-out records with photos and shift tracking';
COMMENT ON COLUMN staff.attachments IS 'JSONB array storing file attachments (passport, photo, documents)';
COMMENT ON COLUMN staff_shifts.check_in_photo IS 'JSONB object with photo metadata and base64 data for check-in';
COMMENT ON COLUMN staff_shifts.check_out_photo IS 'JSONB object with photo metadata and base64 data for check-out';
