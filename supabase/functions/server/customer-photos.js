import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// CUSTOMER PHOTOS API ENDPOINTS
// =====================================================

/**
 * GET /customer-photos
 * Get customer photos with filtering options
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { trip_id, customer_id, photo_type, status } = req.query;
    
    let query = supabase
      .from('customer_photos')
      .select(`
        id,
        customer_id,
        trip_id,
        photo_type,
        photo,
        uploaded_by,
        upload_date,
        transaction_date,
        status,
        customer:customers(id, name, email),
        trip:trips(id, trip_name, destination),
        staff:staff(id, name, email)
      `)
      .order('upload_date', { ascending: false });
    
    // Apply filters if provided
    if (trip_id) {
      query = query.eq('trip_id', trip_id);
    }
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    if (photo_type) {
      query = query.eq('photo_type', photo_type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    // Staff can only see photos for their trips
    if (userRole === 'staff') {
      console.log('Staff user accessing customer photos, userId:', userId, 'staffId:', req.user.staff_id);
      
      const staffId = req.user.staff_id || userId;
      
      // If trip_id is provided, check if staff has access to that specific trip
      if (trip_id) {
        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .select('id, staff_id')
          .eq('id', trip_id)
          .single();
        
        if (tripError || !trip) {
          console.error('Trip not found:', trip_id, tripError);
          return res.status(404).json({
            error: 'Trip not found',
            details: tripError?.message
          });
        }
        
        console.log('Trip staff_id:', trip.staff_id, 'User staff_id:', staffId);
        if (trip.staff_id !== staffId) {
          return res.status(403).json({
            error: 'Access denied to this trip'
          });
        }
        // Trip access verified, query will already be filtered by trip_id
      } else {
        // Get all trip IDs for this staff member
        const { data: staffTrips, error: tripError } = await supabase
          .from('trips')
          .select('id')
          .eq('staff_id', staffId);
        
        if (tripError) {
          console.error('Failed to fetch staff trips:', tripError);
          return res.status(500).json({
            error: 'Failed to fetch staff trips',
            details: tripError.message
          });
        }
        
        const tripIds = staffTrips?.map(trip => trip.id) || [];
        console.log('Staff trip IDs:', tripIds);
        
        if (tripIds.length === 0) {
          // Staff has no trips, return empty result
          return res.json({
            success: true,
            data: [],
            userRole,
            total: 0
          });
        }
        
        query = query.in('trip_id', tripIds);
      }
    }
    
    const { data: photos, error } = await query;
    
    if (error) {
      console.error('Customer photos query error:', error);
      return res.status(500).json({
        error: 'Failed to fetch customer photos',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      data: photos,
      userRole,
      total: photos?.length || 0
    });
  } catch (error) {
    console.error('❌ GET /customer-photos endpoint error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /customer-photos/:id
 * Get a specific customer photo by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const photoId = req.params.id;
    const userRole = req.user.role;
    const staffId = req.user.staff_id || req.user.id;
    
    const { data: photo, error } = await supabase
      .from('customer_photos')
      .select(`
        id,
        customer_id,
        trip_id,
        photo_type,
        photo,
        uploaded_by,
        upload_date,
        transaction_date,
        status,
        customer:customers(id, name, email),
        trip:trips(id, trip_name, destination, staff_id),
        staff:staff(id, name, email)
      `)
      .eq('id', photoId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Customer photo not found' });
      }
      return res.status(500).json({
        error: 'Failed to fetch customer photo',
        details: error.message
      });
    }
    
    // Check if staff has access to this photo's trip
    if (userRole === 'staff' && photo.trip.staff_id !== staffId) {
      return res.status(403).json({
        error: 'Access denied to this photo'
      });
    }
    
    res.json({
      success: true,
      data: photo
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /customer-photos
 * Create a new customer photo
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { customer_id, trip_id, photo_type, photo, transaction_date } = req.body;
    const userRole = req.user.role;
    const staffId = req.user.staff_id || req.user.id;
    
    // Validate required fields
    if (!customer_id || !trip_id || !photo_type || !photo) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_id', 'trip_id', 'photo_type', 'photo']
      });
    }
    
    // Validate photo type
    if (!['transaction', 'rolling'].includes(photo_type)) {
      return res.status(400).json({
        error: 'Invalid photo type',
        validTypes: ['transaction', 'rolling']
      });
    }
    
    // Staff can only upload photos for their trips
    if (userRole === 'staff') {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, staff_id')
        .eq('id', trip_id)
        .single();
      
      if (tripError || !trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      if (trip.staff_id !== staffId) {
        return res.status(403).json({ error: 'Access denied to this trip' });
      }
    }
    
    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .single();
    
    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Create the customer photo record
    const { data: customerPhoto, error } = await supabase
      .from('customer_photos')
      .insert({
        customer_id,
        trip_id,
        photo_type,
        photo,
        uploaded_by: staffId,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to create customer photo',
        details: error.message
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Customer photo uploaded successfully',
      data: customerPhoto
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /customer-photos/:id
 * Update a customer photo (mainly for admin to approve/reject)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const photoId = req.params.id;
    const updateData = req.body;
    const userRole = req.user.role;
    
    // Check if photo exists
    const { data: existingPhoto, error: checkError } = await supabase
      .from('customer_photos')
      .select('id, trip_id, uploaded_by')
      .eq('id', photoId)
      .single();
    
    if (checkError || !existingPhoto) {
      return res.status(404).json({ error: 'Customer photo not found' });
    }
    
    // Only admin can change status, staff can only update their own uploads
    if (userRole === 'staff') {
      const staffId = req.user.staff_id || req.user.id;
      
      if (existingPhoto.uploaded_by !== staffId) {
        return res.status(403).json({ error: 'You can only update photos you uploaded' });
      }
      
      // Staff cannot change status
      if (updateData.status) {
        delete updateData.status;
      }
    }
    
    // Update the photo
    const { data: updatedPhoto, error } = await supabase
      .from('customer_photos')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', photoId)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to update customer photo',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Customer photo updated successfully',
      data: updatedPhoto
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /customer-photos/:id
 * Delete a customer photo (admin or the staff who uploaded it)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const photoId = req.params.id;
    const userRole = req.user.role;
    const staffId = req.user.staff_id || req.user.id;
    
    // Check if photo exists and get uploader info
    const { data: existingPhoto, error: checkError } = await supabase
      .from('customer_photos')
      .select('id, uploaded_by')
      .eq('id', photoId)
      .single();
    
    if (checkError || !existingPhoto) {
      return res.status(404).json({ error: 'Customer photo not found' });
    }
    
    // Staff can only delete their own uploads
    if (userRole === 'staff' && existingPhoto.uploaded_by !== staffId) {
      return res.status(403).json({ error: 'You can only delete photos you uploaded' });
    }
    
    // Delete the photo
    const { error } = await supabase
      .from('customer_photos')
      .delete()
      .eq('id', photoId);
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to delete customer photo',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Customer photo deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /customer-photos/:id/approve
 * Approve a customer photo (admin only)
 */
router.put('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const photoId = req.params.id;
    
    // Update the photo status to approved
    const { data: updatedPhoto, error } = await supabase
      .from('customer_photos')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', photoId)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to approve customer photo',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Customer photo approved successfully',
      data: updatedPhoto
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * PUT /customer-photos/:id/reject
 * Reject a customer photo (admin only)
 */
router.put('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const photoId = req.params.id;
    const { reason } = req.body;
    
    // Update the photo status to rejected
    const { data: updatedPhoto, error } = await supabase
      .from('customer_photos')
      .update({
        status: 'rejected',
        notes: reason || 'Rejected by admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', photoId)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to reject customer photo',
        details: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Customer photo rejected successfully',
      data: updatedPhoto
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

export default router;
