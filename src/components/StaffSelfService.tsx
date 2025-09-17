import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { User, Staff, StaffShift } from '../types';
import { Clock, CheckCircle, XCircle, RefreshCw, LogIn, LogOut, Activity, Calendar, MapPin, Users, Camera, Upload, DollarSign } from 'lucide-react';
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
  const [selectedTripForUpload, setSelectedTripForUpload] = useState<any>(null);
  const [tripCustomers, setTripCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [uploadType, setUploadType] = useState<'transaction' | 'rolling'>('transaction');
  const [uploadPhoto, setUploadPhoto] = useState<File | null>(null);
  const [uploadAmount, setUploadAmount] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedTripDetails, setSelectedTripDetails] = useState<any>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerRolling, setCustomerRolling] = useState<any[]>([]);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);

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
        // Use trip data directly without trying to fetch customer stats
        // Staff will see customer details when they click "View Customers"
        const enrichedTrips = (tripsResponse.data || []).map((trip: any) => ({
          ...trip,
          customers: [],
          activecustomerscount: trip.activecustomerscount || 0
        }));
        setAssignedTrips(enrichedTrips);
      } else {
        setAssignedTrips([]);
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

  // Load customers for selected trip
  const loadTripCustomers = async (tripId: string) => {
    try {
      const response = await apiClient.get(`/trips/${tripId}/customer-stats`);
      if (response.success) {
        setTripCustomers(response.data);
      }
    } catch (error) {
      console.error('Error loading trip customers:', error);
      showError('Failed to load trip customers');
    }
  };

  // Load detailed trip data with customers and their transactions/rolling
  const loadTripDetails = async (trip: any) => {
    try {
      setSelectedTripDetails(trip);
      console.log('Loading trip details for:', trip.id);
      
      // Try multiple approaches to get customer data
      let customersLoaded = false;
      
      // Approach 1: Try trip-specific customer stats (may fail due to permissions)
      try {
        const customersResponse = await apiClient.get(`/trips/${trip.id}/customer-stats`);
        console.log('Customer stats response:', customersResponse);
        if (customersResponse.success) {
          setTripCustomers(customersResponse.data);
          customersLoaded = true;
          console.log('Loaded customers from trip stats:', customersResponse.data);
        }
      } catch (error) {
        console.log('Trip-specific customer stats failed, trying alternatives');
      }
      
      // Approach 2: If trip-specific fails, try to get all customers and filter by trip
      if (!customersLoaded) {
        try {
          const allCustomersResponse = await apiClient.get('/customers');
          if (allCustomersResponse.success) {
            // Filter customers that might be associated with this trip
            // This is a fallback - in a real scenario, we'd need proper trip-customer relationships
            setTripCustomers(allCustomersResponse.data || []);
            customersLoaded = true;
            console.log('Loaded all customers as fallback:', allCustomersResponse.data);
          }
        } catch (error) {
          console.log('All customers fetch failed');
        }
      }
      
      // Approach 3: Use any existing trip data as fallback
      if (!customersLoaded && trip.customers) {
        setTripCustomers(trip.customers);
        customersLoaded = true;
        console.log('Using trip.customers as fallback:', trip.customers);
      }
      
      // Load transactions and rolling records if we have customers
      if (customersLoaded) {
        try {
          const [transactionsResponse, rollingResponse] = await Promise.all([
            apiClient.get(`/transactions?trip_id=${trip.id}`),
            apiClient.get(`/rolling-records?trip_id=${trip.id}`)
          ]);
          
          console.log('Transactions response:', transactionsResponse);
          console.log('Rolling response:', rollingResponse);
          
          if (transactionsResponse.success) {
            setCustomerTransactions(transactionsResponse.data || []);
          }
          
          if (rollingResponse.success) {
            setCustomerRolling(rollingResponse.data || []);
          }
        } catch (error) {
          console.log('Failed to load transactions/rolling:', error);
          setCustomerTransactions([]);
          setCustomerRolling([]);
        }
      } else {
        // No customers loaded, set empty arrays
        console.log('No customers loaded, setting empty arrays');
        setTripCustomers([]);
        setCustomerTransactions([]);
        setCustomerRolling([]);
      }
      
      // Always open the dialog after loading data
      console.log('Opening customer dialog');
      setIsCustomerDialogOpen(true);
      
    } catch (error) {
      console.error('Error loading trip details:', error);
      showError('Failed to load trip details');
      
      // Fallback: use any existing trip data
      if (trip.customers) {
        setTripCustomers(trip.customers);
      }
      setCustomerTransactions([]);
      setCustomerRolling([]);
      
      // Still open the dialog even if there's an error
      setIsCustomerDialogOpen(true);
    }
  };

  // Get transactions for a specific customer
  const getCustomerTransactions = (customerId: string) => {
    return customerTransactions.filter(t => 
      (t.customer_id === customerId || t.customerId === customerId)
    );
  };

  // Get rolling records for a specific customer
  const getCustomerRolling = (customerId: string) => {
    return customerRolling.filter(r => 
      (r.customer_id === customerId || r.customerId === customerId)
    );
  };

  // Handle photo upload for transaction/rolling
  const handlePhotoUpload = async () => {
    if (!uploadPhoto || !selectedCustomer || !uploadAmount) {
      showError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoData = e.target?.result as string;
          
          const uploadData: any = {
            customer_id: selectedCustomer.customer_id || selectedCustomer.id,
            type: uploadType,
            amount: parseFloat(uploadAmount),
            photo: photoData,
            notes: uploadNotes,
            staff_id: (user as any).staff_id || user.id,
            trip_id: selectedTripForUpload.id
          };

          const endpoint = uploadType === 'transaction' 
            ? `/transactions`
            : `/rolling-records`;

          const response = await apiClient.post(endpoint, uploadData);

          if (response.success) {
            setIsUploadDialogOpen(false);
            setUploadPhoto(null);
            setUploadAmount('');
            setUploadNotes('');
            setSelectedCustomer(null);
            // Refresh trip customers
            await loadTripCustomers(selectedTripForUpload.id);
          } else {
            showError(`Failed to upload ${uploadType}: ` + response.message);
          }
        } catch (error) {
          console.error(`${uploadType} upload error:`, error);
          showError(`Failed to upload ${uploadType}`);
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(uploadPhoto);
    } catch (error) {
      console.error(`${uploadType} upload error:`, error);
      showError(`Failed to upload ${uploadType}`);
      setIsSaving(false);
    }
  };

  // Open upload dialog
  const openUploadDialog = async (trip: any, type: 'transaction' | 'rolling') => {
    setSelectedTripForUpload(trip);
    setUploadType(type);
    await loadTripCustomers(trip.id);
    setIsUploadDialogOpen(true);
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
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {trip.activecustomerscount || 0} Active Customers
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadTripDetails(trip)}
                              className="text-xs"
                            >
                              <Users className="w-3 h-3 mr-1" />
                              View Customers
                            </Button>
                          </div>
                        </div>
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

      {/* Trip Details Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTripDetails?.trip_name} - Customer Details
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {tripCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No customers found for this trip.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tripCustomers.map((customer) => {
                  const customerId = customer.customer_id || customer.id;
                  const customerName = customer.customer_name || customer.name;
                  const transactions = getCustomerTransactions(customerId);
                  const rolling = getCustomerRolling(customerId);
                  
                  return (
                    <Card key={customerId} className="border-l-4 border-l-blue-400">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{customerName}</CardTitle>
                            <CardDescription>
                              Buy-in: {customer.total_buy_in || 0} | Cash-out: {customer.total_cash_out || 0} | Rolling: {customer.rolling_amount || 0}
                            </CardDescription>
                          </div>
                          <div className="text-sm text-gray-500">
                            View and manage existing records
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <Tabs defaultValue="transactions" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="transactions" className="text-xs">
                              Transactions ({transactions.length})
                            </TabsTrigger>
                            <TabsTrigger value="rolling" className="text-xs">
                              Rolling ({rolling.length})
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="transactions" className="mt-4">
                            {transactions.length === 0 ? (
                              <div className="text-center py-4">
                                <DollarSign className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">No transactions recorded</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {transactions.map((transaction, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div className="flex items-center space-x-3">
                                      <Badge variant={transaction.transaction_type === 'buy-in' ? 'default' : 'secondary'}>
                                        {transaction.transaction_type}
                                      </Badge>
                                      <span className="font-medium">${transaction.amount}</span>
                                      <span className="text-sm text-gray-500">
                                        {new Date(transaction.created_at || transaction.timestamp).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {transaction.photo ? (
                                        <ImageWithFallback
                                          src={transaction.photo}
                                          alt="Transaction proof"
                                          className="w-12 h-12 object-cover rounded border"
                                        />
                                      ) : (
                                        <div className="w-12 h-12 bg-gray-200 rounded border flex items-center justify-center">
                                          <Camera className="w-4 h-4 text-gray-400" />
                                        </div>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedCustomer(customer);
                                          setUploadType('transaction');
                                          setIsUploadDialogOpen(true);
                                        }}
                                        className="text-xs"
                                      >
                                        {transaction.photo ? 'Update Photo' : 'Upload Photo'}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="rolling" className="mt-4">
                            {rolling.length === 0 ? (
                              <div className="text-center py-4">
                                <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">No rolling records</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {rolling.map((roll, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div className="flex items-center space-x-3">
                                      <Badge variant="outline">Rolling</Badge>
                                      <span className="font-medium">${roll.amount}</span>
                                      <span className="text-sm text-gray-500">
                                        {new Date(roll.created_at || roll.timestamp).toLocaleString()}
                                      </span>
                                      {roll.game_type && (
                                        <Badge variant="secondary" className="text-xs">
                                          {roll.game_type}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {roll.photo ? (
                                        <ImageWithFallback
                                          src={roll.photo}
                                          alt="Rolling proof"
                                          className="w-12 h-12 object-cover rounded border"
                                        />
                                      ) : (
                                        <div className="w-12 h-12 bg-gray-200 rounded border flex items-center justify-center">
                                          <Camera className="w-4 h-4 text-gray-400" />
                                        </div>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedCustomer(customer);
                                          setUploadType('rolling');
                                          setIsUploadDialogOpen(true);
                                        }}
                                        className="text-xs"
                                      >
                                        {roll.photo ? 'Update Photo' : 'Upload Photo'}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {uploadType === 'transaction' ? (
                <DollarSign className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              <span>Upload {uploadType === 'transaction' ? 'Transaction' : 'Rolling'} Photo</span>
            </DialogTitle>
            <DialogDescription>
              Upload proof photo for {selectedTripForUpload?.trip_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selected Customer Info */}
            {selectedCustomer && (
              <div className="p-3 bg-blue-50 rounded border">
                <Label className="text-sm font-medium text-blue-800">Selected Customer</Label>
                <div className="mt-1">
                  <p className="font-medium">{selectedCustomer.customer_name || selectedCustomer.name}</p>
                  <p className="text-sm text-gray-600">
                    Current: Buy-in ${selectedCustomer.total_buy_in || 0} | 
                    Cash-out ${selectedCustomer.total_cash_out || 0} | 
                    Rolling ${selectedCustomer.rolling_amount || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <Label htmlFor="uploadAmount">
                {uploadType === 'transaction' ? 'Transaction Amount' : 'Rolling Amount'} (Required)
              </Label>
              <Input
                id="uploadAmount"
                type="number"
                step="0.01"
                value={uploadAmount}
                onChange={(e) => setUploadAmount(e.target.value)}
                placeholder="Enter amount..."
                disabled={isSaving}
                required
              />
            </div>

            {/* Photo Upload */}
            <div>
              <Label htmlFor="uploadPhoto">Photo Proof (Required)</Label>
              <Input
                id="uploadPhoto"
                type="file"
                accept="image/*"
                onChange={(e) => setUploadPhoto(e.target.files?.[0] || null)}
                className="mt-1"
                required
                disabled={isSaving}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="uploadNotes">Notes (Optional)</Label>
              <Textarea
                id="uploadNotes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                disabled={isSaving}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsUploadDialogOpen(false)} 
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePhotoUpload} 
                disabled={!uploadPhoto || !selectedCustomer || !uploadAmount || isSaving}
              >
                {isSaving ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {uploadType === 'transaction' ? 'Transaction' : 'Rolling'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const StaffSelfService = withErrorHandler(StaffSelfServiceComponent);
