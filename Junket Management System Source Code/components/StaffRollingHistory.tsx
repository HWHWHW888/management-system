import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Alert, AlertDescription } from './ui/alert';
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  MapPin, 
  Hash, 
  User as UserIcon, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  Scan,
  FileImage,
  ShieldCheck,
  Receipt,
  Database,
  RefreshCw,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CircleDollarSign,
  Wallet,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { RollingRecord, BuyInOutRecord, User, Customer, Staff } from '../types';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/client';

interface StaffRollingHistoryProps extends WithErrorHandlerProps {
  user: User;
  currentStaff: Staff;
}

// Real-time refresh interval (15 seconds)
const REAL_TIME_REFRESH_INTERVAL = 15000;

function StaffRollingHistoryComponent({ user, currentStaff, showError, clearError }: StaffRollingHistoryProps) {
  const [records, setRecords] = useState<RollingRecord[]>([]);
  const [buyInOutRecords, setBuyInOutRecords] = useState<BuyInOutRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<RollingRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RollingRecord | null>(null);
  const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });
  const [filterGameType, setFilterGameType] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'my_records'>('my_records');
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if user has admin privileges to see all records
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';

  // Load real-time data from Supabase
  const loadRealTimeData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      clearError();
      
      console.log('🔄 Loading real-time rolling history from Supabase...');
      
      // Load all data in parallel
      const [rollingRecords, buyInOutData, customerData] = await Promise.all([
        db.get<RollingRecord>('rollingRecords', []),
        db.get<BuyInOutRecord>('buyInOutRecords', []),
        db.get<Customer>('customers', [])
      ]);

      setCustomers(customerData);
      setBuyInOutRecords(buyInOutData);
      
      // Filter records based on user role
      let filteredRollingRecords = rollingRecords;
      
      // Staff users can only see their own records
      if (isStaff && !isAdmin) {
        filteredRollingRecords = rollingRecords.filter(record => record.staffId === currentStaff.id);
        console.log(`🔒 Staff user: filtered to ${filteredRollingRecords.length} own records out of ${rollingRecords.length} total`);
      }
      
      // Sort by recorded date (most recent first)
      const sortedRecords = filteredRollingRecords.sort((a: RollingRecord, b: RollingRecord) => 
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      
      setRecords(sortedRecords);
      setLastDataUpdate(new Date());
      
      console.log(`✅ Loaded real-time rolling history: ${sortedRecords.length} records, ${buyInOutData.length} buy-in/out records`);
      
    } catch (error) {
      console.error('❌ Failed to load real-time rolling records:', error);
      showError(`Failed to load rolling records: ${error.message}`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [clearError, showError, currentStaff.id, isStaff, isAdmin]);

  // Initial load and real-time sync
  useEffect(() => {
    loadRealTimeData();
    
    // Set up real-time refresh interval
    const refreshInterval = setInterval(() => {
      console.log('🔄 Real-time rolling history refresh triggered');
      loadRealTimeData();
    }, REAL_TIME_REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadRealTimeData]);

  useEffect(() => {
    applyFilters();
  }, [records, filterDateRange, filterGameType, filterCustomer, filterVerified, viewMode]);

  const applyFilters = () => {
    let filtered = [...records];

    // For staff users, always filter to their own records (double safety)
    if (isStaff && !isAdmin) {
      filtered = filtered.filter(record => record.staffId === currentStaff.id);
    } else if (isAdmin) {
      // For admin users, respect the view mode selection
      if (viewMode === 'my_records') {
        filtered = filtered.filter(record => record.staffId === currentStaff.id);
      }
      // For 'all' mode, show all records (no additional filtering)
    }

    // Date range filter
    if (filterDateRange.start) {
      filtered = filtered.filter(record => 
        new Date(record.sessionStartTime) >= new Date(filterDateRange.start)
      );
    }
    if (filterDateRange.end) {
      filtered = filtered.filter(record => 
        new Date(record.sessionStartTime) <= new Date(filterDateRange.end)
      );
    }

    // Game type filter
    if (filterGameType) {
      filtered = filtered.filter(record => 
        record.gameType.toLowerCase().includes(filterGameType.toLowerCase())
      );
    }

    // Customer filter
    if (filterCustomer) {
      filtered = filtered.filter(record => 
        record.customerName.toLowerCase().includes(filterCustomer.toLowerCase())
      );
    }

    // Verified status filter
    if (filterVerified !== 'all') {
      filtered = filtered.filter(record => 
        filterVerified === 'verified' ? record.verified : !record.verified
      );
    }

    setFilteredRecords(filtered);
  };

  const toggleVerification = async (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    // Staff users can only verify their own records
    if (isStaff && !isAdmin && record.staffId !== currentStaff.id) {
      showError('You can only verify your own records.');
      return;
    }

    const updatedRecord = {
      ...record,
      verified: !record.verified,
      verifiedBy: !record.verified ? user.id : undefined,
      verifiedAt: !record.verified ? new Date().toISOString() : undefined
    };

    try {
      setIsSaving(true);
      
      // Get all records from database (admin needs to update the full dataset)
      const allRecords = await db.get<RollingRecord>('rollingRecords', []);
      const updatedAllRecords = allRecords.map(r => r.id === recordId ? updatedRecord : r);
      
      // Save to Supabase immediately
      await db.save('rollingRecords', updatedAllRecords);
      
      // Update local state with filtered records
      const updatedLocalRecords = records.map(r => r.id === recordId ? updatedRecord : r);
      setRecords(updatedLocalRecords);
      
      console.log(`✅ Updated verification status for record ${recordId}`);
      
      // Refresh data to ensure consistency
      await loadRealTimeData();
      
    } catch (error) {
      console.error('❌ Failed to update verification status:', error);
      showError(`Failed to update verification status: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Get buy-in/buy-out data for a specific record
  const getBuyInOutForRecord = (record: RollingRecord) => {
    const customerBuyInOut = buyInOutRecords.filter(bio => 
      bio.customerId === record.customerId &&
      // Match records from same session timeframe (within 1 hour)
      Math.abs(new Date(bio.timestamp).getTime() - new Date(record.sessionStartTime).getTime()) <= 3600000
    );

    const buyInAmount = customerBuyInOut
      .filter(bio => bio.transactionType === 'buy-in')
      .reduce((sum, bio) => sum + bio.amount, 0);
    
    const buyOutAmount = customerBuyInOut
      .filter(bio => bio.transactionType === 'buy-out')
      .reduce((sum, bio) => sum + bio.amount, 0);

    return { buyInAmount, buyOutAmount, netCashFlow: buyOutAmount - buyInAmount };
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

  const calculateTotals = () => {
    return filteredRecords.reduce(
      (totals, record) => {
        const buyInOut = getBuyInOutForRecord(record);
        return {
          totalRolling: totals.totalRolling + (record.rollingAmount || 0),
          totalWinLoss: totals.totalWinLoss + (record.winLoss || 0),
          totalBuyIn: totals.totalBuyIn + buyInOut.buyInAmount,
          totalBuyOut: totals.totalBuyOut + buyInOut.buyOutAmount,
          recordCount: totals.recordCount + 1
        };
      },
      { totalRolling: 0, totalWinLoss: 0, totalBuyIn: 0, totalBuyOut: 0, recordCount: 0 }
    );
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading real-time rolling history from Supabase...</p>
          </div>
        </CardContent>
      </Card>
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
                ✅ Real-time Rolling History from Supabase
              </p>
              <p className="text-xs text-green-600">
                {isStaff && !isAdmin 
                  ? 'Showing only your records for privacy and security'
                  : 'Rolling records and buy-in/buy-out data update automatically'
                }
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
              disabled={isSaving || isRefreshing}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Access Control Notice for Staff */}
      {isStaff && !isAdmin && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Lock className="w-4 h-4 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Staff Privacy Protection
              </p>
              <p className="text-xs text-blue-600">
                You can only view and manage your own rolling records. Records from other staff members are not accessible for privacy and security reasons.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Tabs - Only show for Admin users */}
      {isAdmin && (
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'all' | 'my_records')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my_records" className="flex items-center space-x-2">
              <UserIcon className="w-4 h-4" />
              <span>My Records</span>
              <Badge variant="outline" className="text-xs">
                {records.filter(r => r.staffId === currentStaff.id).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center space-x-2">
              <Receipt className="w-4 h-4" />
              <span>All Records</span>
              <Badge variant="outline" className="text-xs">
                {records.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Staff-only header (when tabs are not shown) */}
      {isStaff && !isAdmin && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserIcon className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">My Rolling Records</h3>
            <Badge variant="outline" className="text-xs">
              {records.length} records
            </Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
              <Lock className="w-3 h-3 mr-1" />
              Private
            </Badge>
          </div>
        </div>
      )}

      {/* Enhanced Summary Cards with Buy-in/Buy-out */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-500">Total Rolling</p>
                <p className="text-2xl font-bold">${totals.totalRolling.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              {totals.totalWinLoss >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Total Win/Loss</p>
                <p className={`text-2xl font-bold ${
                  totals.totalWinLoss >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${totals.totalWinLoss.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ArrowDownCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Total Buy-in</p>
                <p className="text-2xl font-bold text-blue-600">${totals.totalBuyIn.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ArrowUpCircle className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Total Buy-out</p>
                <p className="text-2xl font-bold text-purple-600">${totals.totalBuyOut.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileImage className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {isStaff && !isAdmin ? 'My Records' : 'Records'}
                </p>
                <p className="text-2xl font-bold">{totals.recordCount}</p>
                <p className="text-xs text-gray-500">
                  Net: ${(totals.totalBuyOut - totals.totalBuyIn).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              Real-time Data
            </Badge>
            {isStaff && !isAdmin && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                <Lock className="w-3 h-3 mr-1" />
                Own Records Only
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm font-medium">Start Date</Label>
              <Input
                type="date"
                value={filterDateRange.start}
                onChange={(e) => setFilterDateRange({...filterDateRange, start: e.target.value})}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">End Date</Label>
              <Input
                type="date"
                value={filterDateRange.end}
                onChange={(e) => setFilterDateRange({...filterDateRange, end: e.target.value})}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Game Type</Label>
              <Input
                placeholder="Filter by game..."
                value={filterGameType}
                onChange={(e) => setFilterGameType(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Customer</Label>
              <Input
                placeholder="Filter by customer..."
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={filterVerified}
                onChange={(e) => setFilterVerified(e.target.value as 'all' | 'verified' | 'unverified')}
              >
                <option value="all">All Records</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Records List with Buy-in/Buy-out */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Receipt className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No rolling records found.</p>
              <p className="text-sm text-gray-400 mt-2">
                {isStaff && !isAdmin
                  ? 'You haven\'t recorded any rolling amounts yet.'
                  : viewMode === 'my_records' 
                    ? 'You haven\'t recorded any rolling amounts yet.' 
                    : 'No rolling records match the current filters.'
                }
              </p>
              <Button 
                variant="outline" 
                onClick={loadRealTimeData} 
                className="mt-4"
                disabled={isRefreshing}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => {
            const indicator = getWinLossIndicator(record.winLoss || 0);
            const IconComponent = indicator.icon;
            const buyInOut = getBuyInOutForRecord(record);
            
            return (
              <Card key={record.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center space-x-2">
                        <span>{record.gameType}</span>
                        {record.verified ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                        {record.ocrData && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <Scan className="w-3 h-3 mr-1" />
                            OCR
                          </Badge>
                        )}
                        <Badge className={`${indicator.bgColor} ${indicator.textColor} flex items-center space-x-1`}>
                          <IconComponent className={`w-3 h-3 ${indicator.iconColor}`} />
                          <span>{indicator.text}</span>
                        </Badge>
                        {record.venue === 'Okada Casino' && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <Building2 className="w-3 h-3 mr-1" />
                            Okada
                          </Badge>
                        )}
                        {(buyInOut.buyInAmount > 0 || buyInOut.buyOutAmount > 0) && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                            <Wallet className="w-3 h-3 mr-1" />
                            Cash Flow
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <UserIcon className="w-4 h-4 mr-1" />
                          {record.customerName}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(record.sessionStartTime).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {new Date(record.sessionStartTime).toLocaleTimeString()}
                        </span>
                        {record.venue && (
                          <span className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {record.venue}
                          </span>
                        )}
                        {record.tableNumber && (
                          <span className="flex items-center">
                            <Hash className="w-4 h-4 mr-1" />
                            {record.tableNumber}
                          </span>
                        )}
                        {/* Only show staff attribution for admin users in "all" view */}
                        {isAdmin && viewMode === 'all' && (
                          <span className="flex items-center">
                            <ShieldCheck className="w-4 h-4 mr-1" />
                            {record.staffName}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                      {(user.role === 'admin' || (user.role === 'staff' && record.staffId === currentStaff.id)) && (
                        <Button
                          variant={record.verified ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleVerification(record.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Activity className="w-4 h-4 animate-spin" />
                          ) : (
                            record.verified ? 'Unverify' : 'Verify'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Rolling Amount</p>
                      <p className="text-lg font-bold">${(record.rollingAmount || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Win/Loss</p>
                      <p className={`text-lg font-bold ${
                        (record.winLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${(record.winLoss || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Buy-in</p>
                      <p className="text-lg font-bold text-blue-600">${buyInOut.buyInAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Buy-out</p>
                      <p className="text-lg font-bold text-purple-600">${buyInOut.buyOutAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Net Cash Flow</p>
                      <p className={`text-lg font-bold ${
                        buyInOut.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${buyInOut.netCashFlow.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Session Duration</p>
                      <p className="text-sm">
                        {record.sessionEndTime 
                          ? `${Math.round((new Date(record.sessionEndTime).getTime() - new Date(record.sessionStartTime).getTime()) / (1000 * 60))} min`
                          : 'Ongoing'
                        }
                      </p>
                      <p className="text-xs text-gray-500">Recorded: {new Date(record.recordedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {record.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium text-gray-500">Notes</p>
                      <p className="text-sm text-gray-700 mt-1">{record.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Enhanced Record Details Dialog with Buy-in/Buy-out */}
      {selectedRecord && (
        <AlertDialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <AlertDialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center space-x-2">
                <span>Rolling Record Details</span>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Real-time Data
                </Badge>
                {isStaff && !isAdmin && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Lock className="w-3 h-3 mr-1" />
                    Own Record
                  </Badge>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Complete information for this rolling record including buy-in/buy-out data
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer</Label>
                    <p className="text-lg">{selectedRecord.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Agent</Label>
                    <p>{selectedRecord.agentName}</p>
                  </div>
                  {/* Only show staff info for admin users or if it's the user's own record */}
                  {(isAdmin || selectedRecord.staffId === currentStaff.id) && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Staff</Label>
                      <p>{selectedRecord.staffName}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Game Type</Label>
                    <p>{selectedRecord.gameType}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Venue</Label>
                    <p>{selectedRecord.venue || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Table Number</Label>
                    <p>{selectedRecord.tableNumber || 'Not specified'}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Session Start</Label>
                    <p>{new Date(selectedRecord.sessionStartTime).toLocaleString()}</p>
                  </div>
                  {selectedRecord.sessionEndTime && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Session End</Label>
                      <p>{new Date(selectedRecord.sessionEndTime).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Recorded At</Label>
                    <p>{new Date(selectedRecord.recordedAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Verification Status</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      {selectedRecord.verified ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary with Buy-in/Buy-out */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <CircleDollarSign className="w-4 h-4" />
                  <span>Financial Summary</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Rolling Amount</Label>
                    <p className="text-xl font-bold">${(selectedRecord.rollingAmount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Win/Loss</Label>
                    <p className={`text-xl font-bold ${
                      (selectedRecord.winLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${(selectedRecord.winLoss || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Buy-in Amount</Label>
                    <p className="text-xl font-bold text-blue-600">
                      ${(selectedRecord.buyInAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Buy-out Amount</Label>
                    <p className="text-xl font-bold text-purple-600">
                      ${(selectedRecord.buyOutAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Net Cash Flow</Label>
                    <p className={`text-xl font-bold ${
                      ((selectedRecord.buyOutAmount || 0) - (selectedRecord.buyInAmount || 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${((selectedRecord.buyOutAmount || 0) - (selectedRecord.buyInAmount || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRecord.ocrData && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center space-x-2">
                    <Scan className="w-4 h-4" />
                    <span>OCR Extraction Results</span>
                  </h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Confidence:</span> {Math.round(selectedRecord.ocrData.confidence * 100)}%</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRecord.ocrData.extractedFields.amount && (
                        <Badge variant="outline">Rolling: ${selectedRecord.ocrData.extractedFields.amount}</Badge>
                      )}
                      {selectedRecord.ocrData.extractedFields.buyIn && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Buy-in: ${selectedRecord.ocrData.extractedFields.buyIn}
                        </Badge>
                      )}
                      {selectedRecord.ocrData.extractedFields.buyOut && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          Buy-out: ${selectedRecord.ocrData.extractedFields.buyOut}
                        </Badge>
                      )}
                    </div>
                    <details>
                      <summary className="cursor-pointer font-medium">View extracted text</summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap">
                        {selectedRecord.ocrData.extractedText}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Attachments</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRecord.attachments.map((attachment) => (
                      <div key={attachment.id} className="border rounded p-2">
                        <p className="text-sm font-medium">{attachment.name}</p>
                        {attachment.type.startsWith('image/') && (
                          <img 
                            src={attachment.data} 
                            alt={attachment.name}
                            className="mt-2 max-h-32 w-auto rounded"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.notes && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-gray-700">{selectedRecord.notes}</p>
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Export with error handler wrapper
export const StaffRollingHistory = withErrorHandler(StaffRollingHistoryComponent);