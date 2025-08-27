import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Staff, StaffShift, FileAttachment, Customer, GameType, RollingRecord } from '../types';
import { LogIn, LogOut, Clock, CheckCircle, XCircle, Camera, Calendar, AlertCircle, Receipt, BarChart3, Info, Database, RefreshCw, Activity } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { StaffRollingRecorder } from './StaffRollingRecorder';
import { StaffRollingHistory } from './StaffRollingHistory';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/client';

interface StaffPortalProps extends WithErrorHandlerProps {
  user: User;
}

// Real-time refresh interval (30 seconds)
const REAL_TIME_REFRESH_INTERVAL = 30000;

function StaffPortalComponent({ user, showError, clearError }: StaffPortalProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gameTypes, setGameTypes] = useState<GameType[]>([]);
  const [currentStaffMember, setCurrentStaffMember] = useState<Staff | null>(null);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load real-time data from Supabase
  const loadRealTimeData = useCallback(async () => {
    try {
      setIsLoadingData(true);
      clearError();
      
      console.log('🔄 Loading real-time staff portal data from Supabase...');
      
      // Load all required data in parallel
      const [staffData, shiftsData, customersData, gameTypesData] = await Promise.all([
        db.get<Staff>('staff', []),
        db.get<StaffShift>('shifts', []),
        db.get<Customer>('customers', []),
        db.get<GameType>('gameTypes', [])
      ]);

      setStaff(staffData);
      setShifts(shiftsData);
      setCustomers(customersData);
      setGameTypes(gameTypesData);
      setLastDataUpdate(new Date());

      // Find current staff member
      if (user.staffId) {
        let staffMember = staffData.find((s: Staff) => s.id === user.staffId);
        
        if (!staffMember) {
          // Create a new staff record for this user if it doesn't exist
          staffMember = {
            id: user.staffId,
            name: `${user.username} (Auto-created)`,
            email: `${user.username}@casino.com`,
            phone: '+852-0000-0000',
            position: 'Staff Member',
            createdAt: new Date().toISOString().split('T')[0],
            isActive: true,
            attachments: []
          };
          
          const updatedStaff = [...staffData, staffMember];
          await db.save('staff', updatedStaff);
          setStaff(updatedStaff);
        }
        
        // Check for current shift
        const currentShift = shiftsData.find((shift: StaffShift) => 
          shift.staffId === staffMember.id && shift.status === 'checked-in'
        );
        
        if (currentShift) {
          staffMember = { ...staffMember, currentShift };
        }
        
        setCurrentStaffMember(staffMember);
      }

      console.log(`✅ Loaded real-time data: ${staffData.length} staff, ${customersData.length} customers, ${shiftsData.length} shifts`);
      
    } catch (error) {
      console.error('❌ Error loading real-time staff portal data:', error);
      showError(`Failed to load staff portal data: ${error.message}`);
    } finally {
      setIsLoadingData(false);
    }
  }, [user.staffId, clearError, showError]);

  // Initial data load and real-time sync
  useEffect(() => {
    loadRealTimeData();
    
    // Set up real-time refresh interval
    const refreshInterval = setInterval(() => {
      console.log('🔄 Real-time staff portal refresh triggered');
      loadRealTimeData();
    }, REAL_TIME_REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadRealTimeData]);

  const saveStaffToSupabase = async (updatedStaff: Staff[]) => {
    try {
      await db.save('staff', updatedStaff);
      setStaff(updatedStaff);
      console.log('✅ Staff data saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving staff data:', error);
      showError(`Failed to save staff data: ${error.message}`);
    }
  };

  const saveShiftsToSupabase = async (updatedShifts: StaffShift[]) => {
    try {
      await db.save('shifts', updatedShifts);
      setShifts(updatedShifts);
      console.log('✅ Shifts data saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving shifts data:', error);
      showError(`Failed to save shifts data: ${error.message}`);
    }
  };

  const isCheckedIn = () => {
    return currentStaffMember?.currentShift && currentStaffMember.currentShift.status === 'checked-in';
  };

  const handleCheckIn = async () => {
    if (!currentStaffMember || !checkInPhoto) return;

    setIsSaving(true);
    try {
      // Convert photo to base64
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
            staffId: currentStaffMember.id,
            checkInTime: new Date().toISOString(),
            checkInPhoto: photoAttachment,
            shiftDate: new Date().toISOString().split('T')[0],
            status: 'checked-in',
            notes: checkInNotes
          };

          const updatedShifts = [...shifts, newShift];
          await saveShiftsToSupabase(updatedShifts);

          // Update staff current shift
          const updatedStaff = staff.map(member =>
            member.id === currentStaffMember.id
              ? { ...member, currentShift: newShift }
              : member
          );
          await saveStaffToSupabase(updatedStaff);
          setCurrentStaffMember({ ...currentStaffMember, currentShift: newShift });

          setIsCheckInDialogOpen(false);
          setCheckInPhoto(null);
          setCheckInNotes('');
          
          // Refresh data after check-in
          await loadRealTimeData();
          
        } catch (error) {
          console.error('❌ Error during check-in:', error);
          showError(`Check-in failed: ${error.message}`);
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(checkInPhoto);
    } catch (error) {
      console.error('❌ Error during check-in:', error);
      showError(`Check-in failed: ${error.message}`);
      setIsSaving(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentStaffMember || !checkOutPhoto || !currentStaffMember.currentShift) return;

    setIsSaving(true);
    try {
      // Convert photo to base64
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
            ...currentStaffMember.currentShift!,
            checkOutTime: new Date().toISOString(),
            checkOutPhoto: photoAttachment,
            status: 'checked-out',
            notes: currentStaffMember.currentShift!.notes + (checkOutNotes ? `\nCheck-out: ${checkOutNotes}` : '')
          };

          const updatedShifts = shifts.map(shift =>
            shift.id === updatedShift.id ? updatedShift : shift
          );
          await saveShiftsToSupabase(updatedShifts);

          // Remove current shift from staff
          const updatedStaff = staff.map(member =>
            member.id === currentStaffMember.id
              ? { ...member, currentShift: undefined }
              : member
          );
          await saveStaffToSupabase(updatedStaff);
          setCurrentStaffMember({ ...currentStaffMember, currentShift: undefined });

          setIsCheckOutDialogOpen(false);
          setCheckOutPhoto(null);
          setCheckOutNotes('');
          
          // Refresh data after check-out
          await loadRealTimeData();
          
        } catch (error) {
          console.error('❌ Error during check-out:', error);
          showError(`Check-out failed: ${error.message}`);
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(checkOutPhoto);
    } catch (error) {
      console.error('❌ Error during check-out:', error);
      showError(`Check-out failed: ${error.message}`);
      setIsSaving(false);
    }
  };

  const getMyShifts = () => {
    if (!currentStaffMember) return [];
    return shifts
      .filter(shift => shift.staffId === currentStaffMember.id)
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())
      .slice(0, 10); // Show last 10 shifts
  };

  const myShifts = getMyShifts();

  const handleRollingRecordSaved = async (record: RollingRecord) => {
    // Refresh real-time data after saving a rolling record
    await loadRealTimeData();
  };

  // Show loading state
  if (isLoadingData && !currentStaffMember) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading real-time staff portal data from Supabase...</p>
        </div>
      </div>
    );
  }

  if (!currentStaffMember) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Staff Record Not Found</h3>
            <p className="text-gray-500 mb-4">
              Your staff record could not be found or created automatically.
            </p>
            <div className="text-left bg-gray-50 p-4 rounded-lg max-w-md mx-auto">
              <h4 className="font-medium text-sm text-gray-900 mb-2">Debug Information:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>User ID: {user.id}</li>
                <li>Staff ID: {user.staffId || 'Not assigned'}</li>
                <li>Username: {user.username}</li>
                <li>Role: {user.role}</li>
              </ul>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Please contact an administrator to create your staff record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Database Status */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="w-4 h-4 text-green-600 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                ✅ Real-time Staff Portal Connected to Supabase
              </p>
              <p className="text-xs text-green-600">
                Customer data, shifts, and rolling records sync automatically with cloud database
                {lastDataUpdate && ` • Last sync: ${lastDataUpdate.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isSaving && (
              <div className="flex items-center text-blue-600">
                <Activity className="w-4 h-4 mr-1 animate-pulse" />
                <span className="text-xs">Saving...</span>
              </div>
            )}
            {isLoadingData && (
              <div className="flex items-center text-orange-600">
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                <span className="text-xs">Syncing...</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadRealTimeData}
              disabled={isSaving || isLoadingData}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Staff Portal</h2>
          <p className="text-gray-600">
            Welcome, {currentStaffMember.name} - {currentStaffMember.position}
          </p>
          <div className="flex items-center space-x-4 mt-1">
            <Badge variant="outline" className="text-xs">
              {customers.filter(c => c.isActive).length} Active Customers
            </Badge>
            <Badge variant="outline" className="text-xs">
              Okada Casino Only
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {isCheckedIn() ? (
            <StaffRollingRecorder
              user={user}
              currentStaff={currentStaffMember}
              customers={customers}
              gameTypes={gameTypes}
              onRecordSaved={handleRollingRecordSaved}
            />
          ) : (
            <div className="text-right">
              <p className="text-sm text-gray-500">Check in to record rolling amounts</p>
              <p className="text-xs text-gray-400">Real-time customer data available after check-in</p>
            </div>
          )}
        </div>
      </div>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Current Status</span>
            {isCheckedIn() && (
              <Badge className="bg-green-100 text-green-800">
                <Activity className="w-3 h-3 mr-1" />
                Live Recording Available
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {isCheckedIn() ? (
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800 px-3 py-1">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      On Duty
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Since: {new Date(currentStaffMember.currentShift!.checkInTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Shift Date: {currentStaffMember.currentShift!.shiftDate} | 
                    Duration: {Math.floor((new Date().getTime() - new Date(currentStaffMember.currentShift!.checkInTime).getTime()) / (1000 * 60))} minutes
                  </div>
                  <div className="text-xs text-green-600">
                    ✅ Real-time rolling recording enabled with buy-in/buy-out tracking
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    <XCircle className="w-4 h-4 mr-1" />
                    Off Duty
                  </Badge>
                  <span className="text-sm text-gray-600">Ready to check in</span>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              {isCheckedIn() ? (
                <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Check Out
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Check Out</DialogTitle>
                      <DialogDescription>
                        Upload a photo as proof of check-out and add any end-of-shift notes. Data will be saved to Supabase.
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
                          disabled={isSaving}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          📸 Take a photo as proof of check-out (camera will open on mobile)
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="checkOutNotes">End of Shift Notes (Optional)</Label>
                        <Textarea
                          id="checkOutNotes"
                          value={checkOutNotes}
                          onChange={(e) => setCheckOutNotes(e.target.value)}
                          placeholder="Any end-of-shift notes or handover information..."
                          rows={3}
                          disabled={isSaving}
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsCheckOutDialogOpen(false)} disabled={isSaving}>
                          Cancel
                        </Button>
                        <Button onClick={handleCheckOut} disabled={!checkOutPhoto || isSaving}>
                          {isSaving ? (
                            <>
                              <Activity className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
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
              ) : (
                <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={isSaving}>
                      <LogIn className="w-4 h-4 mr-2" />
                      Check In
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Check In</DialogTitle>
                      <DialogDescription>
                        Upload a photo as proof of check-in and add any notes for the shift. Data will be saved to Supabase.
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
                          disabled={isSaving}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          📸 Take a photo as proof of check-in (camera will open on mobile)
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
                          disabled={isSaving}
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsCheckInDialogOpen(false)} disabled={isSaving}>
                          Cancel
                        </Button>
                        <Button onClick={handleCheckIn} disabled={!checkInPhoto || isSaving}>
                          {isSaving ? (
                            <>
                              <Activity className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
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
            </div>
          </div>

          {isCheckedIn() && currentStaffMember.currentShift?.notes && (
            <div className="mt-4 p-3 bg-green-50 rounded-md">
              <Label className="text-sm font-medium text-green-700">Current Shift Notes</Label>
              <p className="text-sm text-green-600 mt-1">{currentStaffMember.currentShift.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      {!isCheckedIn() && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800">
              <Info className="w-5 h-5" />
              <span>Enhanced Staff Portal Features</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700">
            <div className="space-y-3">
              <p className="text-sm">
                Welcome to the enhanced Staff Portal with real-time capabilities:
              </p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li><strong>Check In:</strong> Click "Check In" and upload a photo as proof of arrival</li>
                <li><strong>Real-time Rolling Recording:</strong> Record customer rolling amounts with mandatory buy-in/buy-out tracking</li>
                <li><strong>Okada Casino Integration:</strong> All recordings are automatically tagged with Okada Casino venue</li>
                <li><strong>Live Customer Data:</strong> Customer availability updates in real-time from cloud database</li>
                <li><strong>Admin Oversight:</strong> Buy-in/buy-out amounts required for complete financial tracking</li>
                <li><strong>Enhanced OCR:</strong> Upload receipts for automatic data extraction including cash flow</li>
              </ol>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-xs text-blue-600">
                  <strong>Note:</strong> All data is immediately saved to Supabase cloud database for real-time synchronization 
                  across all systems and admin oversight.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="shifts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shifts" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Recent Shifts</span>
          </TabsTrigger>
          <TabsTrigger value="rolling" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Rolling Records</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Recent Shifts</span>
                <Badge variant="outline" className="text-xs">
                  Real-time from Supabase
                </Badge>
              </CardTitle>
              <CardDescription>Your last 10 shifts with real-time updates</CardDescription>
            </CardHeader>
            <CardContent>
              {myShifts.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No shift history found.</p>
                  <p className="text-sm text-gray-400 mt-2">Your shifts will appear here once you start checking in.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myShifts.map((shift) => (
                    <Card key={shift.id} className="border-l-4 border-l-blue-400">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{shift.shiftDate}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={shift.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {shift.status === 'checked-in' ? 'On Duty' : 'Completed'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Supabase
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">Check-in Time</Label>
                            <p>{new Date(shift.checkInTime).toLocaleString()}</p>
                            {shift.checkInPhoto && (
                              <div className="mt-2">
                                <ImageWithFallback
                                  src={shift.checkInPhoto.data}
                                  alt="Check-in proof"
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              </div>
                            )}
                          </div>
                          
                          {shift.checkOutTime && (
                            <div>
                              <Label className="text-xs text-gray-500">Check-out Time</Label>
                              <p>{new Date(shift.checkOutTime).toLocaleString()}</p>
                              {shift.checkOutPhoto && (
                                <div className="mt-2">
                                  <ImageWithFallback
                                    src={shift.checkOutPhoto.data}
                                    alt="Check-out proof"
                                    className="w-16 h-16 object-cover rounded border"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {shift.notes && (
                          <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                            <Label className="text-gray-500">Notes</Label>
                            <p className="text-gray-700 mt-1">{shift.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rolling" className="mt-6">
          <StaffRollingHistory 
            user={user}
            currentStaff={currentStaffMember}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export with error handler wrapper
export const StaffPortal = withErrorHandler(StaffPortalComponent);