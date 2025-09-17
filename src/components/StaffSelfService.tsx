import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Staff, StaffShift } from '../types';
import { Clock, CheckCircle, XCircle, RefreshCw, LogIn, LogOut, Activity, Calendar, MapPin, Users } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { apiClient } from '../utils/api/apiClient';

interface StaffSelfServiceProps extends WithErrorHandlerProps {
  user: User;
}

function StaffSelfServiceComponent({ user, showError, clearError }: StaffSelfServiceProps) {
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [assignedTrips, setAssignedTrips] = useState<any[]>([]);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load staff data and shifts
  const loadStaffData = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();

      // Use staff_id from user object (user.id is users table ID, user.staff_id is staff table ID)
      const staffId = (user as any).staff_id || user.id;
      console.log('Loading staff data for staff ID:', staffId, 'User ID:', user.id);

      // Get current staff info
      const staffResponse = await apiClient.get(`/staffs/${staffId}`);
      if (staffResponse.success) {
        setCurrentStaff(staffResponse.data);
      }

      // Get staff shifts history
      const shiftsResponse = await apiClient.get(`/staffs/${staffId}/shifts`);
      if (shiftsResponse.success) {
        setShifts(shiftsResponse.data);
      }

      // Get assigned trips (staff can only see their assigned trips)
      const tripsResponse = await apiClient.get('/trips/my-schedule');
      if (tripsResponse.success) {
        setAssignedTrips(tripsResponse.data);
      }

    } catch (error) {
      console.error('Error loading staff data:', error);
      showError('Failed to load staff data');
    } finally {
      setIsLoading(false);
    }
  }, [user, clearError, showError]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  const getCurrentShift = () => {
    return shifts.find(shift => shift.status === 'checked-in');
  };

  const isCheckedIn = () => {
    return getCurrentShift() !== undefined;
  };

  const handleCheckIn = async () => {
    if (!checkInPhoto) return;

    setIsSaving(true);
    try {
      // Convert photo to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoData = e.target?.result as string;
          
          const staffId = (user as any).staff_id || user.id;
          const response = await apiClient.post(`/staffs/${staffId}/check-in`, {
            check_in_photo: photoData,
            notes: checkInNotes
          });

          if (response.success) {
            setIsCheckInDialogOpen(false);
            setCheckInPhoto(null);
            setCheckInNotes('');
            await loadStaffData(); // Refresh data
          } else {
            showError('Check-in failed: ' + response.message);
          }
        } catch (error) {
          console.error('Check-in error:', error);
          showError('Check-in failed');
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(checkInPhoto);
    } catch (error) {
      console.error('Check-in error:', error);
      showError('Check-in failed');
      setIsSaving(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutPhoto) return;

    setIsSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoData = e.target?.result as string;
          
          const staffId = (user as any).staff_id || user.id;
          const response = await apiClient.post(`/staffs/${staffId}/check-out`, {
            check_out_photo: photoData,
            notes: checkOutNotes
          });

          if (response.success) {
            setIsCheckOutDialogOpen(false);
            setCheckOutPhoto(null);
            setCheckOutNotes('');
            await loadStaffData(); // Refresh data
          } else {
            showError('Check-out failed: ' + response.message);
          }
        } catch (error) {
          console.error('Check-out error:', error);
          showError('Check-out failed');
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(checkOutPhoto);
    } catch (error) {
      console.error('Check-out error:', error);
      showError('Check-out failed');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading staff information...</p>
        </div>
      </div>
    );
  }

  const currentShift = getCurrentShift();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Staff Self-Service</h2>
          <p className="text-gray-600">
            Welcome, {currentStaff?.name || user.username}
          </p>
          <div className="flex items-center space-x-4 mt-1">
            <Badge variant="outline" className="text-xs">
              Staff ID: {user.id}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {assignedTrips.length} Assigned Trips
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={loadStaffData} disabled={isLoading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Current Status</span>
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
                      Since: {new Date((currentShift as any)!.check_in_time).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Shift Date: {(currentShift as any)!.shift_date} | 
                    Duration: {Math.floor((new Date().getTime() - new Date((currentShift as any)!.check_in_time).getTime()) / (1000 * 60))} minutes
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
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <Label htmlFor="checkOutNotes">End of Shift Notes (Optional)</Label>
                        <Textarea
                          id="checkOutNotes"
                          value={checkOutNotes}
                          onChange={(e) => setCheckOutNotes(e.target.value)}
                          placeholder="Any end-of-shift notes..."
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
                          disabled={isSaving}
                        />
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
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips" className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>My Trips</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>My Shifts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>Assigned Trips</span>
              </CardTitle>
              <CardDescription>Trips you are assigned to manage</CardDescription>
            </CardHeader>
            <CardContent>
              {assignedTrips.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No trips assigned.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedTrips.map((trip) => (
                    <Card key={trip.id} className="border-l-4 border-l-blue-400">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{trip.trip_name}</h4>
                          </div>
                          <Badge className={
                            trip.status === 'active' ? 'bg-green-100 text-green-800' :
                            trip.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {trip.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">Destination</Label>
                            <p>{trip.destination}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Dates</Label>
                            <p>{new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {trip.activecustomerscount > 0 && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {trip.activecustomerscount} Active Customers
                            </Badge>
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

        <TabsContent value="shifts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Shift History</span>
              </CardTitle>
              <CardDescription>Your recent shifts and attendance</CardDescription>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No shift history found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shifts.slice(0, 10).map((shift) => (
                    <Card key={shift.id} className="border-l-4 border-l-blue-400">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{(shift as any).shift_date}</span>
                          </div>
                          <Badge className={shift.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {shift.status === 'checked-in' ? 'On Duty' : 'Completed'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">Check-in Time</Label>
                            <p>{new Date((shift as any).check_in_time).toLocaleString()}</p>
                            {(shift as any).check_in_photo && (
                              <div className="mt-2">
                                <ImageWithFallback
                                  src={(shift as any).check_in_photo}
                                  alt="Check-in proof"
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              </div>
                            )}
                          </div>
                          
                          {(shift as any).check_out_time && (
                            <div>
                              <Label className="text-xs text-gray-500">Check-out Time</Label>
                              <p>{new Date((shift as any).check_out_time).toLocaleString()}</p>
                              {(shift as any).check_out_photo && (
                                <div className="mt-2">
                                  <ImageWithFallback
                                    src={(shift as any).check_out_photo}
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
      </Tabs>
    </div>
  );
}

export const StaffSelfService = withErrorHandler(StaffSelfServiceComponent);
