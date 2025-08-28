import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { User } from '../types';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';
import { Plus, Edit, Shield, Key, Eye, EyeOff, ChevronDown, ChevronUp, Database, Save, Trash2, UserPlus, Crown, AlertTriangle, RefreshCw, Sparkles, CheckCircle } from 'lucide-react';

interface AdminAccount {
  id: string;
  username: string;
  password: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  createdBy?: string;
}

interface AdminManagementProps extends WithErrorHandlerProps {
  user: User;
}

function AdminManagementComponent({ user, showError, clearError }: AdminManagementProps) {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      clearError();
      
      console.log('🔄 Loading admin accounts from Supabase...');
      
      // Load admin users from Supabase
      const usersData = await db.get('users', []);
      const adminUsers = usersData.filter((u: any) => u.role === 'admin');
      
      // Transform to AdminAccount format
      const adminAccounts: AdminAccount[] = adminUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password || '',
        role: 'admin',
        isActive: u.isActive !== false, // Default to true if not specified
        createdAt: u.createdAt || new Date().toISOString().split('T')[0],
        lastLogin: u.lastLogin,
        createdBy: u.createdBy
      }));

      setAdmins(adminAccounts);
      
      console.log(`✅ Loaded ${adminAccounts.length} admin accounts from Supabase`);
      
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
      showError(`Failed to load admin data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const saveAdminsToSupabase = async (updatedAdmins: AdminAccount[]) => {
    try {
      setSaving(true);
      clearError();
      
      console.log('💾 Saving admin accounts to Supabase...');
      
      // Get all users data
      const allUsers = await db.get('users', []);
      
      // Filter out admin users and replace with updated ones
      const otherUsers = allUsers.filter((u: any) => u.role !== 'admin');
      const adminUsers = updatedAdmins.map(admin => ({
        id: admin.id,
        username: admin.username,
        password: admin.password,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
        createdBy: admin.createdBy
      }));
      
      // Save updated users list
      const newUsers = [...otherUsers, ...adminUsers];
      await db.save('users', newUsers);
      
      setAdmins(updatedAdmins);
      console.log('✅ Successfully saved admin accounts to Supabase');
      
    } catch (error) {
      console.error('❌ Error saving admin accounts:', error);
      showError(`Failed to save admin data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      if (!formData.username.trim()) {
        showError('Username is required!');
        return;
      }

      if (!formData.password.trim()) {
        showError('Password is required!');
        return;
      }

      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match!');
        return;
      }

      // Check if username already exists (excluding current admin if editing)
      const existingAdmin = admins.find(
        admin => admin.username === formData.username && 
        admin.id !== editingAdmin?.id
      );

      if (existingAdmin) {
        showError('Username already exists! Please choose a different username.');
        return;
      }

      let updatedAdmins: AdminAccount[];

      if (editingAdmin) {
        // Update existing admin
        updatedAdmins = admins.map(admin =>
          admin.id === editingAdmin.id
            ? { 
                ...admin, 
                username: formData.username,
                password: formData.password
              }
            : admin
        );
        console.log(`🔄 Updating admin account: ${editingAdmin.username} -> ${formData.username}`);
      } else {
        // Add new admin
        const newAdmin: AdminAccount = {
          id: `admin_${Date.now()}`,
          username: formData.username,
          password: formData.password,
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString().split('T')[0],
          createdBy: user.username
        };
        updatedAdmins = [...admins, newAdmin];
        console.log(`➕ Creating new admin account: ${formData.username}`);
      }

      // Save immediately to Supabase
      await saveAdminsToSupabase(updatedAdmins);

      // Reset form and close dialog
      resetForm();
      
    } catch (error) {
      // Error already handled in saveAdminsToSupabase
      // Don't close dialog if save failed
    }
  };

  const handleEdit = (admin: AdminAccount) => {
    setEditingAdmin(admin);
    setFormData({
      username: admin.username,
      password: admin.password,
      confirmPassword: admin.password
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (adminId: string) => {
    try {
      // Prevent deleting the last admin or current admin
      if (admins.length <= 1) {
        showError('Cannot delete the last admin account!');
        return;
      }

      const adminToDelete = admins.find(a => a.id === adminId);
      if (adminToDelete?.username === user.username) {
        showError('Cannot delete your own admin account!');
        return;
      }

      console.log(`🗑️ Deleting admin account: ${adminToDelete?.username}`);
      const updatedAdmins = admins.filter(admin => admin.id !== adminId);
      await saveAdminsToSupabase(updatedAdmins);
      
    } catch (error) {
      // Error already handled in saveAdminsToSupabase
    }
  };

  const toggleAdminStatus = async (adminId: string) => {
    try {
      // Prevent deactivating the last active admin or current admin
      const adminToToggle = admins.find(a => a.id === adminId);
      if (adminToToggle?.username === user.username) {
        showError('Cannot deactivate your own admin account!');
        return;
      }

      const activeAdmins = admins.filter(a => a.isActive && a.id !== adminId);
      if (activeAdmins.length === 0) {
        showError('Cannot deactivate the last active admin account!');
        return;
      }

      console.log(`🔄 Toggling admin status: ${adminToToggle?.username}`);
      const updatedAdmins = admins.map(admin =>
        admin.id === adminId
          ? { ...admin, isActive: !admin.isActive }
          : admin
      );
      
      await saveAdminsToSupabase(updatedAdmins);
    } catch (error) {
      // Error already handled in saveAdminsToSupabase
    }
  };

  const toggleAdminExpansion = (adminId: string) => {
    setExpandedAdmin(expandedAdmin === adminId ? null : adminId);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
    setEditingAdmin(null);
    setIsDialogOpen(false);
    setShowPassword(false);
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({
      ...formData,
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
          <p className="text-sm text-gray-600">Loading admin accounts from Supabase...</p>
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
              ✅ Admin Login CRUD - Supabase Connected
            </p>
            <p className="text-xs text-green-600">
              All admin login changes are immediately saved to Supabase database. These credentials control system access.
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

      {/* Admin Credentials Management Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Admin Login Management:</strong> This section controls the login credentials for admin access. 
          The system starts with <code className="bg-blue-100 px-1 rounded text-blue-900">admin / admin@8888</code> as the default credentials. 
          You can Create, Read, Update, and Delete admin accounts here. All changes are stored in Supabase.
          <Button
            onClick={loadAdminData}
            size="sm"
            variant="outline"
            className="ml-3 text-blue-800 border-blue-300 hover:bg-blue-100"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </AlertDescription>
      </Alert>

      {/* Security Warning */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start">
          <Crown className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Security Notice
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Admin accounts have full system access including customer data, financial records, and system settings.
              Ensure passwords are strong and only share credentials with authorized administrators.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Admin Login Credentials (CRUD)</h2>
          <p className="text-gray-600">
            Create, Read, Update, and Delete admin login credentials stored in Supabase
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Default admin credentials: admin / admin@8888 (can be modified)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)} disabled={saving}>
              <Plus className="w-4 h-4 mr-2" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>{editingAdmin ? 'Update Admin Credentials' : 'Create New Admin Account'}</span>
              </DialogTitle>
              <DialogDescription>
                {editingAdmin ? 'Update administrator login credentials in Supabase' : 'Create a new administrator account with login credentials'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="Enter admin username"
                  required
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This username will be used to login to the admin portal
                </p>
              </div>
              
              <div>
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Enter secure password"
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
                    Minimum 8 characters recommended
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="Confirm password"
                  required
                  disabled={saving}
                />
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">
                  <strong>Security Warning:</strong> Admin credentials provide full system access. Changes are immediately saved to Supabase and will affect login access.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
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
                      <Shield className="w-4 h-4 mr-2" />
                      {editingAdmin ? 'Update' : 'Create'} Admin
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {admins.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Admin Accounts Found</h3>
              <p className="text-gray-500 mb-4">
                The default admin account (admin/admin@8888) should be present. Try refreshing the data.
              </p>
              <Button onClick={loadAdminData} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        ) : (
          admins.map((admin) => {
            const isExpanded = expandedAdmin === admin.id;
            const isCurrentUser = admin.username === user.username;
            const isDefaultAdmin = admin.username === 'admin' && admin.password === 'admin@8888';
            
            return (
              <Collapsible key={admin.id} open={isExpanded} onOpenChange={() => toggleAdminExpansion(admin.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center space-x-2">
                            <span>{admin.username}</span>
                            <Badge variant={admin.isActive ? "default" : "secondary"}>
                              {admin.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Crown className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>

                            {isCurrentUser && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <UserPlus className="w-3 h-3 mr-1" />
                                You
                              </Badge>
                            )}

                            {isDefaultAdmin && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Created {admin.createdAt}
                            {admin.createdBy && ` • Created by ${admin.createdBy}`}
                            {isDefaultAdmin && ' • Default admin credentials (editable)'}
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
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(admin)} disabled={saving}>
                        <Edit className="w-4 h-4 mr-2" />
                        Update Credentials
                      </Button>

                      {!isCurrentUser && admin.isActive ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={saving}>
                              Deactivate
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate Admin Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deactivate the admin account for "{admin.username}"? 
                                Deactivated administrators will not be able to login to the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleAdminStatus(admin.id)}
                                className="bg-yellow-600 text-white hover:bg-yellow-700"
                                disabled={saving}
                              >
                                {saving ? 'Saving...' : 'Deactivate Account'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : !isCurrentUser && !admin.isActive ? (
                        <Button 
                          variant="default"
                          size="sm"
                          onClick={() => toggleAdminStatus(admin.id)}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Activate'}
                        </Button>
                      ) : null}

                      {!isCurrentUser && admins.length > 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={saving}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Admin Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete the admin account for "{admin.username}"? 
                                This action cannot be undone and will immediately revoke all system access.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(admin.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={saving}
                              >
                                {saving ? 'Deleting...' : 'Delete Account'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>

                    {isCurrentUser && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                        <p className="text-xs text-blue-700">
                          <strong>Current Account:</strong> This is your active admin account. You cannot deactivate or delete your own account for security reasons, but you can update the credentials.
                        </p>
                      </div>
                    )}

                    {isDefaultAdmin && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <p className="text-xs text-green-700">
                          <strong>Default Admin:</strong> This is the system default admin account with preset credentials. 
                          You can update both the username and password using the "Update Credentials" button above. Changes are saved to Supabase immediately.
                        </p>
                      </div>
                    )}

                    <CollapsibleContent className="mt-6">
                      <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="info" className="flex items-center space-x-2">
                            <Shield className="w-4 h-4" />
                            <span>Account Information</span>
                          </TabsTrigger>
                          <TabsTrigger value="security" className="flex items-center space-x-2">
                            <Key className="w-4 h-4" />
                            <span>Security & CRUD</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="info" className="space-y-4 mt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Username</Label>
                                <p className="text-lg font-mono">{admin.username}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Role</Label>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  <Crown className="w-3 h-3 mr-1" />
                                  Administrator
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Account Status</Label>
                                <Badge variant={admin.isActive ? "default" : "secondary"}>
                                  {admin.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Created Date</Label>
                                <p>{admin.createdAt}</p>
                              </div>
                              {admin.createdBy && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Created By</Label>
                                  <p>{admin.createdBy}</p>
                                </div>
                              )}
                              {admin.lastLogin && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Last Login</Label>
                                  <p>{new Date(admin.lastLogin).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="security" className="space-y-4 mt-6">
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-500">Login Credentials (CRUD)</Label>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-mono bg-gray-100 p-2 rounded flex-1">
                                  {admin.username} / ••••••••••••
                                </p>
                                <Button variant="outline" size="sm" onClick={() => handleEdit(admin)} disabled={saving}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Update
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                <CheckCircle className="w-3 h-3 inline mr-1 text-green-600" />
                                Full CRUD operations available - Create, Read, Update, Delete admin credentials stored in Supabase
                              </p>
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Admin Permissions</p>
                                  <ul className="text-xs text-gray-600 mt-2 space-y-1">
                                    <li>• Full CRUD access to admin login credentials</li>
                                    <li>• Complete system administration access</li>
                                    <li>• Customer and agent management</li>
                                    <li>• Staff administration and monitoring</li>
                                    <li>• Financial reports and analytics</li>
                                    <li>• Database management and backups</li>
                                    <li>• System configuration and settings</li>
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-green-700">
                                <strong>Supabase Integration:</strong> All admin credentials are stored securely in Supabase with real-time synchronization. 
                                Changes to login credentials take effect immediately and are reflected across all system components.
                              </p>
                            </div>
                          </div>
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

// Export both as named and default export for compatibility
export const AdminManagement = withErrorHandler(AdminManagementComponent);
export default AdminManagement;