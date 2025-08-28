import React, { useState, useEffect } from 'react';
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
import { User, Staff, StaffShift, FileAttachment } from '../types';
import { FileUpload } from './FileUpload';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';
import { Plus, Edit, Mail, Phone, Shield, Clock, CheckCircle, ChevronDown, ChevronUp, LogIn, LogOut, Paperclip, Calendar, Key, UserPlus, Eye, EyeOff, Database, Save } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface StaffManagementProps extends WithErrorHandlerProps {
  user: User;
}

interface StaffAccount {
  id: string;
  username: string;
  password: string;
  role: 'staff';
  staffId: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

function StaffManagementComponent({ user, showError, clearError }: StaffManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [managingLoginStaff, setManagingLoginStaff] = useState<Staff | null>(null);
  const [checkingInStaff, setCheckingInStaff] = useState<Staff | null>(null);
  const [checkingOutStaff, setCheckingOutStaff] = useState<Staff | null>(null);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: ''
  });
  const [loginFormData, setLoginFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      clearError();
      
      console.log('🔄 Loading staff data from Supabase...');
      
      // Load all required data from Supabase
      const [staffData, staffAccountsData, shiftsData, usersData] = await Promise.all([
        db.get('staff', []),
        db.get('staff', []),
        db.get('staff_shifts', []),
        db.get('users', [])
      ]);

      // Process staff with backward compatibility
      const processedStaff = staffData.map((member: Staff) => {
        const { isAgent, agentId, permissions, ...cleanMember } = member as any;
        return {
          ...cleanMember,
          attachments: cleanMember.attachments || []
        };
      });

      setStaff(processedStaff);
      setStaffAccounts(staffAccountsData);
      setShifts(shiftsData);
      
      console.log(`✅ Loaded ${processedStaff.length} staff, ${staffAccountsData.length} accounts, ${shiftsData.length} shifts from Supabase`);
      
      // Ensure all staff have corresponding user accounts
      await syncStaffWithUsers(staffAccountsData, usersData);
      
    } catch (error) {
      console.error('❌ Error loading staff data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to load staff data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const syncStaffWithUsers = async (staffAccountsData: StaffAccount[], usersData: any[]) => {
    try {
      const defaultUsers = [
        { id: 'admin-1', username: 'admin', password: 'admin123', role: 'admin' },
        { id: 'agent-1', username: 'agent1', password: 'agent123', role: 'agent', agentId: 'agent-1' }
      ];
      
      const otherUsers = usersData.filter((u: any) => u.role !== 'staff');
      const staffUsers = staffAccountsData.map(account => ({
        id: account.id,
        username: account.username,
        password: account.password,
        role: account.role,
        staffId: account.staffId
      }));
      
      const newUsers = [...defaultUsers.filter(u => !otherUsers.find((o: any) => o.id === u.id)), ...otherUsers, ...staffUsers];
      await db.save('users', newUsers);
      
      console.log('✅ Synchronized staff accounts with users');
    } catch (error) {
      console.error('❌ Error syncing staff with users:', error);
      // Don't throw here as it's not critical for the main functionality
    }
  };

  const saveStaffToSupabase = async (updatedStaff: Staff[]) => {
    try {
      setSaving(true);
      clearError();
      
      console.log('💾 Saving staff to Supabase...');
      await db.save('staff', updatedStaff);
      
      setStaff(updatedStaff);
      console.log('✅ Successfully saved staff to Supabase');
      
    } catch (error) {
      console.error('❌ Error saving staff:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save staff data: ${errorMessage}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveStaffAccountsToSupabase = async (updatedAccounts: StaffAccount[]) => {
    try {
      clearError();
      
      console.log('💾 Saving staff accounts to Supabase...');
      await Promise.all([
        db.save('staffAccounts', updatedAccounts),
        syncStaffAccountsWithUsers(updatedAccounts)
      ]);
      
      setStaffAccounts(updatedAccounts);
      console.log('✅ Successfully saved staff accounts to Supabase');
      
    } catch (error) {
      console.error('❌ Error saving staff accounts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save staff account data: ${errorMessage}`);
      throw error;
    }
  };

  const syncStaffAccountsWithUsers = async (updatedAccounts: StaffAccount[]) => {
    try {
      const allUsers = await db.get('users', []);
      const otherUsers = allUsers.filter((u: any) => u.role !== 'staff');
      const staffUsers = updatedAccounts.map(account => ({
        id: account.id,
        username: account.username,
        password: account.password,
        role: account.role,
        staffId: account.staffId
      }));
      
      const newUsers = [...otherUsers, ...staffUsers];
      await db.save('users', newUsers);
    } catch (error) {
      console.error('❌ Error syncing staff accounts with users:', error);
      throw error;
    }
  };

  const saveShiftsToSupabase = async (updatedShifts: StaffShift[]) => {
    try {
      clearError();
      
      console.log('💾 Saving shifts to Supabase...');
      await db.save('shifts', updatedShifts);
      
      setShifts(updatedShifts);
      console.log('✅ Successfully saved shifts to Supabase');
      
    } catch (error) {
      console.error('❌ Error saving shifts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save shift data: ${errorMessage}`);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let updatedStaff: Staff[];

      if (editingStaff) {
        // Update existing staff
        updatedStaff = staff.map(member =>
          member.id === editingStaff.id
            ? { ...member, ...formData }
            : member
        );
      } else {
        // Add new staff
        const newStaffId = `staff-${Date.now()}`;
        const newStaff: Staff = {
          id: newStaffId,
          ...formData,
          createdAt: new Date().toISOString().split('T')[0],
          isActive: true,
          attachments: []
        };
        updatedStaff = [...staff, newStaff];
      }

      await saveStaffToSupabase(updatedStaff);
      resetForm();
      
    } catch (error) {
      // Error already handled in save function
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!managingLoginStaff) return;

    if (loginFormData.password !== loginFormData.confirmPassword) {
      showError('Passwords do not match!');
      return;
    }

    // Check if username already exists (excluding current account if editing)
    const existingAccount = staffAccounts.find(
      account => account.username === loginFormData.username && 
      account.staffId !== managingLoginStaff.id
    );

    if (existingAccount) {
      showError('Username already exists! Please choose a different username.');
      return;
    }

    try {
      const existingAccountIndex = staffAccounts.findIndex(
        account => account.staffId === managingLoginStaff.id
      );

      let updatedAccounts: StaffAccount[];

      if (existingAccountIndex >= 0) {
        // Update existing account
        updatedAccounts = [...staffAccounts];
        updatedAccounts[existingAccountIndex] = {
          ...updatedAccounts[existingAccountIndex],
          username: loginFormData.username,
          password: loginFormData.password
        };
      } else {
        // Create new account
        const newAccount: StaffAccount = {
          id: `account-${Date.now()}`,
          username: loginFormData.username,
          password: loginFormData.password,
          role: 'staff',
          staffId: managingLoginStaff.id,
          isActive: true,
          createdAt: new Date().toISOString().split('T')[0]
        };
        updatedAccounts = [...staffAccounts, newAccount];
      }

      await saveStaffAccountsToSupabase(updatedAccounts);
      resetLoginForm();
      
    } catch (error) {
      // Error already handled in save function
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      position: ''
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

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      phone: staffMember.phone,
      position: staffMember.position
    });
    setIsDialogOpen(true);
  };

  const handleManageLogin = (staffMember: Staff) => {
    setManagingLoginStaff(staffMember);
    const existingAccount = staffAccounts.find(account => account.staffId === staffMember.id);
    
    if (existingAccount) {
      setLoginFormData({
        username: existingAccount.username,
        password: existingAccount.password,
        confirmPassword: existingAccount.password
      });
    } else {
      setLoginFormData({
        username: '',
        password: '',
        confirmPassword: ''
      });
    }
    setIsLoginDialogOpen(true);
  };

  const deleteStaffAccount = async (staffId: string) => {
    try {
      const updatedAccounts = staffAccounts.filter(account => account.staffId !== staffId);
      await saveStaffAccountsToSupabase(updatedAccounts);
    } catch (error) {
      // Error already handled in save function
    }
  };

  const toggleStaffExpansion = (staffId: string) => {
    setExpandedStaff(expandedStaff === staffId ? null : staffId);
  };

  const toggleStaffStatus = async (staffId: string) => {
    try {
      const updatedStaff = staff.map(member =>
        member.id === staffId
          ? { ...member, isActive: !member.isActive }
          : member
      );

      const updatedAccounts = staffAccounts.map(account =>
        account.staffId === staffId
          ? { ...account, isActive: !account.isActive }
          : account
      );

      await Promise.all([
        saveStaffToSupabase(updatedStaff),
        saveStaffAccountsToSupabase(updatedAccounts)
      ]);
      
    } catch (error) {
      // Error already handled in save functions
    }
  };

  const openCheckInDialog = (staffMember: Staff) => {
    setCheckingInStaff(staffMember);
    setCheckInPhoto(null);
    setCheckInNotes('');
    setIsCheckInDialogOpen(true);
  };

  const openCheckOutDialog = (staffMember: Staff) => {
    setCheckingOutStaff(staffMember);
    setCheckOutPhoto(null);
    setCheckOutNotes('');
    setIsCheckOutDialogOpen(true);
  };

  const handleCheckIn = async () => {
    if (!checkingInStaff || !checkInPhoto) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoAttachment: FileAttachment = {
            id: `photo_${Date.now()}`,
            name: checkInPhoto!.name,
            size: checkInPhoto!.size,
            type: checkInPhoto!.type,
            data: e.target?.result as string,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.username
          };

          const newShift: StaffShift = {
            id: `shift_${Date.now()}`,
            staffId: checkingInStaff.id,
            checkInTime: new Date().toISOString(),
            checkInPhoto: photoAttachment,
            shiftDate: new Date().toISOString().split('T')[0],
            status: 'checked-in',
            notes: checkInNotes
          };

          const updatedShifts = [...shifts, newShift];
          const updatedStaff = staff.map(member =>
            member.id === checkingInStaff.id
              ? { ...member, currentShift: newShift }
              : member
          );

          await Promise.all([
            saveShiftsToSupabase(updatedShifts),
            saveStaffToSupabase(updatedStaff)
          ]);

          setIsCheckInDialogOpen(false);
          setCheckingInStaff(null);
          setCheckInPhoto(null);
          setCheckInNotes('');
          
        } catch (error) {
          console.error('❌ Error processing check-in:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          showError(`Failed to process check-in: ${errorMessage}`);
        }
      };
      reader.readAsDataURL(checkInPhoto);
    } catch (error) {
      console.error('❌ Error during check-in:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Check-in failed: ${errorMessage}`);
    }
  };

  const handleCheckOut = async () => {
    if (!checkingOutStaff || !checkOutPhoto || !checkingOutStaff.currentShift) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoAttachment: FileAttachment = {
            id: `photo_${Date.now()}`,
            name: checkOutPhoto!.name,
            size: checkOutPhoto!.size,
            type: checkOutPhoto!.type,
            data: e.target?.result as string,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.username
          };

          const updatedShift: StaffShift = {
            ...checkingOutStaff.currentShift!,
            checkOutTime: new Date().toISOString(),
            checkOutPhoto: photoAttachment,
            status: 'checked-out',
            notes: checkingOutStaff.currentShift!.notes + (checkOutNotes ? `\nCheck-out: ${checkOutNotes}` : '')
          };

          const updatedShifts = shifts.map(shift =>
            shift.id === updatedShift.id ? updatedShift : shift
          );

          const updatedStaff = staff.map(member =>
            member.id === checkingOutStaff.id
              ? { ...member, currentShift: undefined }
              : member
          );

          await Promise.all([
            saveShiftsToSupabase(updatedShifts),
            saveStaffToSupabase(updatedStaff)
          ]);

          setIsCheckOutDialogOpen(false);
          setCheckingOutStaff(null);
          setCheckOutPhoto(null);
          setCheckOutNotes('');
          
        } catch (error) {
          console.error('❌ Error processing check-out:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          showError(`Failed to process check-out: ${errorMessage}`);
        }
      };
      reader.readAsDataURL(checkOutPhoto);
    } catch (error) {
      console.error('❌ Error during check-out:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Check-out failed: ${errorMessage}`);
    }
  };

  const getStaffShifts = (staffId: string) => {
    return shifts
      .filter(shift => shift.staffId === staffId)
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
  };

  const isStaffCheckedIn = (staffMember: Staff) => {
    return staffMember.currentShift && staffMember.currentShift.status === 'checked-in';
  };

  const updateStaffAttachments = async (staffId: string, attachments: FileAttachment[]) => {
    try {
      const updatedStaff = staff.map(member =>
        member.id === staffId
          ? { ...member, attachments }
          : member
      );
      
      await saveStaffToSupabase(updatedStaff);
    } catch (error) {
      // Error already handled in save function
    }
  };

  const getStaffAccount = (staffId: string) => {
    return staffAccounts.find(account => account.staffId === staffId);
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
      {/* Database Status Indicator */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center">
          <Database className="w-4 h-4 text-green-600 mr-2" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              ✅ Connected to Supabase Database
            </p>
            <p className="text-xs text-green-600">
              All staff data is immediately saved to cloud database
            </p>
          </div>
          {saving && (
            <div className="flex items-center text-blue-600">
              <Save className="w-4 h-4 mr-1 animate-pulse" />
              <span className="text-xs">Saving...</span>
            </div>
          )}
        </div>
      </div>

      {/* Admin Control Panel */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center">
          <Key className="w-5 h-5 text-amber-600 mr-2" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Staff Login Management - Admin Only
            </p>
            <p className="text-xs text-amber-600">
              You can create, edit, and manage staff login credentials. Staff members can only login with the credentials you provide.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-gray-600">
            Manage casino staff, their login credentials, and shift tracking with photo verification
          </p>
        </div>
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
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Staff member name"
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    placeholder="Floor Manager, Cashier, etc."
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="staff@casino.com"
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1234567890"
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> After creating a staff member, you'll need to set up their login credentials separately using the "Manage Login" button.
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
      </div>

      {/* Login Management Dialog */}
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

      {/* Check-in Dialog */}
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

      {/* Check-out Dialog */}
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
            const staffShifts = getStaffShifts(staffMember.id);
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
                            <Badge variant={staffMember.isActive ? "default" : "secondary"}>
                              {staffMember.isActive ? 'Active' : 'Inactive'}
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
                            {staffMember.position} • Member since {staffMember.createdAt}
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
                      <Button variant="outline" size="sm" onClick={() => handleEdit(staffMember)} disabled={saving}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      
                      <Button variant="outline" size="sm" onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                        <Key className="w-4 h-4 mr-2" />
                        {account ? 'Update Login' : 'Create Login'}
                      </Button>

                      {isCheckedIn ? (
                        <Button variant="outline" size="sm" onClick={() => openCheckOutDialog(staffMember)} disabled={saving}>
                          <LogOut className="w-4 h-4 mr-2" />
                          Check Out
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openCheckInDialog(staffMember)} disabled={saving}>
                          <LogIn className="w-4 h-4 mr-2" />
                          Check In
                        </Button>
                      )}

                      {staffMember.isActive ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={saving}>
                              Deactivate
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deactivate "{staffMember.name}"? They will no longer be able to login to the system, but their data and shift history will be preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleStaffStatus(staffMember.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={saving}
                              >
                                {saving ? 'Saving...' : 'Deactivate'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button 
                          variant="default"
                          size="sm"
                          onClick={() => toggleStaffStatus(staffMember.id)}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Activate'}
                        </Button>
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
                            <span>Shifts ({staffShifts.length})</span>
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
                                <Badge variant={staffMember.isActive ? "default" : "secondary"}>
                                  {staffMember.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                                <p>{staffMember.createdAt}</p>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="shifts" className="space-y-4 mt-6">
                          {staffShifts.length === 0 ? (
                            <Card>
                              <CardContent className="text-center py-12">
                                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500">No shift history found.</p>
                                <p className="text-sm text-gray-400 mt-2">Check-ins and check-outs will appear here.</p>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="space-y-4">
                              {staffShifts.slice(0, 5).map((shift) => (
                                <Card key={shift.id}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-4">
                                      <div>
                                        <p className="font-medium">{shift.shiftDate}</p>
                                        <Badge 
                                          variant={shift.status === 'checked-in' ? 'default' : 'secondary'}
                                          className={shift.status === 'checked-in' ? 'bg-green-600' : ''}
                                        >
                                          {shift.status === 'checked-in' ? 'Currently Checked In' : 'Completed Shift'}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium text-gray-500">Check In</Label>
                                        <p className="text-sm">{new Date(shift.checkInTime).toLocaleString()}</p>
                                        {shift.checkInPhoto && (
                                          <div className="mt-2">
                                            <ImageWithFallback
                                              src={shift.checkInPhoto.data}
                                              alt="Check-in photo"
                                              className="w-20 h-20 object-cover rounded border"
                                            />
                                          </div>
                                        )}
                                      </div>
                                      
                                      {shift.checkOutTime && (
                                        <div>
                                          <Label className="text-sm font-medium text-gray-500">Check Out</Label>
                                          <p className="text-sm">{new Date(shift.checkOutTime).toLocaleString()}</p>
                                          {shift.checkOutPhoto && (
                                            <div className="mt-2">
                                              <ImageWithFallback
                                                src={shift.checkOutPhoto.data}
                                                alt="Check-out photo"
                                                className="w-20 h-20 object-cover rounded border"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {shift.notes && (
                                      <div className="mt-4">
                                        <Label className="text-sm font-medium text-gray-500">Notes</Label>
                                        <p className="text-sm bg-gray-50 p-2 rounded mt-1">{shift.notes}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                              
                              {staffShifts.length > 5 && (
                                <p className="text-sm text-gray-500 text-center">
                                  Showing recent 5 shifts out of {staffShifts.length} total shifts.
                                </p>
                              )}
                            </div>
                          )}
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
                                  <Badge variant={account.isActive ? "default" : "secondary"}>
                                    {account.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-2">
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">Password</Label>
                                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">••••••••</p>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-gray-500">Account Created</Label>
                                    <p className="text-sm">{account.createdAt}</p>
                                  </div>
                                  
                                  {account.lastLogin && (
                                    <div>
                                      <Label className="text-sm font-medium text-gray-500">Last Login</Label>
                                      <p className="text-sm">{new Date(account.lastLogin).toLocaleString()}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex space-x-2 mt-4">
                                  <Button variant="outline" size="sm" onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Update Credentials
                                  </Button>
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
                                          onClick={() => deleteStaffAccount(staffMember.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          disabled={saving}
                                        >
                                          {saving ? 'Deleting...' : 'Delete Login'}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card>
                              <CardContent className="text-center py-12">
                                <Key className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500 mb-4">No login credentials set up for this staff member.</p>
                                <Button onClick={() => handleManageLogin(staffMember)} disabled={saving}>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Create Login Account
                                </Button>
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>

                        <TabsContent value="files" className="mt-6">
                          <div className="mb-4">
                            <FileUpload
                              onUpload={(newAttachments) => updateStaffAttachments(staffMember.id, [...(staffMember.attachments || []), ...newAttachments])}
                              onAttachmentsChange={() => {}}
                              disabled={saving}
                            />
                          </div>
                          
                          {!staffMember.attachments || staffMember.attachments.length === 0 ? (
                            <Card>
                              <CardContent className="text-center py-12">
                                <Paperclip className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500">No files attached to this staff member.</p>
                                <p className="text-sm text-gray-400 mt-2">Upload documents, photos, or other files related to this staff member.</p>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {staffMember.attachments.map((attachment, index) => (
                                <Card key={index}>
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
                          )}
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