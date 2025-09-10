import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Alert, AlertDescription } from './ui/alert';
import { User, Agent, Customer, FileAttachment, Trip, TripCustomer, RollingRecord, BuyInOutRecord } from '../types';
import { FileUpload } from './FileUpload';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';
import { apiClient } from '../utils/api/apiClient';
import { 
  Plus, Edit, Mail, Phone, DollarSign, TrendingUp, TrendingDown, Paperclip, Calendar, MapPin, Target, 
  ChevronDown, ChevronUp, User as UserIcon, UserCheck, Eye, Database, Save, RefreshCw, Activity, 
  IdCard, CreditCard, Heart, FileText, Clock, AlertCircle, CheckCircle, ArrowUpCircle, ArrowDownCircle, 
  Building2, Receipt, Wallet, Info, Globe, Home, Cake, Users
} from 'lucide-react';

interface CustomerManagementProps extends WithErrorHandlerProps {
  user: User;
}

interface CustomerTripHistory {
  tripId: string;
  tripName: string;
  tripDate: string;
  tripStatus: 'planned' | 'ongoing' | 'completed';
  agentName: string;
  customerData: TripCustomer;
}

// Real-time refresh interval (30 seconds)
const REAL_TIME_REFRESH_INTERVAL = 30000;

function CustomerManagementComponent({ user, showError, clearError }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rollingRecords, setRollingRecords] = useState<RollingRecord[]>([]);
  const [buyInOutRecords, setBuyInOutRecords] = useState<BuyInOutRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
  
  // Basic customer form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    agentId: '',
    vip_level: 'silver',
    status: 'active'
  });

  // Extended customer details form data (only non-basic fields)
  const [detailFormData, setDetailFormData] = useState({
    // Identity & Personal
    passportNumber: '',
    idNumber: '',
    nationality: '',
    dateOfBirth: '',
    address: '',
    occupation: '',
    
    // Preferences & Lifestyle
    hobby: '',
    gamingPreferences: '',
    emergencyContact: '',
    emergencyPhone: '',
    
    // Additional Details
    maritalStatus: '',
    educationLevel: '',
    incomeRange: '',
    preferredLanguage: 'English',
    notes: '',
    specialRequirements: ''
  });

  // Load real-time data from Supabase
  const loadRealTimeData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      clearError();
      
      console.log('🔄 Loading real-time customer data from Supabase...');
      
      // Load all required data from Supabase in parallel
      const [customersData, agentsData, tripsData, rollingData, buyInOutData] = await Promise.all([
        db.get('customers', []),
        db.get('agents', []),
        db.get('trips', []),
        db.get('rollingRecords', []),
        db.get('buyInOutRecords', [])
      ]);

      // Load customer details for all customers
      const customerDetailsPromises = customersData.map(async (customer: Customer) => {
        try {
          const detailsResponse = await apiClient.getCustomerDetails(customer.id);
          return {
            customerId: customer.id,
            details: detailsResponse.success ? detailsResponse.data : null
          };
        } catch (error) {
          console.log(`No details found for customer ${customer.id}`);
          return {
            customerId: customer.id,
            details: null
          };
        }
      });

      const customerDetailsResults = await Promise.all(customerDetailsPromises);
      const customerDetailsMap = new Map();
      customerDetailsResults.forEach(result => {
        if (result.details) {
          customerDetailsMap.set(result.customerId, result.details);
        }
      });
      
      console.log('🔍 Customer details loaded:', customerDetailsResults.length, 'customers');
      console.log('🔍 Customer details map size:', customerDetailsMap.size);
      if (customerDetailsMap.size > 0) {
        console.log('🔍 Sample customer details:', Array.from(customerDetailsMap.entries())[0]);
      }

      // Process customers using database totals directly (no manual calculations)
      const processedCustomers = customersData.map((customer: Customer) => {
        // Get customer details from the map
        const customerDetails = customerDetailsMap.get(customer.id);
        
        // Debug log for each customer's database totals
        console.log(`🔍 Customer ${customer.name} database totals:`, {
          total_rolling: customer.total_rolling,
          total_win_loss: customer.total_win_loss,
          total_buy_in: customer.total_buy_in,
          total_buy_out: customer.total_buy_out
        });

        return {
          ...customer,
          // Use database totals directly - these are kept up-to-date by the backend
          totalRolling: parseFloat(String(customer.total_rolling || 0)) || 0,
          totalWinLoss: parseFloat(String(customer.total_win_loss || 0)) || 0,
          totalBuyIn: parseFloat(String(customer.total_buy_in || 0)) || 0,
          totalBuyOut: parseFloat(String(customer.total_buy_out || 0)) || 0,
          // Customer details merged into customer object
          details: customerDetails,
          // Get attachments from customer details instead of customer table
          attachments: customerDetails?.attachments || [],
          // Backward compatibility
          isAgent: customer.isAgent || false,
          sourceAgentId: customer.sourceAgentId || undefined,
          rollingPercentage: parseFloat(String(customer.rolling_percentage || 1.4)) || 1.4,
          creditLimit: parseFloat(String(customer.credit_limit || 0)) || 0,
          availableCredit: parseFloat(String(customer.available_credit || 0)) || 0
        };
      });

      // Process trips with real-time win/loss calculations
      const processedTrips = tripsData.map((trip: Trip) => ({
        ...trip,
        calculatedTotalRolling: (trip.totalRolling || 0) * 0.014,
        attachments: trip.attachments || [],
        customers: trip.customers?.map(customer => {
          // Calculate real-time win/loss for this customer in this trip
          const tripRollingRecords = rollingData.filter((record: any) => 
            record.customerId === customer.customerId && 
            record.recordedAt >= trip.date
          );
          
          const realTimeTripWinLoss = tripRollingRecords.reduce((sum: number, record: any) => sum + (record.winLoss || 0), 0);
          
          return {
            ...customer,
            // Update win/loss with real-time data
            winLoss: realTimeTripWinLoss,
            rollingPercentage: customer.rollingPercentage || 1.4,
            calculatedRollingAmount: customer.calculatedRollingAmount || (customer.rollingAmount || 0) * 0.014
          };
        }) || []
      }));

      setCustomers(processedCustomers);
      setAgents(agentsData);
      setTrips(processedTrips);
      setRollingRecords(rollingData);
      setBuyInOutRecords(buyInOutData);
      setLastDataUpdate(new Date());
      
      console.log(`✅ Loaded real-time data: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips, ${rollingData.length} rolling records`);
      
    } catch (error) {
      console.error('❌ Error loading real-time customer data:', error);
      showError(`Failed to load customer data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [clearError, showError]);

  // Real-time data sync
  useEffect(() => {
    loadRealTimeData();
    
    // Set up real-time refresh interval
    const refreshInterval = setInterval(() => {
      console.log('🔄 Real-time customer data refresh triggered');
      loadRealTimeData();
    }, REAL_TIME_REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadRealTimeData]);

  // Filter customers based on user role
  const getFilteredCustomers = () => {
    if (user.role === 'agent' && user.agentId) {
      return customers.filter(customer => customer.agentId === user.agentId);
    }
    return customers;
  };

  const filteredCustomers = getFilteredCustomers();

  const saveCustomersToSupabase = async (updatedCustomers: Customer[]) => {
    try {
      setSaving(true);
      clearError();
      
      console.log('💾 Saving customers to Supabase...');
      await db.save('customers', updatedCustomers);
      
      setCustomers(updatedCustomers);
      console.log('✅ Successfully saved customers to Supabase');
      
      // Refresh data immediately after saving
      await loadRealTimeData();
      
    } catch (error) {
      console.error('❌ Error saving customers:', error);
      showError(`Failed to save customer data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const getCustomerTripHistory = (customerId: string): CustomerTripHistory[] => {
    const customerTrips: CustomerTripHistory[] = [];
    
    trips.forEach(trip => {
      const customerInTrip = trip.customers?.find(tc => tc.customerId === customerId);
      if (customerInTrip) {
        customerTrips.push({
          tripId: trip.id,
          tripName: trip.name,
          tripDate: trip.date,
          tripStatus: trip.status,
          agentName: trip.agentName || 'Unknown Agent',
          customerData: customerInTrip
        });
      }
    });

    // Sort by date (most recent first)
    return customerTrips.sort((a, b) => new Date(b.tripDate || '').getTime() - new Date(a.tripDate || '').getTime());
  };

  // Get customer rolling records for detailed view
  const getCustomerRollingRecords = (customerId: string) => {
    return rollingRecords
      .filter(record => record.customerId === customerId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  };

  // Get customer buy-in/buy-out records
  const getCustomerBuyInOutRecords = (customerId: string) => {
    return buyInOutRecords
      .filter(record => record.customerId === customerId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedAgent = agents.find(agent => agent.id === formData.agentId);
      if (!selectedAgent) {
        showError('Please select a valid agent');
        return;
      }

      if (editingCustomer) {
        // Update existing customer - only send allowed fields to backend
        const updateData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          vip_level: formData.vip_level || 'Silver',
          status: formData.status || 'active'
        };
        
        const response = await apiClient.updateCustomer(editingCustomer.id, updateData);
        if (!response.success) {
          throw new Error(response.error || 'Failed to update customer');
        }
        
        // Refresh data to get updated customer
        await loadRealTimeData();
      } else {
        // Add new customer - only send required fields to backend
        const customerData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          agent_id: formData.agentId,
          vip_level: formData.vip_level || 'Silver',
          status: formData.status || 'active'
        };
        
        // Create customer via API
        const response = await apiClient.createCustomer(customerData);
        if (!response.success) {
          throw new Error(response.error || 'Failed to create customer 1');
        }
        
        // Refresh data to get the new customer
        await loadRealTimeData();
      }

      // Data already saved via API, just update local state

      // Reset form and close dialog
      setFormData({ name: '', email: '', phone: '', agentId: '', vip_level: 'Silver', status: 'active' });
      setEditingCustomer(null);
      setIsDialogOpen(false);
      
    } catch (error) {
      // Error already handled in saveCustomersToSupabase
    }
  };

  const handleDetailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer) return;

    try {
      // Prepare customer details data
      const detailsData = {
        // Identity & Personal fields
        passport_number: detailFormData.passportNumber || null,
        id_number: detailFormData.idNumber || null,
        nationality: detailFormData.nationality || null,
        date_of_birth: detailFormData.dateOfBirth || null,
        address: detailFormData.address || null,
        occupation: detailFormData.occupation || null,
        
        // Preferences & Lifestyle fields
        hobby: detailFormData.hobby || null,
        gaming_preferences: detailFormData.gamingPreferences || null,
        emergency_contact: detailFormData.emergencyContact || null,
        emergency_phone: detailFormData.emergencyPhone || null,
        
        // Additional Details
        marital_status: detailFormData.maritalStatus || null,
        education_level: detailFormData.educationLevel || null,
        income_range: detailFormData.incomeRange || null,
        preferred_language: detailFormData.preferredLanguage || 'English',
        notes: detailFormData.notes || null,
        special_requirements: detailFormData.specialRequirements || null
      };
      
      // 🔍 Frontend Debug: Log data being sent to backend
      console.log('🔍 Frontend - updateData being sent:', detailsData);
      console.log('🔍 Frontend - Customer ID:', selectedCustomer.id);
      console.log('🔍 Frontend - Form data:', detailFormData);
      
      // Use PUT endpoint which handles both create and update
      const response = await apiClient.updateCustomerDetails(selectedCustomer.id, detailsData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update customer details');
      }
      
      console.log('✅ Customer details saved successfully');
      
      // Refresh data to get updated customer
      await loadRealTimeData();
      
      // 重新加载当前客户的详情数据以显示最新信息
      if (selectedCustomer) {
        const updatedDetailsResponse = await apiClient.getCustomerDetails(selectedCustomer.id);
        if (updatedDetailsResponse.success && updatedDetailsResponse.data) {
          console.log('✅ Loaded updated customer details:', updatedDetailsResponse.data);
          // 更新表单数据以显示最新保存的信息
          const details = updatedDetailsResponse.data as any;
          setDetailFormData({
            passportNumber: details.passport_number || '',
            idNumber: details.id_number || '',
            nationality: details.nationality || '',
            dateOfBirth: details.date_of_birth || '',
            address: details.address || '',
            occupation: details.occupation || '',
            hobby: details.hobby || '',
            gamingPreferences: details.gaming_preferences || '',
            emergencyContact: details.emergency_contact || '',
            emergencyPhone: details.emergency_phone || '',
            maritalStatus: details.marital_status || '',
            educationLevel: details.education_level || '',
            incomeRange: details.income_range || '',
            preferredLanguage: details.preferred_language || 'English',
            notes: details.notes || '',
            specialRequirements: details.special_requirements || ''
          });

          // 同步更新 selectedCustomer 对象以确保基本信息显示最新数据
          const updatedCustomer = customers.find(c => c.id === selectedCustomer.id);
          if (updatedCustomer) {
            setSelectedCustomer({
              ...updatedCustomer
            });
          }
        }
      }
      
      setIsDetailDialogOpen(false);
      setSelectedCustomer(null);
      
    } catch (error) {
      console.error('Error updating customer details:', error);
      showError(`Failed to update customer details: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      agentId: customer.agentId,
      vip_level: (customer as any).vip_level || 'Silver',
      status: (customer as any).status || 'active'
    });
    setIsDialogOpen(true);
  };

  const handleEditDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    
    try {
      // Load existing customer details from API
      const response = await apiClient.getCustomerDetails(customer.id);
      
      if (response.success && response.data) {
        // Use existing details from API
        const details = response.data as any; // Type assertion to fix TypeScript errors
        setDetailFormData({
          // Identity & Personal
          passportNumber: details.passport_number || '',
          idNumber: details.id_number || '',
          nationality: details.nationality || '',
          dateOfBirth: details.date_of_birth || '',
          address: details.address || '',
          occupation: details.occupation || '',
          
          // Preferences & Lifestyle
          hobby: details.hobby || '',
          gamingPreferences: details.gaming_preferences || '',
          emergencyContact: details.emergency_contact || '',
          emergencyPhone: details.emergency_phone || '',
          
          // Additional Details
          maritalStatus: details.marital_status || '',
          educationLevel: details.education_level || '',
          incomeRange: details.income_range || '',
          preferredLanguage: details.preferred_language || 'English',
          notes: details.notes || '',
          specialRequirements: details.special_requirements || ''
        });
      } else {
        // No existing details, use empty form
        setDetailFormData({
          // Identity & Personal
          passportNumber: '',
          idNumber: '',
          nationality: '',
          dateOfBirth: '',
          address: '',
          occupation: '',
          
          // Preferences & Lifestyle
          hobby: '',
          gamingPreferences: '',
          emergencyContact: '',
          emergencyPhone: '',
          
          // Additional Details
          maritalStatus: '',
          educationLevel: '',
          incomeRange: '',
          preferredLanguage: 'English',
          notes: '',
          specialRequirements: ''
        });
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      showError('Failed to load customer details');
      // Use empty form as fallback
      setDetailFormData({
        passportNumber: '',
        idNumber: '',
        nationality: '',
        dateOfBirth: '',
        address: '',
        occupation: '',
        hobby: '',
        gamingPreferences: '',
        emergencyContact: '',
        emergencyPhone: '',
        maritalStatus: '',
        educationLevel: '',
        incomeRange: '',
        preferredLanguage: 'English',
        notes: '',
        specialRequirements: ''
      });
    }
    
    setIsDetailDialogOpen(true);
  };

  const toggleCustomerExpansion = (customerId: string) => {
    setExpandedCustomer(expandedCustomer === customerId ? null : customerId);
  };

  const toggleCustomerStatus = async (customerId: string) => {
    try {
      const updatedCustomers = customers.map(customer =>
        customer.id === customerId
          ? { ...customer, isActive: !customer.isActive }
          : customer
      );
      
      await saveCustomersToSupabase(updatedCustomers);
    } catch (error) {
      // Error already handled in saveCustomersToSupabase
    }
  };

  const updateCustomerAttachments = async (customerId: string, attachments: FileAttachment[]) => {
    try {
      console.log('🔍 Frontend - Updating customer attachments:', customerId, attachments.length);
      
      // Update local state immediately for UI responsiveness
      const updatedCustomers = customers.map(customer =>
        customer.id === customerId
          ? { ...customer, attachments }
          : customer
      );
      setCustomers(updatedCustomers);

      // Save to backend via API
      const response = await apiClient.uploadCustomerAttachments(customerId, attachments);
      if (!response.success) {
        throw new Error(response.error || 'Failed to upload attachments');
      }

      console.log('✅ Customer attachments updated successfully');
      
      // Refresh data to ensure consistency
      await loadRealTimeData();
    } catch (error) {
      console.error('❌ Error updating customer attachments:', error);
      showError(`Failed to update attachments: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      
      // Revert local state on error
      await loadRealTimeData();
    }
  };

  const handleFileUpload = async (customerId: string, newAttachments: FileAttachment[]) => {
    try {
      console.log('🔍 Frontend - Uploading new files:', customerId, newAttachments.length);
      
      // Get current customer
      const customer = customers.find(c => c.id === customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Merge with existing attachments
      const existingAttachments = customer.attachments || [];
      const allAttachments = [...existingAttachments, ...newAttachments];

      // Update via the existing function
      await updateCustomerAttachments(customerId, allAttachments);
    } catch (error) {
      console.error('❌ Error uploading files:', error);
      showError(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  const handleDeleteAttachment = async (customerId: string, attachmentId: string) => {
    try {
      console.log('🔍 Frontend - Deleting attachment:', customerId, attachmentId);
      
      // Delete via API
      const response = await apiClient.deleteCustomerAttachment(customerId, attachmentId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete attachment');
      }

      console.log('✅ Attachment deleted successfully');
      
      // Refresh data to get updated attachments
      await loadRealTimeData();
    } catch (error) {
      console.error('❌ Error deleting attachment:', error);
      showError(`Failed to delete attachment: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  const openNewCustomerDialog = () => {
    setEditingCustomer(null);
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      agentId: user.role === 'agent' && user.agentId ? user.agentId : '',
      vip_level: 'Silver',
      status: 'active'
    });
    setIsDialogOpen(true);
  };

  // Get available agents based on user role
  const getAvailableAgents = () => {
    if (user.role === 'agent' && user.agentId) {
      return agents.filter(agent => agent.id === user.agentId);
    }
    return agents.filter(agent => agent.status === 'active');
  };

  const availableAgents = getAvailableAgents();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWinLossIndicator = (winLoss: number) => {
    if (winLoss === 0) {
      return {
        text: 'Break Even',
        icon: Target,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-600'
      };
    } else if (winLoss > 0) {
      return {
        text: 'Customer Win',
        icon: TrendingUp,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        iconColor: 'text-green-600'
      };
    } else {
      return {
        text: 'House Win',
        icon: TrendingDown,
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        iconColor: 'text-red-600'
      };
    }
  };

  const isAdmin = user.role === 'admin';
  const isAgent = user.role === 'agent';
  const isStaff = user.role === 'staff';

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading real-time customer data from Supabase...</p>
        </div>
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
                ✅ Real-time Customer Data Connected to Supabase
              </p>
              <p className="text-xs text-green-600">
                Rolling amounts, win/loss, and trip data update automatically every 30 seconds
                {lastDataUpdate && ` • Last sync: ${lastDataUpdate.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {saving && (
              <div className="flex items-center text-blue-600">
                <Save className="w-4 h-4 mr-1 animate-pulse" />
                <span className="text-xs">Saving...</span>
              </div>
            )}
            {isRefreshing && (
              <div className="flex items-center text-orange-600">
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                <span className="text-xs">Syncing...</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadRealTimeData}
              disabled={saving || isRefreshing}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Features Notice */}
      <Alert>
        <CheckCircle className="w-4 h-4" />
        <AlertDescription>
          <strong>Enhanced Customer Management:</strong> Real-time rolling amounts and win/loss calculations, 
          full customer profile editing with credit limits, and live trip history updates.
        </AlertDescription>
      </Alert>

      {/* Staff View Banner */}
      {isStaff && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Customer Information - View Only
              </p>
              <p className="text-xs text-blue-600">
                You have read-only access to customer information, trip history, and documents.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Customer Management</h2>
          <p className="text-gray-600">
            {isAgent 
              ? 'Manage your customers with real-time rolling data and complete profile editing' 
              : isStaff 
                ? 'View customer information, real-time data, and trip history'
                : 'Manage all customers with live data updates and comprehensive profile management'
            }
          </p>
        </div>
        {(isAdmin || isAgent) && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewCustomerDialog} disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
                <DialogDescription>
                  {editingCustomer ? 'Update basic customer information' : 'Add a new customer with basic details. You can add extended details after creation.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Customer full name"
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="customer@email.com"
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
                
                <div>
                  <Label htmlFor="agent">Agent</Label>
                  <Select 
                    value={formData.agentId} 
                    onValueChange={(value) => setFormData({...formData, agentId: value})}
                    disabled={user.role === 'agent' || saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        {editingCustomer ? 'Update' : 'Add'} Customer
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No customers found. {isStaff ? 'Contact an administrator to add customers.' : 'Add your first customer to get started.'}</p>
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => {
            const tripHistory = getCustomerTripHistory(customer.id);
            const rollingHistory = getCustomerRollingRecords(customer.id);
            const buyInOutHistory = getCustomerBuyInOutRecords(customer.id);
            const isExpanded = expandedCustomer === customer.id;
            
            return (
              <Collapsible key={customer.id} open={isExpanded} onOpenChange={() => toggleCustomerExpansion(customer.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center space-x-2">
                            <span>{customer.name}</span>
                            <Badge variant={customer.isActive ? "default" : "secondary"}>
                              {customer.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {customer.attachments && customer.attachments.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Paperclip className="w-3 h-3" />
                                <span>{customer.attachments.length}</span>
                              </Badge>
                            )}
                            {tripHistory.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{tripHistory.length} trips</span>
                              </Badge>
                            )}
                            {rollingHistory.length > 0 && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Receipt className="w-3 h-3 mr-1" />
                                {rollingHistory.length} records
                              </Badge>
                            )}
                            {customer.isAgent && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Agent
                              </Badge>
                            )}
                            {isStaff && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Eye className="w-3 h-3 mr-1" />
                                View Only
                              </Badge>
                            )}
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Activity className="w-3 h-3 mr-1" />
                              Live Data
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Customer since {customer.createdAt} • Agent: {customer.agentName}
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
                    {/* Real-time Financial Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{customer.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Phone:</span>
                        <span className="text-sm">{customer.phone}</span>
                      </div>
                      {/* 客户详情摘要 - 添加调试信息 */}
                      {(() => {
                        const details = (customer as any).details;
                        console.log(`🔍 UI Render - Customer ${customer.name} details:`, details);
                        
                        if (!details) {
                          return (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-400">No details available</span>
                            </div>
                          );
                        }
                        
                        return (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">Nationality:</span>
                              <span className="text-sm">{details.nationality || 'Not provided'}</span>
                            </div>
                            {details.passport_number && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">Passport:</span>
                                <span className="text-sm">{details.passport_number}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Rolling: ${(customer.totalRolling || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(customer.totalWinLoss || 0) >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          (customer.totalWinLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          W/L: ${(customer.totalWinLoss || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">
                          Cash: ${((customer.totalBuyOut || 0) - (customer.totalBuyIn || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-orange-600" />
                        <span className="text-sm">
                          Credit: ${(customer.creditLimit || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {(isAdmin || isAgent) && (
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(customer)} disabled={saving}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Basic Info
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEditDetails(customer)} disabled={saving}>
                          <FileText className="w-4 h-4 mr-2" />
                          Edit Details
                        </Button>
                        {customer.isActive ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={saving}>
                                Deactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Customer</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to deactivate "{customer.name}"? Deactivated customers will no longer be able to participate in new trips or transactions, but their existing data and trip history will be preserved.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => toggleCustomerStatus(customer.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={saving}
                                >
                                  {saving ? 'Saving...' : 'Deactivate Customer'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => toggleCustomerStatus(customer.id)}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    )}

                    <CollapsibleContent className="mt-6">
                      <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                          <TabsTrigger value="info" className="flex items-center space-x-2">
                            <UserIcon className="w-4 h-4" />
                            <span>Profile</span>
                          </TabsTrigger>
                          <TabsTrigger value="trips" className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>Trips ({tripHistory.length})</span>
                          </TabsTrigger>
                          <TabsTrigger value="rolling" className="flex items-center space-x-2">
                            <Receipt className="w-4 h-4" />
                            <span>Rolling ({rollingHistory.length})</span>
                          </TabsTrigger>
                          <TabsTrigger value="cash" className="flex items-center space-x-2">
                            <Wallet className="w-4 h-4" />
                            <span>Cash Flow ({buyInOutHistory.length})</span>
                          </TabsTrigger>
                          <TabsTrigger value="files" className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4" />
                            <span>Files ({customer.attachments?.length || 0})</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Enhanced Customer Profile Tab */}
                        <TabsContent value="info" className="space-y-4 mt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Basic Information */}
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900 flex items-center">
                                <UserIcon className="w-4 h-4 mr-2" />
                                Basic Information
                              </h4>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Name</Label>
                                <p className="text-lg">{customer.name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Email</Label>
                                <p>{customer.email}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Phone</Label>
                                <p>{customer.phone}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Agent</Label>
                                <p>{customer.agentName}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Status</Label>
                                <Badge variant={customer.isActive ? "default" : "secondary"}>
                                  {customer.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                                <p>{customer.createdAt}</p>
                              </div>
                            </div>
                            
                            {/* Identity & Personal Details */}
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900 flex items-center">
                                <IdCard className="w-4 h-4 mr-2" />
                                Identity & Personal
                              </h4>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Passport Number</Label>
                                <p>{(customer as any).details?.passport_number || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">ID Number</Label>
                                <p>{(customer as any).details?.id_number || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Nationality</Label>
                                <p>{(customer as any).details?.nationality || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Date of Birth</Label>
                                <p>{(customer as any).details?.date_of_birth || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Address</Label>
                                <p>{(customer as any).details?.address || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Occupation</Label>
                                <p>{(customer as any).details?.occupation || 'Not provided'}</p>
                              </div>
                            </div>

                            {/* Preferences & Financial */}
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900 flex items-center">
                                <Heart className="w-4 h-4 mr-2" />
                                Preferences & Financial
                              </h4>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Hobby</Label>
                                <p>{(customer as any).details?.hobby || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Gaming Preferences</Label>
                                <p>{(customer as any).details?.gaming_preferences || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Credit Limit</Label>
                                <p className="font-medium">${(customer.creditLimit || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Available Credit</Label>
                                <p className="font-medium">${(customer.availableCredit || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Emergency Contact</Label>
                                <p>{(customer as any).details?.emergency_contact || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Emergency Phone</Label>
                                <p>{(customer as any).details?.emergency_phone || 'Not provided'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Real-time Financial Summary */}
                          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <Activity className="w-4 h-4 mr-2" />
                              Real-time Financial Summary
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Total Rolling</Label>
                                <p className="text-xl font-bold text-blue-600">${(customer.totalRolling || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Total Win/Loss</Label>
                                <p className={`text-xl font-bold ${
                                  (customer.totalWinLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ${(customer.totalWinLoss || 0).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Buy-in Total</Label>
                                <p className="text-xl font-bold text-blue-500">${(customer.totalBuyIn || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Buy-out Total</Label>
                                <p className="text-xl font-bold text-purple-500">${(customer.totalBuyOut || 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                        </TabsContent>

                        {/* Real-time Trip History Tab */}
                        <TabsContent value="trips" className="space-y-4 mt-6">
                          {tripHistory.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                              <p>No trip history available</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">Trip Participation History</h4>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <Activity className="w-3 h-3 mr-1" />
                                  Live Data
                                </Badge>
                              </div>
                              {tripHistory.map((trip) => {
                                const winLossIndicator = getWinLossIndicator(trip.customerData.winLoss || 0);
                                const IconComponent = winLossIndicator.icon;
                                
                                return (
                                  <Card key={trip.tripId} className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <h5 className="font-medium">{trip.tripName}</h5>
                                          <Badge className={getStatusColor(trip.tripStatus)}>
                                            {trip.tripStatus}
                                          </Badge>
                                          <Badge className={`${winLossIndicator.bgColor} ${winLossIndicator.textColor} flex items-center space-x-1`}>
                                            <IconComponent className={`w-3 h-3 ${winLossIndicator.iconColor}`} />
                                            <span>{winLossIndicator.text}</span>
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                          <div>
                                            <Label className="text-gray-500">Date</Label>
                                            <p>{trip.tripDate}</p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Rolling Amount</Label>
                                            <p className="font-medium">${(trip.customerData.rollingAmount || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Win/Loss (Real-time)</Label>
                                            <p className={`font-medium ${
                                              (trip.customerData.winLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                              ${(trip.customerData.winLoss || 0).toLocaleString()}
                                            </p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Agent</Label>
                                            <p>{trip.agentName}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </TabsContent>

                        {/* Real-time Rolling Records Tab */}
                        <TabsContent value="rolling" className="space-y-4 mt-6">
                          {rollingHistory.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                              <p>No rolling records available</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">Rolling Records</h4>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <Activity className="w-3 h-3 mr-1" />
                                  Live Data
                                </Badge>
                              </div>
                              {rollingHistory.slice(0, 10).map((record) => {
                                const winLossIndicator = getWinLossIndicator(record.winLoss || 0);
                                const IconComponent = winLossIndicator.icon;
                                
                                return (
                                  <Card key={record.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <h5 className="font-medium">{record.gameType}</h5>
                                          {record.verified && (
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                              <CheckCircle className="w-3 h-3 mr-1" />
                                              Verified
                                            </Badge>
                                          )}
                                          <Badge className={`${winLossIndicator.bgColor} ${winLossIndicator.textColor} flex items-center space-x-1`}>
                                            <IconComponent className={`w-3 h-3 ${winLossIndicator.iconColor}`} />
                                            <span>{winLossIndicator.text}</span>
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
                                          <div>
                                            <Label className="text-gray-500">Rolling Amount</Label>
                                            <p className="font-medium">${(record.rollingAmount || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Win/Loss</Label>
                                            <p className={`font-medium ${
                                              (record.winLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                              ${(record.winLoss || 0).toLocaleString()}
                                            </p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Buy-in</Label>
                                            <p className="font-medium text-blue-600">${(record.buyInAmount || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Buy-out</Label>
                                            <p className="font-medium text-purple-600">${(record.buyOutAmount || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <Label className="text-gray-500">Recorded</Label>
                                            <p>{new Date(record.recordedAt).toLocaleDateString()}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                              {rollingHistory.length > 10 && (
                                <div className="text-center text-sm text-gray-500">
                                  Showing 10 most recent records out of {rollingHistory.length} total
                                </div>
                              )}
                            </div>
                          )}
                        </TabsContent>

                        {/* Cash Flow Tab */}
                        <TabsContent value="cash" className="space-y-4 mt-6">
                          {buyInOutHistory.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                              <p>No cash flow records available</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">Cash Flow Records</h4>
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <Activity className="w-3 h-3 mr-1" />
                                  Live Data
                                </Badge>
                              </div>
                              {buyInOutHistory.slice(0, 10).map((record) => (
                                <Card key={record.id} className="p-4">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <h5 className="font-medium capitalize">{record.transactionType}</h5>
                                        <Badge variant="outline" className={
                                          record.transactionType === 'buy-in' 
                                            ? 'bg-blue-50 text-blue-700' 
                                            : 'bg-purple-50 text-purple-700'
                                        }>
                                          {record.transactionType === 'buy-in' ? (
                                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                                          ) : (
                                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                                          )}
                                          {record.transactionType}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <Label className="text-gray-500">Amount</Label>
                                          <p className={`font-medium ${
                                            record.transactionType === 'buy-in' ? 'text-blue-600' : 'text-purple-600'
                                          }`}>
                                            ${record.amount.toLocaleString()}
                                          </p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-500">Venue</Label>
                                          <p>{record.venue || 'Not specified'}</p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-500">Staff</Label>
                                          <p>{record.staffName}</p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-500">Date</Label>
                                          <p>{new Date(record.timestamp).toLocaleDateString()}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                              {buyInOutHistory.length > 10 && (
                                <div className="text-center text-sm text-gray-500">
                                  Showing 10 most recent records out of {buyInOutHistory.length} total
                                </div>
                              )}
                            </div>
                          )}
                        </TabsContent>

                        {/* Files Tab */}
                        <TabsContent value="files" className="space-y-4 mt-6">
                          {!isStaff && (
                            <FileUpload
                              attachments={customer.attachments || []}
                              onAttachmentsChange={(attachments) => updateCustomerAttachments(customer.id, attachments)}
                              onUpload={(newAttachments) => handleFileUpload(customer.id, newAttachments)}
                              disabled={isStaff}
                              currentUser={user.username || user.email || 'Unknown User'}
                            />
                          )}
                          
                          {customer.attachments && customer.attachments.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900">Attached Files</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customer.attachments.map((attachment) => (
                                  <Card key={attachment.id} className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Paperclip className="w-4 h-4 text-gray-400" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {(attachment.size / 1024).toFixed(1)} KB • {new Date(attachment.uploadedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    {attachment.type.startsWith('image/') && (
                                      <img 
                                        src={attachment.data} 
                                        alt={attachment.name}
                                        className="mt-2 w-full h-32 object-cover rounded"
                                      />
                                    )}
                                  </Card>
                                ))}
                              </div>
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

      {/* Enhanced Customer Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
            <DialogDescription>
              Update comprehensive customer information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDetailSubmit} className="space-y-6">
            <Tabs defaultValue="identity" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="identity">Identity & Personal</TabsTrigger>
                <TabsTrigger value="preferences">Preferences & Lifestyle</TabsTrigger>
                <TabsTrigger value="additional">Additional Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="identity" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passportNumber">Passport Number</Label>
                    <Input
                      id="passportNumber"
                      value={detailFormData.passportNumber}
                      onChange={(e) => setDetailFormData({...detailFormData, passportNumber: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="idNumber">ID Number</Label>
                    <Input
                      id="idNumber"
                      value={detailFormData.idNumber}
                      onChange={(e) => setDetailFormData({...detailFormData, idNumber: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      value={detailFormData.nationality}
                      onChange={(e) => setDetailFormData({...detailFormData, nationality: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={detailFormData.dateOfBirth}
                      onChange={(e) => setDetailFormData({...detailFormData, dateOfBirth: e.target.value})}
                      disabled={saving}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={detailFormData.address}
                      onChange={(e) => setDetailFormData({...detailFormData, address: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={detailFormData.occupation}
                      onChange={(e) => setDetailFormData({...detailFormData, occupation: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hobby">Hobby</Label>
                    <Input
                      id="hobby"
                      value={detailFormData.hobby}
                      onChange={(e) => setDetailFormData({...detailFormData, hobby: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gamingPreferences">Gaming Preferences</Label>
                    <Input
                      id="gamingPreferences"
                      value={detailFormData.gamingPreferences}
                      onChange={(e) => setDetailFormData({...detailFormData, gamingPreferences: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      value={detailFormData.emergencyContact}
                      onChange={(e) => setDetailFormData({...detailFormData, emergencyContact: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input
                      id="emergencyPhone"
                      value={detailFormData.emergencyPhone}
                      onChange={(e) => setDetailFormData({...detailFormData, emergencyPhone: e.target.value})}
                      placeholder="Not provided"
                      disabled={saving}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="additional" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <Select 
                      value={detailFormData.maritalStatus} 
                      onValueChange={(value) => setDetailFormData({...detailFormData, maritalStatus: value})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="educationLevel">Education Level</Label>
                    <Select 
                      value={detailFormData.educationLevel} 
                      onValueChange={(value) => setDetailFormData({...detailFormData, educationLevel: value})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select education" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high_school">High School</SelectItem>
                        <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                        <SelectItem value="master">Master's Degree</SelectItem>
                        <SelectItem value="doctorate">Doctorate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="incomeRange">Income Range</Label>
                    <Select 
                      value={detailFormData.incomeRange} 
                      onValueChange={(value) => setDetailFormData({...detailFormData, incomeRange: value})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under_50k">Under $50,000</SelectItem>
                        <SelectItem value="50k_100k">$50,000 - $100,000</SelectItem>
                        <SelectItem value="100k_250k">$100,000 - $250,000</SelectItem>
                        <SelectItem value="250k_500k">$250,000 - $500,000</SelectItem>
                        <SelectItem value="over_500k">Over $500,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="preferredLanguage">Preferred Language</Label>
                    <Select 
                      value={detailFormData.preferredLanguage} 
                      onValueChange={(value) => setDetailFormData({...detailFormData, preferredLanguage: value})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Chinese">Chinese</SelectItem>
                        <SelectItem value="Cantonese">Cantonese</SelectItem>
                        <SelectItem value="Mandarin">Mandarin</SelectItem>
                        <SelectItem value="Japanese">Japanese</SelectItem>
                        <SelectItem value="Korean">Korean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={detailFormData.notes}
                      onChange={(e) => setDetailFormData({...detailFormData, notes: e.target.value})}
                      placeholder="Additional notes about the customer..."
                      disabled={saving}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="specialRequirements">Special Requirements</Label>
                    <Textarea
                      id="specialRequirements"
                      value={detailFormData.specialRequirements}
                      onChange={(e) => setDetailFormData({...detailFormData, specialRequirements: e.target.value})}
                      placeholder="Any special requirements or accommodations..."
                      disabled={saving}
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDetailDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    Saving Details...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Details
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export with error handler wrapper
export const CustomerManagement = withErrorHandler(CustomerManagementComponent);