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
import { Clock, CheckCircle, XCircle, RefreshCw, LogIn, LogOut, Activity, Calendar, MapPin, Users, Camera, DollarSign, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { PhotoDisplay } from './common/PhotoDisplay';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { apiClient } from '../utils/api/apiClient';
import { 
  DSContainer, 
  DSHeader, 
  DSCard, 
  DSButton, 
  DSBadge, 
  DSNotification,
  DSFormLayout,
  spacing,
  typography,
  iconSizes,
  buttonSizes
} from './common/DesignSystem';

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
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]); // 设置默认日期为当日
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [, setCustomerTransactions] = useState<any[]>([]);
  const [, setCustomerRolling] = useState<any[]>([]);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [customerPhotos, setCustomerPhotos] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

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
            setSuccessMessage('Check-in successful! You are now on duty.');
            setTimeout(() => setSuccessMessage(''), 3000);
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
            setSuccessMessage('Check-out successful! Your shift has ended.');
            setTimeout(() => setSuccessMessage(''), 3000);
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
      showError('Check-out failed');
      setIsSaving(false);
    }
  };

  // Load detailed trip data with customers and their transactions/rolling
  const loadTripDetails = async (trip: any) => {
    try {
      
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
      
      // Approach 1: Try trip-specific customer stats (recommended)
      try {
        const customersResponse = await apiClient.get(`/trips/${trip.id}/customer-stats`);
        if (customersResponse.success) {
          // 应用标准化函数处理客户数据
          const normalizedCustomers = normalizeCustomerData(customersResponse.data || []);
          setTripCustomers(normalizedCustomers);
          customersLoaded = true;
        }
      } catch (error) {
        console.log('Trip-specific customer stats failed, trying trip customers endpoint');
      }
      
      // Approach 2: Try trip customers endpoint (more specific than customer-stats)
      if (!customersLoaded) {
        try {
          const tripCustomersResponse = await apiClient.get(`/trips/${trip.id}/customers`);
          if (tripCustomersResponse.success) {
            // This should return only customers assigned to this specific trip
            const normalizedCustomers = normalizeCustomerData(tripCustomersResponse.data || []);
            setTripCustomers(normalizedCustomers);
            customersLoaded = true;
          }
        } catch (error) {
          console.log('Trip customers endpoint failed');
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



  // Legacy functions kept for future compatibility (currently unused)
  // const getCustomerTransactions = (customerId: string) => {
  //   return customerTransactions.filter(t => 
  //     (t.customer_id === customerId || t.customerId === customerId)
  //   );
  // };

  // const getCustomerRolling = (customerId: string) => {
  //   return customerRolling.filter(r => 
  //     (r.customer_id === customerId || r.customerId === customerId)
  //   );
  // };

  // Handle photo deletion
  const handlePhotoDelete = async (photoId: string) => {
    setIsSaving(true);
    try {
      const response = await apiClient.delete(`/customer-photos/${photoId}`);
      
      if (response.success) {
        console.log('✅ Photo deleted successfully:', photoId);
        // Refresh customer photos - the UI will automatically update to show the photo is gone
        if (selectedTripForUpload) {
          await loadTripDetails(selectedTripForUpload);
        }
      } else {
        // Handle different error types
        const errorMessage = response.message || 'Unknown error occurred';
        showError('Failed to delete photo: ' + errorMessage);
      }
    } catch (error: any) {
      console.error('Photo deletion error:', error);
      
      // Handle specific HTTP errors
      if (error.message && error.message.includes('403')) {
        showError('Permission denied: You do not have permission to delete this photo. Only the uploader or admin can delete photos.');
      } else if (error.message && error.message.includes('404')) {
        showError('Photo not found: This photo may have already been deleted.');
      } else if (error.message && error.message.includes('401')) {
        showError('Authentication required: Please log in again to delete photos.');
      } else {
        showError('Failed to delete photo: ' + (error.message || 'Network or server error'));
      }
    } finally {
      setIsSaving(false);
    }
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
            customer_id: selectedCustomer.customer?.id,
            trip_id: selectedTripForUpload.id,
            photo_type: uploadType,          // 'transaction' 或 'rolling'
            photo: photoJson,                // 存储为JSON格式
            uploaded_by: (user as any).staff_id || user.id,
            transaction_date: uploadDate     // 交易日期
            // status 字段由数据库默认设置为 'pending'，不需要手动指定
          };

          // 使用新的API端点
          const endpoint = '/customer-photos';
          
          console.log(`Uploading ${uploadType} photo for customer:`, selectedCustomer.customer_name || selectedCustomer.name);
          
          // Debug log for selectedCustomer structure
          console.log("🔍 Selected Customer Object:", selectedCustomer);
          console.log("🔍 Customer ID fields:", {
            "selectedCustomer.id": selectedCustomer.id,
            "selectedCustomer.customer_id": selectedCustomer.customer_id,
            "selectedCustomer.customer?.id": selectedCustomer.customer?.id
          });
          
          // Debug log for photo upload payload
          console.log("📸 Uploading photo payload:", {
            customer_id: customerPhotoData.customer_id,
            trip_id: customerPhotoData.trip_id,
            photo_type: customerPhotoData.photo_type,
            photo: customerPhotoData.photo,
            transaction_date: customerPhotoData.transaction_date,
          });
          
          const response = await apiClient.post(endpoint, customerPhotoData);

          if (response.success) {
            setIsUploadDialogOpen(false);
            setUploadPhoto(null);
            setUploadDate(new Date().toISOString().split('T')[0]); // 重置日期为今天
            setSelectedCustomer(null);
            
            // 显示成功消息
            setSuccessMessage(`${uploadType === 'transaction' ? 'Transaction' : 'Rolling'} photo uploaded successfully and pending approval`);
            // 3秒后自动清除成功消息
            setTimeout(() => setSuccessMessage(''), 3000);
            
            // 刷新客户数据
            await loadTripDetails(selectedTripForUpload);
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
    <DSContainer>
      {/* Success Message */}
      {successMessage && (
        <DSNotification
          type="success"
          title="Success"
          message={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      )}
      
      {/* Header */}
      <DSHeader
        title="Staff Self-Service"
        subtitle={`Welcome, ${currentStaff?.name || user.username}`}
        badges={[
          { text: `Staff ID: ${user.id}`, variant: 'gray' },
          { text: `${assignedTrips.length} Assigned Trips`, variant: 'primary' }
        ]}
        actions={
          <DSButton
            variant="outline"
            size="mobile"
            onClick={loadStaffData}
            disabled={isLoading}
            icon={<RefreshCw className={iconSizes.sm} />}
          >
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh Data</span>
          </DSButton>
        }
      />

      {/* Current Status Card */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Current Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex-1 min-w-0">
              {isCheckedIn() ? (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                    <Badge className="bg-green-100 text-green-800 px-3 py-1 w-fit">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      On Duty
                    </Badge>
                    <span className="text-xs sm:text-sm text-gray-600">
                      Since: {new Date((currentShift as any)!.check_in_time).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="sm:inline">Shift Date: {(currentShift as any)!.shift_date}</div>
                    <div className="sm:inline sm:ml-2">
                      Duration: {Math.floor((new Date().getTime() - new Date((currentShift as any)!.check_in_time).getTime()) / (1000 * 60))} min
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                  <Badge variant="secondary" className="px-3 py-1 w-fit">
                    <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Off Duty
                  </Badge>
                  <span className="text-xs sm:text-sm text-gray-600">Ready to check in</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
              {isCheckedIn() ? (
                <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving} className="w-full sm:w-auto">
                      <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="hidden sm:inline">Check Out</span>
                      <span className="sm:hidden">Check Out</span>
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
                    <Button disabled={isSaving} className="w-full sm:w-auto">
                      <LogIn className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="hidden sm:inline">Check In</span>
                      <span className="sm:hidden">Check In</span>
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
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="trips" className="flex items-center space-x-1 sm:space-x-2 py-2 sm:py-3">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">My Trips</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center space-x-1 sm:space-x-2 py-2 sm:py-3">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm">My Shifts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-6">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Assigned Trips</span>
              </CardTitle>
              <CardDescription className="text-sm">Trips you are assigned to manage</CardDescription>
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
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 mb-3">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <h4 className="font-medium text-sm sm:text-base truncate">{trip.trip_name}</h4>
                            </div>
                            <Badge className={`text-xs w-fit ${
                              trip.status === 'active' ? 'bg-green-100 text-green-800' :
                              trip.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {trip.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                            <div>
                              <Label className="text-xs text-gray-500">Destination</Label>
                              <p className="text-sm">{trip.destination}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Dates</Label>
                              <p className="text-sm">{new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                {trip.activecustomerscount || 0} Active Customers
                              </Badge>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
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
                                className="text-xs w-full sm:w-auto"
                              >
                                {expandedTripId === trip.id ? (
                                  <>
                                    <ChevronUp className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">Hide Customers</span>
                                    <span className="sm:hidden">Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">View Customers</span>
                                    <span className="sm:hidden">View</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Expandable Customer Section */}
                      {expandedTripId === trip.id && (
                        <div className="mt-3 pl-2 sm:pl-4 border-l-2 border-blue-200">
                          {tripCustomers.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded">
                              <Users className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-gray-400 mb-2" />
                              <p className="text-xs sm:text-sm text-gray-500">Loading customers...</p>
                            </div>
                          ) : (
                            <div className="space-y-2 sm:space-y-3">
                              {/* 调试信息 */}
                              {tripCustomers.map((customer) => {
                                
                                // 使用正确的customer ID和name
                                const customerId = customer.customer?.id || customer.customer_id;
                                const customerName = customer.customer?.name || customer.name;
                                
                                
                                // 筛选当前客户的照片
                                const customerSpecificPhotos = customerPhotos.filter(photo => 
                                  photo.customer_id === customerId
                                );
                                
                                // Debug: Photo matching (can be removed in production)
                                // console.log(`🔍 Customer ${customerName} (${customerId}):`, {
                                //   totalPhotos: customerPhotos.length,
                                //   matchingPhotos: customerSpecificPhotos.length
                                // });
                                
                                // 获取该客户最新的交易和滚码照片
                                const transactionPhotos = customerSpecificPhotos.filter(p => p.photo_type === 'transaction');
                                const rollingPhotos = customerSpecificPhotos.filter(p => p.photo_type === 'rolling');
                                
                                // Photo data available for future features (currently unused)
                                // const latestTransactionPhoto = transactionPhotos.length > 0 ? 
                                //   [...transactionPhotos].sort((a, b) => {
                                //     const dateA = new Date(a.upload_date);
                                //     const dateB = new Date(b.upload_date);
                                //     return dateB.getTime() - dateA.getTime();
                                //   })[0] : null;
                                
                                // const latestRollingPhoto = rollingPhotos.length > 0 ? 
                                //   [...rollingPhotos].sort((a, b) => {
                                //     const dateA = new Date(a.upload_date);
                                //     const dateB = new Date(b.upload_date);
                                //     return dateB.getTime() - dateA.getTime();
                                //   })[0] : null;
                                
                                // Legacy data compatibility (currently unused)
                                // const transactions = getCustomerTransactions(customerId);
                                // const rolling = getCustomerRolling(customerId);
                                
                                // Fallback data for future use (currently unused but kept for potential features)
                                // const fallbackTransaction = transactions.length > 0 ? 
                                //   [...transactions].sort((a, b) => {
                                //     const dateA = new Date(a.created_at || a.timestamp);
                                //     const dateB = new Date(b.created_at || b.timestamp);
                                //     return dateB.getTime() - dateA.getTime();
                                //   })[0] : null;
                                
                                // const fallbackRolling = rolling.length > 0 ? 
                                //   [...rolling].sort((a, b) => {
                                //     const dateA = new Date(a.created_at || a.timestamp);
                                //     const dateB = new Date(b.created_at || b.timestamp);
                                //     return dateB.getTime() - dateA.getTime();
                                //   })[0] : null;
                                  
                                // Helper function for photo validation (available for future use)
                                // const isValidPhotoData = (photoData: string) => {
                                //   if (!photoData) return false;
                                //   // Check if it's a valid base64 image data URL and not just "test"
                                //   return photoData.startsWith('data:image/') && 
                                //          !photoData.includes('base64,test') && 
                                //          photoData.length > 100; // Reasonable minimum length for actual image data
                                // };
                                
                                // Get valid photo data or null (currently unused but available for future features)
                                // const validTransactionPhotoData = latestTransactionPhoto?.photo?.data && 
                                //   isValidPhotoData(latestTransactionPhoto.photo.data) ? 
                                //   latestTransactionPhoto.photo.data : null;
                                  
                                // const validRollingPhotoData = latestRollingPhoto?.photo?.data && 
                                //   isValidPhotoData(latestRollingPhoto.photo.data) ? 
                                //   latestRollingPhoto.photo.data : null;
                                
                                // Debug: Photo display validation (can be removed in production)
                                // console.log(`📷 ${customerName} photos:`, {
                                //   validTransactionPhotoData: validTransactionPhotoData ? 'Valid' : 'Invalid/Missing',
                                //   validRollingPhotoData: validRollingPhotoData ? 'Valid' : 'Invalid/Missing'
                                // });
                                
                                return (
                                  <Card key={customerId} className="border-l-4 border-l-gray-300">
                                    <CardContent className="p-2 sm:p-3">
                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0 mb-3">
                                        <h5 className="text-sm sm:text-base font-medium truncate">
                                          {customerName || `Customer`}
                                        </h5>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs w-fit">
                                          Active
                                        </Badge>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        {/* Transaction Photo Section */}
                                        <div className="border rounded p-2 sm:p-3">
                                          <h6 className="text-xs sm:text-sm font-medium mb-2">Transaction</h6>
                                          <div className="mb-3">
                                            <PhotoDisplay
                                              photos={transactionPhotos}
                                              type="transaction"
                                              size="medium"
                                              maxPhotos={4}
                                              onPhotoDelete={handlePhotoDelete}
                                              showDelete={user.role === 'admin' || transactionPhotos.some(photo => 
                                                photo.uploaded_by === ((user as any).staff_id)
                                              )}
                                              showDownload={true}
                                              userRole={user.role}
                                              customerName={customerName}
                                            />
                                          </div>
                                          
                                          <DSButton
                                            variant="outline"
                                            size="mobile"
                                            onClick={() => {
                                              setSelectedCustomer(customer);
                                              setUploadType('transaction');
                                              setIsUploadDialogOpen(true);
                                            }}
                                            icon={<Camera className={iconSizes.sm} />}
                                          >
                                            <span className="hidden sm:inline">Upload Transaction Photo</span>
                                            <span className="sm:hidden">Upload Transaction</span>
                                          </DSButton>
                                        </div>
                                        
                                        {/* Rolling Photo Section */}
                                        <div className="border rounded p-2 sm:p-3">
                                          <h6 className="text-xs sm:text-sm font-medium mb-2">Rolling</h6>
                                          <div className="mb-3">
                                            <PhotoDisplay
                                              photos={rollingPhotos}
                                              type="rolling"
                                              size="medium"
                                              maxPhotos={4}
                                              onPhotoDelete={handlePhotoDelete}
                                              showDelete={user.role === 'admin' || rollingPhotos.some(photo => 
                                                photo.uploaded_by === ((user as any).staff_id)
                                              )}
                                              showDownload={true}
                                              userRole={user.role}
                                              customerName={customerName}
                                            />
                                          </div>
                                          
                                          <DSButton
                                            variant="outline"
                                            size="mobile"
                                            onClick={() => {
                                              setSelectedCustomer(customer);
                                              setUploadType('rolling');
                                              setIsUploadDialogOpen(true);
                                            }}
                                            icon={<Camera className={iconSizes.sm} />}
                                          >
                                            <span className="hidden sm:inline">Upload Rolling Photo</span>
                                            <span className="sm:hidden">Upload Rolling</span>
                                          </DSButton>
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

        <TabsContent value="shifts" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Shift History</span>
              </CardTitle>
              <CardDescription className="text-sm">Your recent shifts and attendance</CardDescription>
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
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 mb-3">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                            <span className="font-medium text-sm sm:text-base">{(shift as any).shift_date}</span>
                          </div>
                          <Badge className={`text-xs w-fit ${shift.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {shift.status === 'checked-in' ? 'On Duty' : 'Completed'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">Check-in Time</Label>
                            <p>{new Date((shift as any).check_in_time).toLocaleString()}</p>
                            {(shift as any).check_in_photo && (
                              <div className="mt-2">
                                <ImageWithFallback
                                  src={(shift as any).check_in_photo}
                                  alt="Check-in proof"
                                  className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded border"
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
                                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded border"
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
    </DSContainer>
  );
}

export const StaffSelfService = withErrorHandler(StaffSelfServiceComponent);
