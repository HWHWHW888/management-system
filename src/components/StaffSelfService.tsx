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
import { Clock, CheckCircle, XCircle, RefreshCw, LogIn, LogOut, Activity, Calendar, MapPin, Users, Camera, Upload, DollarSign, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadDate, setUploadDate] = useState('2025-09-17'); // 设置默认日期为17/09/2025
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedTripDetails, setSelectedTripDetails] = useState<any>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerRolling, setCustomerRolling] = useState<any[]>([]);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [customerPhotos, setCustomerPhotos] = useState<any[]>([]);

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
      
      // Try multiple approaches to get customer data
      let customersLoaded = false;
      
      
      // 添加客户数据结构转换函数
      const normalizeCustomerData = (customers: any[]) => {
        return customers.map((customer) => {
          // 检查所有可能的ID字段
          const possibleIdFields = ['id', 'customer_id', 'customerId', 'ID', 'Id'];
          const id = possibleIdFields.map(field => customer[field]).find(val => val) || 'unknown-id';
          
          // 检查所有可能的名字字段
          const possibleNameFields = [
            'name', 'customer_name', 'customerName', 'full_name', 'fullName', 'Name',
            'first_name', 'firstName', 'last_name', 'lastName', 'display_name', 'displayName'
          ];
          
          let name = possibleNameFields.map(field => customer[field]).find(val => val && val.trim());
          
          // 如果还是没有找到名字，尝试从嵌套对象中查找
          if (!name && customer.customer) {
            name = possibleNameFields.map(field => customer.customer[field]).find(val => val && val.trim());
          }
          
          // 最后的回退策略 - 使用ID作为显示名称
          if (!name) {
            name = `Customer ${id}`;
          }
          
          // 返回标准化的客户对象
          return {
            ...customer,
            id,
            name,
            customer_id: id,
            customer_name: name
          };
        });
      };
      
      // Approach 1: Try trip-specific customer stats (may fail due to permissions)
      try {
        const customersResponse = await apiClient.get(`/trips/${trip.id}/customer-stats`);
        if (customersResponse.success) {
          // 应用标准化函数处理客户数据
          const normalizedCustomers = normalizeCustomerData(customersResponse.data || []);
          setTripCustomers(normalizedCustomers);
          customersLoaded = true;
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
            const normalizedCustomers = normalizeCustomerData(allCustomersResponse.data || []);
            setTripCustomers(normalizedCustomers);
            customersLoaded = true;
          }
        } catch (error) {
        }
      }
      
      // Approach 3: Use any existing trip data as fallback
      if (!customersLoaded && trip.customers) {
        const normalizedCustomers = normalizeCustomerData(trip.customers || []);
        setTripCustomers(normalizedCustomers);
        customersLoaded = true;
      }
      
      // Load transactions, rolling records, and customer photos if we have customers
      if (customersLoaded) {
        try {
          // 加载交易记录和滚码记录（旧API）
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
          
          // 尝试加载客户照片（新API）
          try {
            const photosResponse = await apiClient.get(`/customer-photos?trip_id=${trip.id}`);
            console.log('Customer photos response:', photosResponse);
            if (photosResponse.success) {
              setCustomerPhotos(photosResponse.data || []);
            } else {
              setCustomerPhotos([]);
            }
          } catch (error) {
            console.log('Failed to load customer photos (new API may not be implemented yet):', error);
            setCustomerPhotos([]);
          }
          
        } catch (error) {
          console.log('Failed to load transactions/rolling:', error);
          setCustomerTransactions([]);
          setCustomerRolling([]);
          setCustomerPhotos([]);
        }
      } else {
        // No customers loaded, set empty arrays
        console.log('No customers loaded, setting empty arrays');
        setTripCustomers([]);
        setCustomerTransactions([]);
        setCustomerRolling([]);
        setCustomerPhotos([]);
      }
      
      // Set the selected trip ID for the expandable section
      setSelectedTripForUpload(trip);
      
    } catch (error) {
      console.error('Error loading trip details:', error);
      showError('Failed to load trip details');
      
      // Fallback: use any existing trip data
      if (trip.customers) {
        setTripCustomers(trip.customers);
      }
      setCustomerTransactions([]);
      setCustomerRolling([]);
      setCustomerPhotos([]);
      
      // Close the expanded section on error
      setExpandedTripId(null);
    }
  };

  // 获取客户照片 - 新函数，使用customer_photos表
  const getCustomerPhotos = async (customerId: string, tripId: string) => {
    try {
      const response = await apiClient.get(`/customer-photos?customer_id=${customerId}&trip_id=${tripId}`);
      if (response.success) {
        return response.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching customer photos:', error);
      return [];
    }
  };

  // 获取特定类型的最新照片
  const getLatestCustomerPhoto = (photos: any[], photoType: string) => {
    const typePhotos = photos.filter(p => p.photo_type === photoType);
    if (typePhotos.length === 0) return null;
    
    return typePhotos.sort((a, b) => {
      const dateA = new Date(a.upload_date);
      const dateB = new Date(b.upload_date);
      return dateB.getTime() - dateA.getTime();
    })[0];
  };

  // 保留旧函数以兼容现有代码，后续可以逐步迁移
  const getCustomerTransactions = (customerId: string) => {
    return customerTransactions.filter(t => 
      (t.customer_id === customerId || t.customerId === customerId)
    );
  };

  // 保留旧函数以兼容现有代码，后续可以逐步迁移
  const getCustomerRolling = (customerId: string) => {
    return customerRolling.filter(r => 
      (r.customer_id === customerId || r.customerId === customerId)
    );
  };

  // Handle photo upload for transaction/rolling using customer_photos table
  const handlePhotoUpload = async () => {
    if (!uploadPhoto || !selectedCustomer || !uploadDate) {
      showError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoData = e.target?.result as string;
          
          // 使用新的customer_photos表结构，照片存储为JSON格式
          const photoJson = {
            data: photoData,                // 照片数据
            filename: uploadPhoto.name,     // 文件名
            size: uploadPhoto.size,         // 文件大小
            type: uploadPhoto.type,         // 文件类型
            uploaded_at: new Date().toISOString()
          };
          
          const customerPhotoData: any = {
            customer_id: selectedCustomer.customer_id || selectedCustomer.id,
            trip_id: selectedTripForUpload.id,
            photo_type: uploadType,          // 'transaction' 或 'rolling'
            photo: photoJson,                // 存储为JSON格式
            uploaded_by: (user as any).staff_id || user.id,
            transaction_date: uploadDate,    // 交易日期
            status: 'pending'                // 默认状态为待审核
          };

          // 使用新的API端点
          const endpoint = '/customer-photos';
          
          console.log(`Uploading ${uploadType} photo for customer:`, selectedCustomer.customer_name || selectedCustomer.name);
          
          const response = await apiClient.post(endpoint, customerPhotoData);

          if (response.success) {
            setIsUploadDialogOpen(false);
            setUploadPhoto(null);
            setUploadDate(new Date().toISOString().split('T')[0]); // 重置日期为今天
            setUploadNotes('');
            setSelectedCustomer(null);
            
            // 显示成功消息
            showError(`${uploadType === 'transaction' ? 'Transaction' : 'Rolling'} photo uploaded successfully and pending approval`);
            
            // 刷新客户数据
            await loadTripCustomers(selectedTripForUpload.id);
          } else {
            showError(`Failed to upload ${uploadType} photo: ` + response.message);
          }
        } catch (error) {
          console.error(`${uploadType} photo upload error:`, error);
          showError(`Failed to upload ${uploadType} photo`);
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
                    <div key={trip.id} className="mb-4">
                      <Card className="border-l-4 border-l-blue-400">
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
                                onClick={() => {
                                  // Toggle expanded state for this trip
                                  setExpandedTripId(expandedTripId === trip.id ? null : trip.id);
                                  // Load customer data if expanding and not already loaded
                                  if (expandedTripId !== trip.id) {
                                    loadTripDetails(trip);
                                  }
                                }}
                                className="text-xs"
                              >
                                {expandedTripId === trip.id ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 mr-1" />
                                    Hide Customers
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3 mr-1" />
                                    View Customers
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Expandable Customer Section */}
                      {expandedTripId === trip.id && (
                        <div className="mt-2 pl-4 border-l-2 border-blue-200">
                          {tripCustomers.length === 0 ? (
                            <div className="text-center py-4 bg-gray-50 rounded">
                              <Users className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                              <p className="text-sm text-gray-500">Loading customers...</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* 调试信息 */}
                              {tripCustomers.map((customer) => {
                                
                                // 直接使用标准化后的字段
                                const customerId = customer.id;
                                const customerName = customer.name;
                                
                                
                                // 筛选当前客户的照片
                                const customerSpecificPhotos = customerPhotos.filter(photo => 
                                  photo.customer_id === customerId
                                );
                                
                                // 获取该客户最新的交易和滚码照片
                                const transactionPhotos = customerSpecificPhotos.filter(p => p.photo_type === 'transaction');
                                const rollingPhotos = customerSpecificPhotos.filter(p => p.photo_type === 'rolling');
                                
                                // 按上传日期排序，获取最新的照片
                                const latestTransactionPhoto = transactionPhotos.length > 0 ? 
                                  [...transactionPhotos].sort((a, b) => {
                                    const dateA = new Date(a.upload_date);
                                    const dateB = new Date(b.upload_date);
                                    return dateB.getTime() - dateA.getTime();
                                  })[0] : null;
                                
                                const latestRollingPhoto = rollingPhotos.length > 0 ? 
                                  [...rollingPhotos].sort((a, b) => {
                                    const dateA = new Date(a.upload_date);
                                    const dateB = new Date(b.upload_date);
                                    return dateB.getTime() - dateA.getTime();
                                  })[0] : null;
                                
                                // 保留旧代码的兼容性，以防API尚未实现
                                const transactions = getCustomerTransactions(customerId);
                                const rolling = getCustomerRolling(customerId);
                                
                                // 如果新API未返回数据，尝试使用旧数据
                                const fallbackTransaction = transactions.length > 0 ? 
                                  [...transactions].sort((a, b) => {
                                    const dateA = new Date(a.created_at || a.timestamp);
                                    const dateB = new Date(b.created_at || b.timestamp);
                                    return dateB.getTime() - dateA.getTime();
                                  })[0] : null;
                                
                                const fallbackRolling = rolling.length > 0 ? 
                                  [...rolling].sort((a, b) => {
                                    const dateA = new Date(a.created_at || a.timestamp);
                                    const dateB = new Date(b.created_at || b.timestamp);
                                    return dateB.getTime() - dateA.getTime();
                                  })[0] : null;
                                  
                                // 优先使用新API数据，如果没有则回退到旧数据
                                const displayTransaction = latestTransactionPhoto || fallbackTransaction;
                                const displayRolling = latestRollingPhoto || fallbackRolling;
                                
                                return (
                                  <Card key={customerId} className="border-l-4 border-l-gray-300">
                                    <CardContent className="p-3">
                                      <div className="flex justify-between items-center mb-3">
                                        <h5 className="text-base font-medium">
                                          {customerName || `Customer`}
                                        </h5>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                          Active
                                        </Badge>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        {/* Transaction Photo Section */}
                                        <div className="border rounded p-3">
                                          <h6 className="text-sm font-medium mb-2">Transaction</h6>
                                          
                                          {displayTransaction ? (
                                            <div className="mb-3">
                                              <ImageWithFallback
                                                src={latestTransactionPhoto ? 
                                                  // 新格式：从JSON对象中获取照片数据
                                                  latestTransactionPhoto.photo?.data || ''
                                                  : 
                                                  // 旧格式：直接使用photo字段
                                                  displayTransaction.photo
                                                }
                                                alt="Transaction proof"
                                                className="w-full h-24 object-cover rounded border mb-1"
                                              />
                                              {/* 根据需求移除日期显示 */}
                                              {latestTransactionPhoto?.status && (
                                                <Badge className={`text-xs mt-1 ${latestTransactionPhoto.status === 'approved' ? 'bg-green-100 text-green-800' : latestTransactionPhoto.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                  {latestTransactionPhoto.status.charAt(0).toUpperCase() + latestTransactionPhoto.status.slice(1)}
                                                </Badge>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center mb-3">
                                              <Camera className="w-8 h-8 text-gray-300" />
                                              <p className="text-xs text-gray-400 ml-2">No photo</p>
                                            </div>
                                          )}
                                          
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => {
                                              setSelectedCustomer(customer);
                                              setUploadType('transaction');
                                              setIsUploadDialogOpen(true);
                                            }}
                                            className="w-full flex items-center justify-center"
                                          >
                                            <Camera className="w-4 h-4 mr-1" />
                                            Upload Transaction Photo
                                          </Button>
                                        </div>
                                        
                                        {/* Rolling Photo Section */}
                                        <div className="border rounded p-3">
                                          <h6 className="text-sm font-medium mb-2">Rolling</h6>
                                          
                                          {displayRolling ? (
                                            <div className="mb-3">
                                              <ImageWithFallback
                                                src={latestRollingPhoto ? 
                                                  // 新格式：从JSON对象中获取照片数据
                                                  latestRollingPhoto.photo?.data || ''
                                                  : 
                                                  // 旧格式：直接使用photo字段
                                                  displayRolling.photo
                                                }
                                                alt="Rolling proof"
                                                className="w-full h-24 object-cover rounded border mb-1"
                                              />
                                              {/* 根据需求移除日期显示 */}
                                              {latestRollingPhoto?.status && (
                                                <Badge className={`text-xs mt-1 ${latestRollingPhoto.status === 'approved' ? 'bg-green-100 text-green-800' : latestRollingPhoto.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                  {latestRollingPhoto.status.charAt(0).toUpperCase() + latestRollingPhoto.status.slice(1)}
                                                </Badge>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center mb-3">
                                              <Camera className="w-8 h-8 text-gray-300" />
                                              <p className="text-xs text-gray-400 ml-2">No photo</p>
                                            </div>
                                          )}
                                          
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => {
                                              setSelectedCustomer(customer);
                                              setUploadType('rolling');
                                              setIsUploadDialogOpen(true);
                                            }}
                                            className="w-full flex items-center justify-center"
                                          >
                                            <Camera className="w-4 h-4 mr-1" />
                                            Upload Rolling Photo
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                  {shifts
                    .sort((a, b) => {
                      // Sort by newest date/time first
                      const dateA = new Date((a as any).check_in_time || (a as any).shift_date || a.checkInTime || a.shiftDate);
                      const dateB = new Date((b as any).check_in_time || (b as any).shift_date || b.checkInTime || b.shiftDate);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .slice(0, 10)
                    .map((shift) => (
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
                </div>
              </div>
            )}

            {/* Date Input */}
            <div>
              <Label htmlFor="uploadDate">Date (Required)</Label>
              <Input
                id="uploadDate"
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                disabled={isSaving}
                required
                className="mb-2"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <Label htmlFor="uploadPhoto">Upload Photo</Label>
              <Input
                id="uploadPhoto"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadPhoto(e.target.files[0]);
                  }
                }}
                disabled={isSaving}
                required
              />
            </div>

            {/* Photo Preview */}
            {uploadPhoto && (
              <div className="mt-2">
                <Label className="text-sm mb-1 block">Photo Preview</Label>
                <div className="border rounded p-2 bg-gray-50">
                  <img 
                    src={URL.createObjectURL(uploadPhoto)} 
                    alt="Preview" 
                    className="max-h-40 mx-auto object-contain"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="uploadNotes">Notes (Optional)</Label>
              <Textarea
                id="uploadNotes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Add any additional notes..."
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
                disabled={!uploadPhoto || !uploadDate || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
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
