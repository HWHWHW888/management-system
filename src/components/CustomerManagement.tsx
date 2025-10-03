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
import { User, Agent, Customer, FileAttachment, Trip, TripCustomer, RollingRecord, BuyInOutRecord } from '../types';
import { FileUpload } from './FileUpload';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { PhotoDisplay } from './common/PhotoDisplay';
import { isReadOnlyRole, canViewFinancialData } from '../utils/permissions';
import { db } from '../utils/supabase/supabaseClients';
import { apiClient } from '../utils/api/apiClient';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Plus, Edit, Mail, DollarSign, TrendingUp, TrendingDown, Paperclip, MapPin, Target, 
  ChevronDown, ChevronUp, User as UserIcon, UserCheck, Eye, 
  IdCard, Heart, FileText, ArrowUpCircle, ArrowDownCircle, 
  Receipt, Wallet, Save, Activity, CheckCircle
} from 'lucide-react';

interface CustomerManagementProps extends WithErrorHandlerProps {
  user: User;
}

interface CustomerTripHistory {
  tripId: string;
  tripName: string;
  tripDate: string;
  tripStatus: 'active' | 'in-progress' | 'completed' | 'cancelled';
  agentName: string;
  customerData: TripCustomer;
}


function CustomerManagementComponent({ user, showError, clearError }: CustomerManagementProps) {
  const { t } = useLanguage();
  const isReadOnly = isReadOnlyRole(user.role);
  const canSeeFinancials = canViewFinancialData(user.role);

  // Helper function to format date safely
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
  };
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
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [promotingCustomer, setPromotingCustomer] = useState<Customer | null>(null);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    isOpen: boolean;
    src: string;
    title: string;
  }>({ isOpen: false, src: '', title: '' });
  
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
    passportFile: null as File | null,
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
      
      // Debug agents data
      console.log('🔍 Agents data loaded:', agentsData.length, 'agents');
      if (agentsData.length > 0) {
        console.log('🔍 Sample agent:', agentsData[0]);
      }

      // Process customers using database totals directly (no manual calculations)
      const processedCustomers = customersData.map((customer: Customer) => {
        // Get customer details from the map
        const customerDetails = customerDetailsMap.get(customer.id);
        
        // Debug log for each customer's database totals and field mapping
        console.log(`🔍 Customer ${customer.name} raw data:`, {
          created_at: (customer as any).created_at,
          createdAt: customer.createdAt,
          agent_id: (customer as any).agent_id,
          agentId: customer.agentId,
          status: (customer as any).status,
          isActive: customer.isActive,
          total_rolling: customer.total_rolling,
          total_win_loss: customer.total_win_loss,
          total_buy_in: customer.total_buy_in,
          total_buy_out: customer.total_buy_out
        });

        // Find agent name from agents data using agent_id
        const customerAgentId = (customer as any).agent_id || customer.agentId;
        const customerAgent = agentsData.find((agent: any) => agent.id === customerAgentId);
        
        const processedCustomer = {
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
          // Map database fields to frontend fields (snake_case to camelCase)
          createdAt: (customer as any).created_at || customer.createdAt,
          agentId: customerAgentId,
          agentName: customerAgent?.name || 'Unknown Agent',
          // Map status field correctly (database uses 'status', not 'is_active')
          isActive: (customer as any).status === 'active' || customer.isActive,
          isAgent: (customer as any).is_agent || false,
          sourceAgentId: (customer as any).source_agent_id || undefined,
          rollingPercentage: parseFloat(String(customer.rolling_percentage || 1.4)) || 1.4,
          creditLimit: parseFloat(String(customer.credit_limit || 0)) || 0,
          availableCredit: parseFloat(String(customer.available_credit || 0)) || 0
        };

        // Debug log processed customer data
        console.log(`✅ Customer ${customer.name} processed data:`, {
          createdAt: processedCustomer.createdAt,
          agentId: processedCustomer.agentId,
          agentName: processedCustomer.agentName,
          status: (customer as any).status,
          isActive: processedCustomer.isActive,
          foundAgent: customerAgent ? `${customerAgent.name} (${customerAgent.id})` : 'Not found'
        });

        return processedCustomer;
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
      console.log(`✅ Loaded real-time data: ${processedCustomers.length} customers, ${agentsData.length} agents, ${processedTrips.length} trips, ${rollingData.length} rolling records`);
      
    } catch (error) {
      console.error('❌ Error loading real-time customer data:', error);
      showError(`Failed to load customer data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  }, [clearError, showError]);

  // Load data on component mount
  useEffect(() => {
    loadRealTimeData();
  }, [loadRealTimeData]);

  // Filter customers based on user role
  const getFilteredCustomers = () => {
    if (user.role === 'agent' && user.agentId) {
      return customers.filter(customer => customer.agentId === user.agentId);
    }
    return customers;
  };

  const filteredCustomers = getFilteredCustomers();


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
      setSaving(true);
      
      // Handle passport file upload first if there's a file
      let passportFileUrl = null;
      if (detailFormData.passportFile) {
        console.log('🔍 Uploading passport file:', detailFormData.passportFile.name);
        
        // Convert file to base64 for upload
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(detailFormData.passportFile!);
        });

        // Upload passport file via API
        const passportUploadResponse = await apiClient.uploadCustomerPassport(selectedCustomer.id, {
          name: detailFormData.passportFile.name,
          type: detailFormData.passportFile.type,
          size: detailFormData.passportFile.size,
          data: fileData,
          uploadedAt: new Date().toISOString()
        });

        if (!passportUploadResponse.success) {
          throw new Error(passportUploadResponse.error || 'Failed to upload passport file');
        }
        
        passportFileUrl = passportUploadResponse.data?.passport_photo?.data;
        console.log('✅ Passport file uploaded successfully:', passportFileUrl);
      }

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
            passportFile: null,
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
    } finally {
      setSaving(false);
    }
  };

  const handleImagePreview = (src: string, title: string) => {
    setImagePreview({ isOpen: true, src, title });
  };

  const closeImagePreview = () => {
    setImagePreview({ isOpen: false, src: '', title: '' });
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
          passportFile: null,
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
          passportFile: null,
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
        passportFile: null,
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


  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    try {
      setSaving(true);
      clearError();
      
      console.log('🗑️ Deleting customer:', deletingCustomer.name, deletingCustomer.id);
      
      // Call backend API to delete customer
      const response = await apiClient.deleteCustomer(deletingCustomer.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete customer');
      }
      
      console.log('✅ Customer deleted successfully');
      
      // Refresh data to get updated customer list
      await loadRealTimeData();
      
      // Close dialog and reset state
      setDeletingCustomer(null);
      
    } catch (error) {
      console.error('❌ Error deleting customer:', error);
      showError(`Failed to delete customer: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePromoteToAgent = (customer: Customer) => {
    setPromotingCustomer(customer);
    setIsPromoteDialogOpen(true);
  };

  const confirmPromoteToAgent = async () => {
    if (!promotingCustomer) return;

    try {
      setSaving(true);
      clearError();
      
      console.log('🔄 Promoting customer to agent:', promotingCustomer.name, promotingCustomer.id);
      
      // Call backend API to promote customer to agent
      // Backend will automatically use customer's agent_id as parent_agent_id
      const response = await apiClient.promoteCustomerToAgent(promotingCustomer.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to promote customer to agent');
      }
      
      console.log('✅ Customer promoted to agent successfully');
      
      // Refresh data to get updated customer and agent lists
      await loadRealTimeData();
      
      // Close dialog and reset state
      setIsPromoteDialogOpen(false);
      setPromotingCustomer(null);
      
    } catch (error) {
      console.error('❌ Error promoting customer to agent:', error);
      showError(`Failed to promote customer to agent: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setSaving(false);
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

  // Attachment deletion function (currently unused but available for future use)
  // const handleDeleteAttachment = async (customerId: string, attachmentId: string) => {
  //   try {
  //     console.log('🔍 Frontend - Deleting attachment:', customerId, attachmentId);
  //     
  //     // Delete via API
  //     const response = await apiClient.deleteCustomerAttachment(customerId, attachmentId);
  //     if (!response.success) {
  //       throw new Error(response.error || 'Failed to delete attachment');
  //     }

  //     console.log('✅ Attachment deleted successfully');
  //     
  //     // Refresh data to get updated attachments
  //     await loadRealTimeData();
  //   } catch (error) {
  //     console.error('❌ Error deleting attachment:', error);
  //     showError(`Failed to delete attachment: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
  //   }
  // };

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

      {/* Staff View Banner */}
      {isStaff && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
{t('customer_info')} - {t('view')} Only
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
          <h2 className="text-2xl font-bold">{t('Customer Management')}</h2>
          <p className="text-gray-600">
            {isAgent 
              ? 'Manage your customers with real-time rolling data and complete profile editing' 
              : isStaff 
                ? 'View customer information, real-time data, and trip history'
                : 'Manage all customers with live data updates and comprehensive profile management'
            }
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewCustomerDialog} disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
{t('add_customer')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? t('edit_customer') : t('add_customer')}
                </DialogTitle>
                <DialogDescription>
                  {editingCustomer ? t('update_customer_info') : t('add_customer_desc')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={t('customer_full_name')}
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">{t('email')}</Label>
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
                  <Label htmlFor="phone">{t('phone')}</Label>
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
                  <Label htmlFor="agent">{t('agent')}</Label>
                  <Select 
                    value={formData.agentId} 
                    onValueChange={(value) => setFormData({...formData, agentId: value})}
                    disabled={user.role === 'agent' || saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_agent')} />
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
{t('cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
{t('saving')}...
                      </>
                    ) : (
                      <>
{editingCustomer ? t('update') : t('add')} {t('customers')}
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
              <p className="text-gray-500">{t('no_customers_found')}. {isStaff ? t('contact_admin') : t('add_first_customer')}</p>
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
                            {customer.isAgent && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center space-x-1">
                                <UserCheck className="w-3 h-3" />
                                <span>{t('agent')}</span>
                              </Badge>
                            )}
                            {customer.attachments && customer.attachments.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Paperclip className="w-3 h-3" />
                                <span>{customer.attachments.length}</span>
                              </Badge>
                            )}
                            {tripHistory.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>{tripHistory.length} {t('trips')}</span>
                              </Badge>
                            )}
                            {rollingHistory.length > 0 && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Receipt className="w-3 h-3 mr-1" />
                                {rollingHistory.length} {t('records')}
                              </Badge>
                            )}
                            {isStaff && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Eye className="w-3 h-3 mr-1" />
                                {t('view')} Only
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Customer since {formatDate(customer.createdAt)} • Agent: {customer.agentName || 'Unknown'}
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
                        <span className="text-sm text-gray-500">{t('phone')}:</span>
                        <span className="text-sm">{customer.phone}</span>
                      </div>
                      {/* Customer details status */}
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {(customer as any).details ? t('details_available') : t('no_details_available')}
                        </span>
                      </div>
                      {/* Hide financial data for staff users, show for boss */}
                      {canSeeFinancials && (
                        <>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium">{t('rolling')}: ${(customer.totalRolling || 0).toLocaleString()}</span>
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
                              {t('win_loss')}: ${Math.abs(customer.totalWinLoss || 0).toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {!isReadOnly && (
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(customer)} disabled={saving}>
                          <Edit className="w-4 h-4 mr-2" />
{t('edit_basic_info')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEditDetails(customer)} disabled={saving}>
                          <FileText className="w-4 h-4 mr-2" />
{t('edit_details')}
                        </Button>
                        {isAdmin && !customer.isAgent && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handlePromoteToAgent(customer)} 
                            disabled={saving}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                          >
                            <UserCheck className="w-4 h-4 mr-2" />
                            Promote to Agent
                          </Button>
                        )}
                        {isAdmin && (
                          <AlertDialog open={deletingCustomer?.id === customer.id} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => setDeletingCustomer(customer)}
                                disabled={saving}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete "{customer.name}"? This action cannot be undone and will remove all customer data, trip history, transactions, and associated records from the system.
                                  <br /><br />
                                  <strong>Warning:</strong> This will also affect any trips this customer participated in and may impact financial calculations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteCustomer}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                  disabled={saving}
                                >
                                  {saving ? 'Deleting...' : 'Delete Customer'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                            <span>Files ({
                              (customer.attachments?.length || 0) + 
                              ((customer as any).details?.passport_photo?.data ? 1 : 0)
                            })</span>
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
                                <p>{formatDate(customer.createdAt)}</p>
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
                                <Label className="text-sm font-medium text-gray-500">Passport Photo</Label>
                                {(customer as any).details?.passport_photo?.data ? (
                                  <div className="mt-1">
                                    <div className="flex items-center space-x-2">
                                      <FileText className="w-4 h-4 text-blue-500" />
                                      <span className="text-sm text-blue-600">
                                        {(customer as any).details?.passport_photo?.name || (customer as any).details?.passport_file_name || 'Passport Photo'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Uploaded: {(customer as any).details?.passport_photo?.uploadedAt ? 
                                        new Date((customer as any).details.passport_photo.uploadedAt).toLocaleDateString() : 
                                        (customer as any).details?.passport_uploaded_at ? 
                                        new Date((customer as any).details.passport_uploaded_at).toLocaleDateString() : 
                                        'Unknown date'
                                      }
                                    </p>
                                    {(customer as any).details?.passport_photo?.data && (
                                      <div className="mt-2">
                                        <PhotoDisplay
                                          photos={[{
                                            id: 'passport',
                                            photo: {
                                              data: (customer as any).details.passport_photo.data,
                                              filename: (customer as any).details.passport_photo.name || 'passport.jpg',
                                              size: (customer as any).details.passport_photo.size,
                                              type: (customer as any).details.passport_photo.type
                                            },
                                            upload_date: (customer as any).details.passport_photo.uploaded_at
                                          }]}
                                          type="passport"
                                          size="medium"
                                          maxPhotos={1}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-gray-500">Not provided</p>
                                )}
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
                                <Label className="text-sm font-medium text-gray-500">Emergency Contact</Label>
                                <p>{(customer as any).details?.emergency_contact || 'Not provided'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Emergency Phone</Label>
                                <p>{(customer as any).details?.emergency_phone || 'Not provided'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Real-time Financial Summary - Hidden for staff, visible for boss */}
                          {canSeeFinancials && (
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
                                    ${Math.abs(customer.totalWinLoss || 0).toLocaleString()}
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
                          )}

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
                                            <p>{formatDate(trip.tripDate)}</p>
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
                                              ${Math.abs(trip.customerData.winLoss || 0).toLocaleString()}
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
                                              ${Math.abs(record.winLoss || 0).toLocaleString()}
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
                          
                          {/* Passport Photo Section */}
                          {(customer as any).details?.passport_photo?.data && (
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900 flex items-center">
                                <IdCard className="w-4 h-4 mr-2" />
                                Passport Photo
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Card className="p-4">
                                  <div className="flex items-center space-x-2">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {(customer as any).details?.passport_photo?.name || (customer as any).details?.passport_file_name || 'Passport Photo'}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {(customer as any).details?.passport_photo?.size ? 
                                          `${((customer as any).details.passport_photo.size / 1024).toFixed(1)} KB` : 
                                          (customer as any).details?.passport_file_size ? 
                                          `${((customer as any).details.passport_file_size / 1024).toFixed(1)} KB` : 
                                          'Unknown size'
                                        } • {(customer as any).details?.passport_photo?.uploadedAt ? 
                                          new Date((customer as any).details.passport_photo.uploadedAt).toLocaleDateString() : 
                                          (customer as any).details?.passport_uploaded_at ? 
                                          new Date((customer as any).details.passport_uploaded_at).toLocaleDateString() : 
                                          'Unknown date'
                                        }
                                      </p>
                                    </div>
                                  </div>
                                  {(customer as any).details?.passport_photo?.data && (
                                    <div className="mt-2">
                                      <PhotoDisplay
                                        photos={[{
                                          id: 'passport',
                                          photo: {
                                            data: (customer as any).details.passport_photo.data,
                                            filename: (customer as any).details.passport_photo.name || 'passport.jpg',
                                            size: (customer as any).details.passport_photo.size,
                                            type: (customer as any).details.passport_photo.type
                                          },
                                          upload_date: (customer as any).details.passport_photo.uploaded_at
                                        }]}
                                        type="passport"
                                        size="large"
                                        maxPhotos={1}
                                      />
                                    </div>
                                  )}
                                </Card>
                              </div>
                            </div>
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
                                        className="mt-2 w-full h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => handleImagePreview(
                                          attachment.data,
                                          `${customer.name} - ${attachment.name}`
                                        )}
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
              
              <TabsContent value="identity" className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <IdCard className="w-5 h-5 mr-2 text-blue-600" />
                    Identity & Personal Information
                  </h3>
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
                    <Label htmlFor="passportFile">Passport Photo</Label>
                    
                    {/* Show existing passport photo if available */}
                    {(selectedCustomer as any)?.details?.passport_photo?.data && !detailFormData.passportFile && (
                      <div className="mb-3 p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Current Passport Photo:</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => selectedCustomer && handleImagePreview(
                              (selectedCustomer as any).details.passport_photo.data,
                              `${selectedCustomer.name} - Current Passport Photo`
                            )}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-gray-600">
                            {(selectedCustomer as any).details?.passport_photo?.name || 
                             (selectedCustomer as any).details?.passport_file_name || 'passport.jpg'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Upload a new file to replace the current passport photo
                        </p>
                      </div>
                    )}
                    
                    <Input
                      id="passportFile"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDetailFormData({...detailFormData, passportFile: file});
                      }}
                      disabled={saving}
                      className="cursor-pointer"
                    />
                    {detailFormData.passportFile && (
                      <p className="text-xs text-gray-500 mt-1">
                        New file selected: {detailFormData.passportFile.name} ({(detailFormData.passportFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
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
                </div>
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Heart className="w-5 h-5 mr-2 text-pink-600" />
                    Preferences & Lifestyle
                  </h3>
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
                </div>
              </TabsContent>
              
              <TabsContent value="additional" className="space-y-6">
                <div className="bg-green-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-green-600" />
                    Additional Details
                  </h3>
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

      {/* Promote to Agent Dialog */}
      <AlertDialog open={isPromoteDialogOpen} onOpenChange={(open) => !open && setIsPromoteDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <span>Promote Customer to Agent</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to make "{promotingCustomer?.name}" into an agent?
              <br /><br />
              <strong>Note:</strong> This action cannot be undone easily. The customer will retain all their existing trip history and financial records.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPromoteToAgent}
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Promote to Agent
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={imagePreview.isOpen} onOpenChange={closeImagePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center space-x-2">
              <IdCard className="w-5 h-5" />
              <span>{imagePreview.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="relative">
              <img 
                src={imagePreview.src} 
                alt={imagePreview.title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={closeImagePreview}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export with error handler wrapper
export const CustomerManagement = withErrorHandler(CustomerManagementComponent);