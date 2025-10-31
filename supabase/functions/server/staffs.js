import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireRole } from './auth.js';

const router = express.Router();

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /staffs - Get all staff members with user info
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching all staff members...');

    const { data: staff, error } = await supabase
      .from('staff')
      .select(`
        *,
        users!staff_id(
          id,
          username,
          status
        ),
        current_shift:staff_shifts!staff_id(
          id,
          check_in_time,
          check_out_time,
          status,
          shift_date
        )
      `)
      .eq('staff_shifts.status', 'checked-in')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching staff:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch staff members',
        error: error.message
      });
    }

    // Transform data to include username from users table
    const transformedStaff = staff?.map(member => ({
      ...member,
      username: member.users?.[0]?.username || null,
      user_id: member.users?.[0]?.id || null,
      user_status: member.users?.[0]?.status || null
    })) || [];

    console.log(`✅ Found ${transformedStaff.length} staff members`);

    res.json({
      success: true,
      data: transformedStaff
    });

  } catch (error) {
    console.error('❌ Unexpected error in GET /staffs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /staffs/:id - Get specific staff member
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Fetching staff member: ${id}`);

    const { data: staff, error } = await supabase
      .from('staff')
      .select(`
        *,
        shifts:staff_shifts!staff_id(
          id,
          check_in_time,
          check_out_time,
          shift_date,
          status,
          notes,
          check_in_photo,
          check_out_photo
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching staff:', error);
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
        error: error.message
      });
    }

    console.log(`✅ Found staff member: ${staff.name}`);
    res.json({
      success: true,
      data: staff
    });

  } catch (error) {
    console.error('❌ Unexpected error in GET /staffs/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// POST /staffs - Create new staff member with user account
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, position, username, password, attachments = [] } = req.body;
    
    console.log('👤 Creating new staff member:', { name, email, position });

    if (!name || !email || !phone || !position || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, position, username, and password are required'
      });
    }

    // Check if email already exists in staff table
    const { data: existingStaff, error: staffCheckError } = await supabase
      .from('staff')
      .select('id, email')
      .eq('email', email);

    if (staffCheckError) {
      console.error('❌ Error checking existing staff:', staffCheckError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing staff',
        error: staffCheckError.message
      });
    }

    if (existingStaff && existingStaff.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Staff member with this email already exists'
      });
    }

    // Check if username already exists in users table
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username);

    if (userCheckError) {
      console.error('❌ Error checking existing user:', userCheckError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing user',
        error: userCheckError.message
      });
    }

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Step 1: Create staff member (without login credentials)
    const { data: newStaff, error: staffInsertError } = await supabase
      .from('staff')
      .insert([{
        name,
        email,
        phone,
        position,
        status: 'active',
        attachments
      }])
      .select()
      .single();

    if (staffInsertError) {
      console.error('❌ Error creating staff member:', staffInsertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create staff member',
        error: staffInsertError.message
      });
    }

    // Step 2: Create user account linked to staff
    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert([{
        username,
        password, // In production, this should be hashed
        email,
        role: 'staff',
        staff_id: newStaff.id,
        status: 'active'
      }])
      .select()
      .single();

    if (userInsertError) {
      console.error('❌ Error creating user account:', userInsertError);
      // Rollback: delete the staff member
      await supabase.from('staff').delete().eq('id', newStaff.id);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account',
        error: userInsertError.message
      });
    }

    console.log('✅ Created staff member:', newStaff.name, '(ID:', newStaff.id, ')');
    console.log('✅ Created user account:', newUser.username, '(ID:', newUser.id, ')');

    // Return combined data
    const responseData = {
      ...newStaff,
      username: newUser.username,
      user_id: newUser.id
    };

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Staff member created successfully'
    });

  } catch (error) {
    console.error('❌ Unexpected error in POST /staffs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// PUT /staffs/:id - Update staff member and/or user credentials
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, position, status, attachments, username, password } = req.body;
    
    console.log(`👤 Updating staff member: ${id}`);

    // Build update object with only provided fields for staff table
    const staffUpdateData = {};
    if (name !== undefined) staffUpdateData.name = name;
    if (email !== undefined) staffUpdateData.email = email;
    if (phone !== undefined) staffUpdateData.phone = phone;
    if (position !== undefined) staffUpdateData.position = position;
    if (status !== undefined) staffUpdateData.status = status;
    if (attachments !== undefined) staffUpdateData.attachments = attachments;
    
    staffUpdateData.updated_at = new Date().toISOString();

    // Update staff table
    const { data: updatedStaff, error: staffError } = await supabase
      .from('staff')
      .update(staffUpdateData)
      .eq('id', id)
      .select()
      .single();

    if (staffError) {
      console.error('❌ Error updating staff:', staffError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update staff member',
        error: staffError.message
      });
    }

    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Update user credentials if provided
    if (username !== undefined || password !== undefined) {
      const userUpdateData = {};
      if (username !== undefined) userUpdateData.username = username;
      if (password !== undefined) userUpdateData.password = password;
      
      const { error: userError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('staff_id', id);

      if (userError) {
        console.error('❌ Error updating user credentials:', userError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update user credentials',
          error: userError.message
        });
      }
      
      console.log(`✅ Updated user credentials for staff: ${id}`);
    }

    // Fetch complete staff data with user info
    const { data: completeStaff, error: fetchError } = await supabase
      .from('staff')
      .select(`
        *,
        users!staff_id(
          id,
          username,
          status
        ),
        current_shift:staff_shifts!staff_id(
          id,
          check_in_time,
          check_out_time,
          status,
          shift_date
        )
      `)
      .eq('staff_shifts.status', 'checked-in')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching updated staff:', fetchError);
      // Return basic updated staff if fetch fails
      return res.json({
        success: true,
        data: updatedStaff,
        message: 'Staff member updated successfully'
      });
    }

    // Transform data to include username from users table
    const transformedStaff = {
      ...completeStaff,
      username: completeStaff.users?.[0]?.username || null,
      user_id: completeStaff.users?.[0]?.id || null,
      user_status: completeStaff.users?.[0]?.status || null
    };

    console.log(`✅ Updated staff member: ${updatedStaff.name}`);
    res.json({
      success: true,
      data: transformedStaff,
      message: 'Staff member updated successfully'
    });

  } catch (error) {
    console.error('❌ Unexpected error in PUT /staffs/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// DELETE /staffs/:id - Delete staff member and associated user account
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting staff member: ${id}`);

    // Check if staff has any shifts first
    const { data: shifts, error: shiftsError } = await supabase
      .from('staff_shifts')
      .select('id')
      .eq('staff_id', id)
      .limit(1);

    if (shiftsError) {
      console.error('❌ Error checking staff shifts:', shiftsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check staff shifts',
        error: shiftsError.message
      });
    }

    if (shifts && shifts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete staff member with existing shift records. Consider deactivating instead.'
      });
    }

    // Find associated user account
    const { data: userAccount, error: userFindError } = await supabase
      .from('users')
      .select('id')
      .eq('staff_id', id)
      .single();

    // Delete user account first (if exists)
    if (userAccount && !userFindError) {
      const { error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userAccount.id);

      if (userDeleteError) {
        console.error('❌ Error deleting user account:', userDeleteError);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user account',
          error: userDeleteError.message
        });
      }
      console.log(`✅ Deleted user account: ${userAccount.id}`);
    }

    // Delete staff member
    const { error: deleteError } = await supabase
      .from('staff')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting staff member:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete staff member',
        error: deleteError.message
      });
    }

    console.log(`✅ Deleted staff member: ${id}`);

    res.json({
      success: true,
      message: 'Staff member and user account deleted successfully'
    });

  } catch (error) {
    console.error('❌ Unexpected error in DELETE /staffs/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// POST /staffs/:id/check-in - Staff check-in
router.post('/:id/check-in', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in_photo, notes = '' } = req.body;
    
    console.log(`⏰ Staff check-in: ${id}`);

    if (!check_in_photo) {
      return res.status(400).json({
        success: false,
        message: 'Check-in photo is required'
      });
    }

    // Check if staff already has an active shift today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingShift, error: checkError } = await supabase
      .from('staff_shifts')
      .select('id, status')
      .eq('staff_id', id)
      .eq('shift_date', today)
      .eq('status', 'checked-in')
      .single();

    if (existingShift && !checkError) {
      return res.status(409).json({
        success: false,
        message: 'Staff member is already checked in for today'
      });
    }

    // Create new shift record
    const { data: newShift, error } = await supabase
      .from('staff_shifts')
      .insert([{
        staff_id: id,
        check_in_time: new Date().toISOString(),
        shift_date: today,
        status: 'checked-in',
        check_in_photo,
        notes
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating check-in record:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check in staff member',
        error: error.message
      });
    }

    console.log(`✅ Staff checked in: ${id} at ${newShift.check_in_time}`);
    res.status(201).json({
      success: true,
      data: newShift,
      message: 'Staff member checked in successfully'
    });

  } catch (error) {
    console.error('❌ Unexpected error in POST /staffs/:id/check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// POST /staffs/:id/check-out - Staff check-out
router.post('/:id/check-out', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { check_out_photo, notes = '' } = req.body;
    
    console.log(`⏰ Staff check-out: ${id}`);

    if (!check_out_photo) {
      return res.status(400).json({
        success: false,
        message: 'Check-out photo is required'
      });
    }

    // Find active shift for today
    const today = new Date().toISOString().split('T')[0];
    const { data: activeShift, error: findError } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', id)
      .eq('shift_date', today)
      .eq('status', 'checked-in')
      .single();

    if (findError || !activeShift) {
      return res.status(404).json({
        success: false,
        message: 'No active shift found for today. Please check in first.'
      });
    }

    // Update shift with check-out information
    const { data: updatedShift, error } = await supabase
      .from('staff_shifts')
      .update({
        check_out_time: new Date().toISOString(),
        status: 'checked-out',
        check_out_photo,
        notes: notes || activeShift.notes
      })
      .eq('id', activeShift.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating check-out record:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check out staff member',
        error: error.message
      });
    }

    console.log(`✅ Staff checked out: ${id} at ${updatedShift.check_out_time}`);
    res.json({
      success: true,
      data: updatedShift,
      message: 'Staff member checked out successfully'
    });

  } catch (error) {
    console.error('❌ Unexpected error in POST /staffs/:id/check-out:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /staffs/:id/shifts - Get staff member's shift history
router.get('/:id/shifts', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, start_date, end_date } = req.query;
    
    console.log(`📋 Fetching shifts for staff: ${id}`);

    let query = supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', id)
      .order('shift_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (start_date) {
      query = query.gte('shift_date', start_date);
    }
    if (end_date) {
      query = query.lte('shift_date', end_date);
    }

    const { data: shifts, error } = await query;

    if (error) {
      console.error('❌ Error fetching shifts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch shift history',
        error: error.message
      });
    }

    console.log(`✅ Found ${shifts?.length || 0} shifts for staff: ${id}`);
    res.json({
      success: true,
      data: shifts || []
    });

  } catch (error) {
    console.error('❌ Unexpected error in GET /staffs/:id/shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /staffs/:id/rolling-records - Get staff member's rolling records
router.get('/:id/rolling-records', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, start_date, end_date } = req.query;
    
    console.log(`📋 Fetching rolling records for staff: ${id}`);

    let query = supabase
      .from('transactions')
      .select(`
        *,
        customer:customers!inner(id, name),
        agent:agents!inner(id, name)
      `)
      .eq('recorded_by_staff_id', id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('❌ Error fetching rolling records:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rolling records',
        error: error.message
      });
    }

    console.log(`✅ Found ${records?.length || 0} rolling records for staff: ${id}`);
    res.json({
      success: true,
      data: records || []
    });

  } catch (error) {
    console.error('❌ Unexpected error in GET /staffs/:id/rolling-records:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
