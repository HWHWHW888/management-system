import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Textarea } from './ui/textarea';
import { User, StaffShift, FileAttachment } from '../types';
import { FileUpload } from './FileUpload';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { Plus, Edit, Mail, Phone, Paperclip, ChevronDown, ChevronUp, Save, Eye, UserPlus, Key, EyeOff, LogIn, LogOut, Clock, RefreshCw, CheckCircle, Shield } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { apiClient } from '../utils/api/apiClient';
import { isReadOnlyRole } from '../utils/permissions';

interface StaffManagementProps extends WithErrorHandlerProps {
  user: User;
}

interface StaffWithUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  status: 'active' | 'inactive';
  attachments: FileAttachment[];
  created_at: string;
  updated_at: string;
  username?: string;
  user_id?: string;
  user_status?: string;
  current_shift?: StaffShift[];
}

function StaffManagementComponent({ user, showError, clearError }: StaffManagementProps) {
  const isReadOnly = isReadOnlyRole(user.role);
  const [staff, setStaff] = useState<StaffWithUser[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffWithUser | null>(null);
  const [managingLoginStaff, setManagingLoginStaff] = useState<StaffWithUser | null>(null);
  const [checkingInStaff, setCheckingInStaff] = useState<StaffWithUser | null>(null);
  const [checkingOutStaff, setCheckingOutStaff] = useState<StaffWithUser | null>(null);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffShifts, setStaffShifts] = useState<{[key: string]: StaffShift[]}>({});
  const [loadingShifts, setLoadingShifts] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    username: '',
    password: ''
  });
  const [loginFormData, setLoginFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const loadStaffShifts = useCallback(async (staffId: string) => {
    if (loadingShifts[staffId] || staffShifts[staffId]) return;
    
    try {
      setLoadingShifts(prev => ({ ...prev, [staffId]: true }));
      
      const shiftsResponse = await apiClient.get(`/staffs/${staffId}/shifts`);
      
      if (shiftsResponse.success) {
        setStaffShifts(prev => ({ ...prev, [staffId]: shiftsResponse.data || [] }));
      }
    } catch (error) {
      console.error('❌ Error loading staff shifts:', error);
    } finally {
      setLoadingShifts(prev => ({ ...prev, [staffId]: false }));
    }
  }, [loadingShifts, staffShifts]);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      console.log('🔄 Loading staff data from API...');
      
      // Load staff data from new API
      const staffResponse = await apiClient.getStaffs();
      
      if (!staffResponse.success) {
        throw new Error(staffResponse.error || 'Failed to load staff data');
      }

      const processedStaff = staffResponse.data?.map((member: any) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        position: member.position,
        status: member.status,
        attachments: member.attachments || [],
        created_at: member.created_at,
        updated_at: member.updated_at,
        username: member.username,
        user_id: member.user_id,
        user_status: member.user_status,
        current_shift: member.current_shift || []
      })) || [];

      setStaff(processedStaff);
      
      console.log(`✅ Loaded ${processedStaff.length} staff members from API`);
      
    } catch (error) {
      console.error('❌ Error loading staff data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to load staff data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [clearError, showError]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Remove syncStaffWithUsers as it's no longer needed with new API architecture

  // Remove saveStaffToSupabase as we now use individual API calls

  // Remove saveStaffAccountsToSupabase as accounts are now managed via API

  // Remove syncStaffAccountsWithUsers as it's handled by the backend API

  // Remove saveShiftsToSupabase as shifts are managed via API

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      clearError();

      // Validate required fields
      if (!formData.name || !formData.email || !formData.phone || !formData.position) {
        throw new Error('Name, email, phone, position are required');
      }

      // For new staff, also validate username and password
      if (!editingStaff && (!formData.username || !formData.password)) {
        throw new Error('Username and password are required for new staff');
      }

      if (editingStaff) {
        // Update existing staff
        const updateData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          position: formData.position
        };
        
        console.log('Updating staff with data:', updateData);
        const response = await apiClient.updateStaff(editingStaff.id, updateData);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to update staff member');
        }
      } else {
        // Create new staff with login credentials
        const staffData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          username: formData.username,
          password: formData.password
        };
        
        console.log('Creating new staff with data:', { ...staffData, password: '***' });
        const response = await apiClient.createStaff(staffData);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to create staff member');
        }
      }

      // Reload data to get updated information
      await loadAllData();
      resetForm();
      
    } catch (error) {
      console.error('❌ Error saving staff:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save staff: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!managingLoginStaff) return;

    if (loginFormData.password !== loginFormData.confirmPassword) {
      showError('Passwords do not match!');
      return;
    }

    try {
      setSaving(true);
      clearError();
      
      // Update staff with new login credentials
      const updateData = {
        username: loginFormData.username,
        password: loginFormData.password
      };
      
      const response = await apiClient.updateStaff(managingLoginStaff.id, updateData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update login credentials');
      }

      // Reload data to get updated information
      await loadAllData();
      resetLoginForm();
      
    } catch (error) {
      console.error('❌ Error updating login credentials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to update login credentials: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      position: '',
      username: '',
      password: ''
    });
    setEditingStaff(null);
    setIsDialogOpen(false);
  };

  const resetLoginForm = () => {
    setLoginFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
    setManagingLoginStaff(null);
    setIsLoginDialogOpen(false);
    setShowPassword(false);
  };

  const handleEdit = (staffMember: StaffWithUser) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      phone: staffMember.phone,
      position: staffMember.position,
      username: staffMember.username || '',
      password: ''
    });
    setIsDialogOpen(true);
  };

  const handleManageLogin = (staffMember: StaffWithUser) => {
    setManagingLoginStaff(staffMember);
    
    setLoginFormData({
      username: staffMember.username || '',
      password: '',
      confirmPassword: ''
    });
    setIsLoginDialogOpen(true);
  };

  const deleteStaff = async (staffId: string) => {
    try {
      setSaving(true);
      clearError();
      
      const response = await apiClient.deleteStaff(staffId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete staff member');
      }
      
      // Reload data to get updated information
      await loadAllData();
      
    } catch (error) {
      console.error('❌ Error deleting staff:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to delete staff: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStaffExpansion = (staffId: string) => {
    setExpandedStaff(expandedStaff === staffId ? null : staffId);
  };

  // const toggleStaffStatus = async (staffId: string) => {
  //   try {
  //     setSaving(true);
  //     clearError();
  //     
  //     const staffMember = staff.find(s => s.id === staffId);
  //     if (!staffMember) return;
  //     
  //     const newStatus = staffMember.status === 'active' ? 'inactive' : 'active';
  //     const response = await apiClient.updateStaff(staffId, { status: newStatus });
  //     
  //     if (!response.success) {
  //       throw new Error(response.error || 'Failed to update staff status');
  //     }
  //     
  //     // Reload data to get updated information
  //     await loadAllData();
  //     
  //   } catch (error) {
  //     console.error('❌ Error updating staff status:', error);
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  //     showError(`Failed to update staff status: ${errorMessage}`);
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  const openCheckInDialog = (staffMember: StaffWithUser) => {
    setCheckingInStaff(staffMember);
    setCheckInPhoto(null);
    setCheckInNotes('');
    setIsCheckInDialogOpen(true);
  };

  const openCheckOutDialog = (staffMember: StaffWithUser) => {
    setCheckingOutStaff(staffMember);
    setCheckOutPhoto(null);
    setCheckOutNotes('');
    setIsCheckOutDialogOpen(true);
  };

  const handleCheckIn = async () => {
    if (!checkingInStaff || !checkInPhoto) return;

    try {
      setSaving(true);
      clearError();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const checkInData = {
            check_in_photo: e.target?.result as string,
            notes: checkInNotes
          };
          
          const response = await apiClient.staffCheckIn(checkingInStaff.id, checkInData);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to check in staff member');
          }
          
          // Reload data to get updated information
          await loadAllData();

          setIsCheckInDialogOpen(false);
          setCheckingInStaff(null);
          setCheckInPhoto(null);
          setCheckInNotes('');
          
        } catch (error) {
          console.error('❌ Error processing check-in:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          showError(`Failed to process check-in: ${errorMessage}`);
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(checkInPhoto);
    } catch (error) {
      console.error('❌ Error during check-in:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Check-in failed: ${errorMessage}`);
      setSaving(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkingOutStaff || !checkOutPhoto) return;

    try {
      setSaving(true);
      clearError();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const checkOutData = {
            check_out_photo: e.target?.result as string,
            notes: checkOutNotes
          };
          
          const response = await apiClient.staffCheckOut(checkingOutStaff.id, checkOutData);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to check out staff member');
          }
          
          // Reload data to get updated information
          await loadAllData();

          setIsCheckOutDialogOpen(false);
          setCheckingOutStaff(null);
          setCheckOutPhoto(null);
          setCheckOutNotes('');
          
        } catch (error) {
          console.error('❌ Error processing check-out:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          showError(`Failed to process check-out: ${errorMessage}`);
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(checkOutPhoto);
    } catch (error) {
      console.error('❌ Error during check-out:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Check-out failed: ${errorMessage}`);
      setSaving(false);
    }
  };

  // const getStaffShifts = async (staffId: string) => {
  //   try {
  //     const response = await apiClient.getStaffShifts(staffId);
  //     if (response.success) {
  //       return response.data || [];
  //     }
  //     return [];
  //   } catch (error) {
  //     console.error('❌ Error fetching staff shifts:', error);
  //     return [];
  //   }
  // };

  const isStaffCheckedIn = (staffMember: StaffWithUser) => {
    return staffMember.current_shift && staffMember.current_shift.length > 0 && staffMember.current_shift[0].status === 'checked-in';
  };

  const updateStaffAttachments = async (staffId: string, attachments: FileAttachment[]) => {
    try {
      setSaving(true);
      clearError();
      
      const response = await apiClient.updateStaff(staffId, { attachments });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update staff attachments');
      }
      
      // Reload data to get updated information
      await loadAllData();
      
    } catch (error) {
      console.error('❌ Error updating staff attachments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to update staff attachments: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const getStaffAccount = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? {
      username: staffMember.username,
      user_id: staffMember.user_id,
      user_status: staffMember.user_status
    } : null;
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setLoginFormData({
      ...loginFormData,
      password: password,
      confirmPassword: password
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading staff data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">


      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-gray-600">
            Manage casino staff, their login credentials, and shift tracking with photo verification
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)} disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </DialogTitle>
              <DialogDescription>
                {editingStaff ? 'Update staff information' : 'Add a new staff member to the system'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="flex items-center">
                    Name <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Staff member name"
                    required
                    disabled={saving}
                    className={!formData.name ? "border-red-300" : ""}
                  />
                  {!formData.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
                </div>
                
                <div>
                  <Label htmlFor="position" className="flex items-center">
                    Position <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    placeholder="Floor Manager, Cashier, etc."
                    required
                    disabled={saving}
                    className={!formData.position ? "border-red-300" : ""}
                  />
                  {!formData.position && <p className="text-xs text-red-500 mt-1">Position is required</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="flex items-center">
                    Email <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="staff@casino.com"
                    required
                    disabled={saving}
                    className={!formData.email ? "border-red-300" : ""}
                  />
                  {!formData.email && <p className="text-xs text-red-500 mt-1">Email is required</p>}
                </div>
                
                <div>
                  <Label htmlFor="phone" className="flex items-center">
                    Phone <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1234567890"
                    required
                    disabled={saving}
                    className={!formData.phone ? "border-red-300" : ""}
                  />
                  {!formData.phone && <p className="text-xs text-red-500 mt-1">Phone is required</p>}
                </div>
              </div>

              {!editingStaff && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="username" className="flex items-center">
                        Username <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        placeholder="Login username"
                        required
                        disabled={saving}
                        className={!formData.username ? "border-red-300" : ""}
                      />
                      {!formData.username && <p className="text-xs text-red-500 mt-1">Username is required</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="password" className="flex items-center">
                        Password <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="Login password"
                        required
                        disabled={saving}
                        className={!formData.password ? "border-red-300" : ""}
                      />
                      {!formData.password && <p className="text-xs text-red-500 mt-1">Password is required</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> {editingStaff ? 
                    "You can update login credentials separately using the 'Manage Login' button." : 
                    "All fields marked with * are required. Username and password are needed for staff login."}
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Save className="w-4 h-4 mr-2 animate-spin" />
                      Saving to Supabase...
                    </>
                  ) : (
                    <>
                      {editingStaff ? 'Update' : 'Add'} Staff Member
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Login Management Dialog */}
      {!isReadOnly && (
        <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Manage Login - {managingLoginStaff?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Create or update login credentials for this staff member
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={loginFormData.username}
                onChange={(e) => setLoginFormData({...loginFormData, username: e.target.value})}
                placeholder="Enter username"
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be used to login to the staff portal
              </p>
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={loginFormData.password}
                  onChange={(e) => setLoginFormData({...loginFormData, password: e.target.value})}
                  placeholder="Enter password"
                  required
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={saving}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePassword}
                  className="text-xs"
                  disabled={saving}
                >
                  Generate Password
                </Button>
                <p className="text-xs text-gray-500">
                  Minimum 6 characters
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={loginFormData.confirmPassword}
                onChange={(e) => setLoginFormData({...loginFormData, confirmPassword: e.target.value})}
                placeholder="Confirm password"
                required
                disabled={saving}
              />
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700">
                <strong>Security Note:</strong> Staff members can only login with the exact credentials you provide here. Make sure to securely communicate these credentials to the staff member.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={resetLoginForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    {getStaffAccount(managingLoginStaff?.id || '') ? 'Update' : 'Create'} Login
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
        </Dialog>
      )}

      {/* Check-in Dialog */}
      {!isReadOnly && (
        <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In: {checkingInStaff?.name}</DialogTitle>
            <DialogDescription>
              Upload a photo as proof of check-in and add any notes for the shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="checkInPhoto">Check-in Photo (Required)</Label>
              <Input
                id="checkInPhoto"
                type="file"
                accept="image/*"
                onChange={(e) => setCheckInPhoto(e.target.files?.[0] || null)}
                className="mt-1"
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Take a photo as proof of check-in
              </p>
            </div>

            <div>
              <Label htmlFor="checkInNotes">Notes (Optional)</Label>
              <Textarea
                id="checkInNotes"
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
                placeholder="Any notes for this shift..."
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCheckInDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCheckIn} disabled={!checkInPhoto || saving}>
                {saving ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Check In
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Check-out Dialog */}
      {!isReadOnly && (
        <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out: {checkingOutStaff?.name}</DialogTitle>
            <DialogDescription>
              Upload a photo as proof of check-out and add any end-of-shift notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="checkOutPhoto">Check-out Photo (Required)</Label>
              <Input
                id="checkOutPhoto"
                type="file"
                accept="image/*"
                onChange={(e) => setCheckOutPhoto(e.target.files?.[0] || null)}
                className="mt-1"
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Take a photo as proof of check-out
              </p>
            </div>

            <div>
              <Label htmlFor="checkOutNotes">Notes (Optional)</Label>
              <Textarea
                id="checkOutNotes"
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
                placeholder="Any end-of-shift notes..."
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCheckOutDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCheckOut} disabled={!checkOutPhoto || saving}>
                {saving ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    Checking Out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Check Out
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      <div className="grid gap-6">
        {staff.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No staff members found. Add your first staff member to get started.</p>
            </CardContent>
          </Card>
        ) : (
          staff.map((staffMember) => {
            const isExpanded = expandedStaff === staffMember.id;
            const account = getStaffAccount(staffMember.id);
            const isCheckedIn = isStaffCheckedIn(staffMember);
            
            return (
              <Collapsible key={staffMember.id} open={isExpanded} onOpenChange={() => toggleStaffExpansion(staffMember.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center space-x-2">
                            <span>{staffMember.name}</span>
                            <Badge variant={staffMember.status === 'active' ? "default" : "secondary"}>
                              {staffMember.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                            
                            {isCheckedIn && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Checked In
                              </Badge>
                            )}

                            {account && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Key className="w-3 h-3 mr-1" />
                                Login Setup
                              </Badge>
                            )}

                            {staffMember.attachments && staffMember.attachments.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Paperclip className="w-3 h-3" />
                                <span>{staffMember.attachments.length}</span>
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {staffMember.position} • Member since {staffMember.created_at}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{staffMember.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{staffMember.phone}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {!isReadOnly && (
                        <Button variant="outline" size="sm" onClick={() => handleEdit(staffMember)} disabled={saving}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      
                      {!isReadOnly && (
                        <Button variant="outline" size="sm" onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                          <Key className="w-4 h-4 mr-2" />
                          {account ? 'Update Login' : 'Create Login'}
                        </Button>
                      )}

                      {!isReadOnly && (
                        isCheckedIn ? (
                          <Button variant="outline" size="sm" onClick={() => openCheckOutDialog(staffMember)} disabled={saving}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Check Out
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openCheckInDialog(staffMember)} disabled={saving}>
                            <LogIn className="w-4 h-4 mr-2" />
                            Check In
                          </Button>
                        )
                      )}

                      {!isReadOnly && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={saving} className="bg-red-600 text-white hover:bg-red-700">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete "{staffMember.name}"? This action cannot be undone and will remove all their data, shift history, and login credentials from the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteStaff(staffMember.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={saving}
                              >
                                {saving ? 'Deleting...' : 'Delete Permanently'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>

                    <CollapsibleContent className="mt-6">
                      <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="info" className="flex items-center space-x-2">
                            <Shield className="w-4 h-4" />
                            <span>Info</span>
                          </TabsTrigger>
                          <TabsTrigger value="shifts" className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>Shifts ({staffMember.current_shift?.length || 0})</span>
                          </TabsTrigger>
                          <TabsTrigger value="login" className="flex items-center space-x-2">
                            <Key className="w-4 h-4" />
                            <span>Login</span>
                          </TabsTrigger>
                          <TabsTrigger value="files" className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4" />
                            <span>Files ({staffMember.attachments?.length || 0})</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="info" className="space-y-4 mt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Name</Label>
                                <p className="text-lg">{staffMember.name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Email</Label>
                                <p>{staffMember.email}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Phone</Label>
                                <p>{staffMember.phone}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Position</Label>
                                <p>{staffMember.position}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Status</Label>
                                <Badge variant={staffMember.status === 'active' ? "default" : "secondary"}>
                                  {staffMember.status === 'active' ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                                <p>{staffMember.created_at}</p>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="shifts" className="space-y-4 mt-6">
                          {(() => {
                            // Load shifts when tab is accessed
                            if (!staffShifts[staffMember.id] && !loadingShifts[staffMember.id]) {
                              loadStaffShifts(staffMember.id);
                            }
                            
                            const shifts = staffShifts[staffMember.id] || [];
                            const isLoading = loadingShifts[staffMember.id];
                            
                            if (isLoading) {
                              return (
                                <Card>
                                  <CardContent className="text-center py-12">
                                    <RefreshCw className="w-8 h-8 mx-auto text-gray-400 mb-4 animate-spin" />
                                    <p className="text-gray-500">Loading shift history...</p>
                                  </CardContent>
                                </Card>
                              );
                            }
                            
                            if (shifts.length === 0) {
                              return (
                                <Card>
                                  <CardContent className="text-center py-12">
                                    <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-500">No shift history found.</p>
                                    <p className="text-sm text-gray-400 mt-2">Check-ins and check-outs will appear here.</p>
                                  </CardContent>
                                </Card>
                              );
                            }
                            
                            return (
                              <div className="space-y-4 max-h-96 overflow-y-auto">
                                {shifts.sort((a: any, b: any) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()).map((shift: any) => (
                                  <Card key={shift.id}>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Badge variant={shift.status === 'checked-in' ? 'default' : 'secondary'}>
                                              {shift.status === 'checked-in' ? 'Active' : 'Completed'}
                                            </Badge>
                                            <span className="text-sm text-gray-500">
                                              {new Date(shift.shift_date).toLocaleDateString()}
                                            </span>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Check-in Info */}
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                <LogIn className="w-4 h-4 text-green-600" />
                                                <Label className="text-sm font-medium">Check In</Label>
                                              </div>
                                              <p className="text-sm text-gray-600">
                                                {new Date(shift.check_in_time).toLocaleString()}
                                              </p>
                                              {shift.check_in_photo && (
                                                <div className="mt-2">
                                                  <ImageWithFallback
                                                    src={shift.check_in_photo}
                                                    alt="Check-in photo"
                                                    className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                                    onClick={() => window.open(shift.check_in_photo, '_blank')}
                                                  />
                                                </div>
                                              )}
                                            </div>
                                            
                                            {/* Check-out Info */}
                                            {shift.check_out_time && (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <LogOut className="w-4 h-4 text-red-600" />
                                                  <Label className="text-sm font-medium">Check Out</Label>
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                  {new Date(shift.check_out_time).toLocaleString()}
                                                </p>
                                                {shift.check_out_photo && (
                                                  <div className="mt-2">
                                                    <ImageWithFallback
                                                      src={shift.check_out_photo}
                                                      alt="Check-out photo"
                                                      className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                                      onClick={() => window.open(shift.check_out_photo, '_blank')}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Notes */}
                                          {shift.notes && (
                                            <div className="mt-3 p-2 bg-gray-50 rounded">
                                              <Label className="text-xs font-medium text-gray-500">Notes</Label>
                                              <p className="text-sm text-gray-700 mt-1">{shift.notes}</p>
                                            </div>
                                          )}
                                          
                                          {/* Duration */}
                                          {shift.check_out_time && (
                                            <div className="mt-2 text-xs text-gray-500">
                                              Duration: {(() => {
                                                const duration = new Date(shift.check_out_time).getTime() - new Date(shift.check_in_time).getTime();
                                                const hours = Math.floor(duration / (1000 * 60 * 60));
                                                const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                                                return `${hours}h ${minutes}m`;
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            );
                          })()}
                        </TabsContent>

                        <TabsContent value="login" className="space-y-4 mt-6">
                          {account ? (
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">Username</Label>
                                    <p className="font-medium">{account.username}</p>
                                  </div>
                                  <Badge variant={account.user_status === 'active' ? "default" : "secondary"}>
                                    {account.user_status === 'active' ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-2">
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">Password</Label>
                                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">••••••••</p>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">Account Created</Label>
                                    <p className="text-sm">{staffMember.created_at}</p>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">User ID</Label>
                                    <p className="text-sm font-mono">{account.user_id}</p>
                                  </div>
                                </div>

                                <div className="flex space-x-2 mt-4">
                                  {!isReadOnly && (
                                    <Button variant="outline" size="sm" onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Update Credentials
                                    </Button>
                                  )}
                                  {!isReadOnly && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={saving}>
                                          Delete Login
                                        </Button>
                                      </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Login Account</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete the login account for "{staffMember.name}"? They will no longer be able to access the staff portal.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteStaff(staffMember.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          disabled={saving}
                                        >
                                          {saving ? 'Deleting...' : 'Delete Login'}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card>
                              <CardContent className="text-center py-12">
                                <Key className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500 mb-4">No login credentials set up for this staff member.</p>
                                {!isReadOnly && (
                                  <Button onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Create Login Account
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>

                        <TabsContent value="files" className="mt-6">
                          {!isReadOnly && (
                            <div className="mb-4">
                              <FileUpload
                                onUpload={(newAttachments) => updateStaffAttachments(staffMember.id, [...(staffMember.attachments || []), ...newAttachments])}
                                onAttachmentsChange={() => {}}
                                disabled={saving}
                              />
                            </div>
                          )}
                          
                          {(() => {
                            // Load shifts when tab is accessed to get check-in/out photos
                            if (!staffShifts[staffMember.id] && !loadingShifts[staffMember.id]) {
                              loadStaffShifts(staffMember.id);
                            }
                            
                            const shifts = staffShifts[staffMember.id] || [];
                            const attachments = staffMember.attachments || [];
                            
                            // Collect all check-in/out photos from shifts
                            const shiftPhotos: Array<{type: string, photo: string, date: string, shift_id: string, timestamp: number}> = [];
                            shifts.forEach((shift: any) => {
                              if (shift.check_in_photo) {
                                shiftPhotos.push({
                                  type: 'Check-in Photo',
                                  photo: shift.check_in_photo,
                                  date: new Date(shift.check_in_time).toLocaleString(),
                                  shift_id: shift.id,
                                  timestamp: new Date(shift.check_in_time).getTime()
                                });
                              }
                              if (shift.check_out_photo) {
                                shiftPhotos.push({
                                  type: 'Check-out Photo',
                                  photo: shift.check_out_photo,
                                  date: new Date(shift.check_out_time).toLocaleString(),
                                  shift_id: shift.id,
                                  timestamp: new Date(shift.check_out_time).getTime()
                                });
                              }
                            });
                            
                            // Sort photos by timestamp (newest first)
                            shiftPhotos.sort((a, b) => b.timestamp - a.timestamp);
                            
                            const hasFiles = attachments.length > 0 || shiftPhotos.length > 0;
                            
                            if (!hasFiles) {
                              return (
                                <Card>
                                  <CardContent className="text-center py-12">
                                    <Paperclip className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-500">No files or photos found.</p>
                                    <p className="text-sm text-gray-400 mt-2">Upload documents or check-in/out photos will appear here.</p>
                                  </CardContent>
                                </Card>
                              );
                            }
                            
                            return (
                              <div className="space-y-6">
                                {/* Check-in/out Photos Section */}
                                {shiftPhotos.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4" />
                                      Check-in/out Photos ({shiftPhotos.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {shiftPhotos.map((item, index) => (
                                        <Card key={`photo-${item.shift_id}-${index}`}>
                                          <CardContent className="p-4">
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Badge variant={item.type.includes('Check-in') ? 'default' : 'secondary'}>
                                                  {item.type}
                                                </Badge>
                                                <Eye className="w-4 h-4 text-gray-400" />
                                              </div>
                                              
                                              <div className="aspect-square relative">
                                                <ImageWithFallback
                                                  src={item.photo}
                                                  alt={item.type}
                                                  className="w-full h-full object-cover rounded border cursor-pointer hover:opacity-80"
                                                  onClick={() => window.open(item.photo, '_blank')}
                                                />
                                              </div>
                                              
                                              <div>
                                                <p className="text-xs text-gray-500">{item.date}</p>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Regular Attachments Section */}
                                {attachments.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                      <Paperclip className="w-4 h-4" />
                                      Documents & Files ({attachments.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {attachments.map((attachment, index) => (
                                        <Card key={`attachment-${index}`}>
                                          <CardContent className="p-4">
                                            <div className="flex items-center space-x-2">
                                              <Paperclip className="w-4 h-4 text-gray-400" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{attachment.name}</p>
                                                <p className="text-xs text-gray-500">{attachment.size} bytes • {attachment.type}</p>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TabsContent>
                      </Tabs>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}

// Export with error handler wrapper
export const StaffManagement = withErrorHandler(StaffManagementComponent);