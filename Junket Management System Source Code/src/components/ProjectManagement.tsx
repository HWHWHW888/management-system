import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { User, Trip, TripCustomer, TripAgent, TripExpense, Customer, Agent } from '../types';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';
import { 
  MapPin, RefreshCw, Activity, AlertTriangle, Info, Zap, Clock,
  Users, DollarSign, Settings, Plus, Edit, Trash2, Eye,
  Calculator, BarChart, UserCheck, X, CheckCircle, Save, Pencil
} from 'lucide-react';

interface ProjectManagementProps extends WithErrorHandlerProps {
  user: User;
}

const REAL_TIME_REFRESH_INTERVAL = 30000;

function ProjectManagementComponent({ user, showError, clearError }: ProjectManagementProps) {
  // Data states
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState('trips');
  const [selectedTripTab, setSelectedTripTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Dialog states
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [showDeleteAgent, setShowDeleteAgent] = useState(false);
  
  // Form states
  const [newTrip, setNewTrip] = useState<{
    name: string;
    description: string;
    date: string;
    endDate: string;
    venue: string;
    status: 'planned' | 'ongoing' | 'completed';
  }>({
    name: '',
    description: '',
    date: '',
    endDate: '',
    venue: '',
    status: 'planned'
  });

  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'flight' as const
  });

  const [newAgentShare, setNewAgentShare] = useState(25);
  const [editingAgent, setEditingAgent] = useState<TripAgent | null>(null);
  const [editAgentShare, setEditAgentShare] = useState(25);
  const [deletingAgent, setDeletingAgent] = useState<TripAgent | null>(null);

  // Helper functions
  const safeFormatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString();
  };

  const safeNumber = (value: number | undefined | null): number => {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return value;
  };

  // Permissions
  const isAdmin = user.role === 'admin';
  const isAgent = user.role === 'agent';

  // Enhanced data loading with better error handling
  const loadAllRealTimeData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      clearError();
      
      console.log('🔄 Loading project data from Supabase...');
      
      // Load all required data
      const [tripsData, customersData, agentsData] = await Promise.all([
        db.get('trips', []),
        db.get('customers', []),
        db.get('agents', [])
      ]);

      console.log('📊 Data loaded:', {
        trips: tripsData.length,
        customers: customersData.length,
        agents: agentsData.length
      });

      // Set data
      setTrips(tripsData);
      setCustomers(customersData);
      setAgents(agentsData);
      setLastSyncTime(new Date());
      setDataLoaded(true);
      
      // Update selected trip if it exists
      if (selectedTrip) {
        const updatedSelectedTrip = tripsData.find(t => t.id === selectedTrip.id);
        if (updatedSelectedTrip) {
          setSelectedTrip(updatedSelectedTrip);
        }
      }
      
      console.log(`✅ Project data loaded successfully: ${tripsData.length} trips`);
      
    } catch (error) {
      console.error('❌ Error loading project data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorMsg = `Failed to load project data: ${errorMessage}`;
      setErrorMessage(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [clearError, showError, selectedTrip]);

  // Initial data load and real-time updates
  useEffect(() => {
    loadAllRealTimeData();
    
    let refreshInterval: NodeJS.Timeout;
    if (isRealTimeEnabled) {
      refreshInterval = setInterval(() => {
        console.log('🔄 Real-time refresh triggered');
        loadAllRealTimeData();
      }, REAL_TIME_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [loadAllRealTimeData, isRealTimeEnabled]);

  // Get filtered trips based on user role
  const getFilteredTrips = () => {
    if (user.role === 'agent' && user.agentId) {
      return trips.filter(trip => 
        trip.agents?.some(agent => agent.agentId === user.agentId) || 
        trip.agentId === user.agentId
      );
    }
    return trips;
  };

  // Save trips to database
  const saveTrips = async (updatedTrips: Trip[]) => {
    try {
      setSaving(true);
      await db.save('trips', updatedTrips);
      setTrips(updatedTrips);
      setLastSyncTime(new Date());
      console.log('✅ Trips saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving trips:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save trips: ${errorMessage}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Create new trip
  const handleCreateTrip = async () => {
    if (!newTrip.name.trim() || !newTrip.date) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const trip: Trip = {
        id: Date.now().toString(),
        name: newTrip.name,
        description: newTrip.description || '',
        date: newTrip.date,
        status: newTrip.status,
        agents: user.role === 'agent' && user.agentId ? [{
          agentId: user.agentId,
          agentName: user.username,
          sharePercentage: 100,
          calculatedShare: 0
        }] : [],
        customers: [],
        expenses: [],
        totalRolling: 0,
        totalWinLoss: 0,
        totalBuyIn: 0,
        totalBuyOut: 0,
        calculatedTotalRolling: 0,
        sharing: {
          totalWinLoss: 0,
          totalExpenses: 0,
          totalRollingCommission: 0,
          totalBuyIn: 0,
          totalBuyOut: 0,
          netCashFlow: 0,
          netResult: 0,
          totalAgentShare: 0,
          companyShare: 0,
          agentSharePercentage: 0,
          companySharePercentage: 100,
          agentBreakdown: []
        },
        createdAt: new Date().toISOString(),
        attachments: [],
        lastDataUpdate: new Date().toISOString(),
        activeCustomersCount: 0,
        recentActivityCount: 0,
        totalExpenses: 0
      };

      const updatedTrips = [...trips, trip];
      await saveTrips(updatedTrips);
      
      setShowCreateTrip(false);
      setNewTrip({
        name: '',
        description: '',
        date: '',
        endDate: '',
        venue: '',
        status: 'planned'
      });
      
      console.log('✅ Trip created successfully:', trip.name);
      
    } catch (error) {
      console.error('❌ Error creating trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to create trip: ${errorMessage}`);
    }
  };

  // Select trip for detailed view
  const selectTrip = (trip: Trip) => {
    console.log('🎯 Selecting trip for details:', trip.name);
    setSelectedTrip(trip);
    setActiveTab('trip-details');
    setSelectedTripTab('overview');
  };

  // Add customer to trip
  const handleAddCustomerToTrip = async (customerId: string) => {
    if (!selectedTrip) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    if (selectedTrip.customers.some(tc => tc.customerId === customerId)) {
      showError('Customer is already added to this trip');
      return;
    }

    try {
      const newTripCustomer: TripCustomer = {
        customerId: customer.id,
        customerName: customer.name,
        rollingAmount: 0,
        winLoss: 0,
        buyInAmount: 0,
        buyOutAmount: 0,
        netCashFlow: 0,
        rollingPercentage: customer.rollingPercentage || 1.4,
        calculatedRollingAmount: 0,
        selectedGames: [],
        isActive: true,
        lastActivityTime: null
      };

      const updatedTrip = {
        ...selectedTrip,
        customers: [...selectedTrip.customers, newTripCustomer],
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowAddCustomer(false);
      
      console.log('✅ Customer added to trip:', customer.name);
    } catch (error) {
      console.error('❌ Error adding customer to trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to add customer to trip: ${errorMessage}`);
    }
  };

  // Remove customer from trip
  const handleRemoveCustomerFromTrip = async (customerId: string) => {
    if (!selectedTrip) return;

    try {
      const updatedTrip = {
        ...selectedTrip,
        customers: selectedTrip.customers.filter(tc => tc.customerId !== customerId),
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      
      console.log('✅ Customer removed from trip');
    } catch (error) {
      console.error('❌ Error removing customer from trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to remove customer from trip: ${errorMessage}`);
    }
  };

  // Add agent to trip
  const handleAddAgentToTrip = async (agentId: string) => {
    if (!selectedTrip) return;

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    if (selectedTrip.agents.some(ta => ta.agentId === agentId)) {
      showError('Agent is already added to this trip');
      return;
    }

    if (newAgentShare <= 0 || newAgentShare > 100) {
      showError('Please enter a valid share percentage between 1 and 100');
      return;
    }

    try {
      const newTripAgent: TripAgent = {
        agentId: agent.id,
        agentName: agent.name,
        sharePercentage: newAgentShare,
        calculatedShare: 0
      };

      const updatedTrip = {
        ...selectedTrip,
        agents: [...selectedTrip.agents, newTripAgent],
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowAddAgent(false);
      setNewAgentShare(25);
      
      console.log('✅ Agent added to trip:', agent.name);
    } catch (error) {
      console.error('❌ Error adding agent to trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to add agent to trip: ${errorMessage}`);
    }
  };

  // Edit agent share
  const handleEditAgentShare = async () => {
    if (!selectedTrip || !editingAgent) return;

    if (editAgentShare <= 0 || editAgentShare > 100) {
      showError('Please enter a valid share percentage between 1 and 100');
      return;
    }

    try {
      const updatedTrip = {
        ...selectedTrip,
        agents: selectedTrip.agents.map(agent => 
          agent.agentId === editingAgent.agentId 
            ? { ...agent, sharePercentage: editAgentShare }
            : agent
        ),
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowEditAgent(false);
      setEditingAgent(null);
      setEditAgentShare(25);
      
      console.log('✅ Agent share updated:', editingAgent.agentName);
    } catch (error) {
      console.error('❌ Error updating agent share:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to update agent share: ${errorMessage}`);
    }
  };

  // Delete agent from trip
  const handleDeleteAgentFromTrip = async () => {
    if (!selectedTrip || !deletingAgent) return;

    try {
      const updatedTrip = {
        ...selectedTrip,
        agents: selectedTrip.agents.filter(agent => agent.agentId !== deletingAgent.agentId),
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowDeleteAgent(false);
      setDeletingAgent(null);
      
      console.log('✅ Agent removed from trip:', deletingAgent.agentName);
    } catch (error) {
      console.error('❌ Error removing agent from trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to remove agent from trip: ${errorMessage}`);
    }
  };

  // Open edit agent dialog
  const openEditAgentDialog = (agent: TripAgent) => {
    setEditingAgent(agent);
    setEditAgentShare(agent.sharePercentage);
    setShowEditAgent(true);
  };

  // Open delete agent dialog
  const openDeleteAgentDialog = (agent: TripAgent) => {
    setDeletingAgent(agent);
    setShowDeleteAgent(true);
  };

  // Add expense to trip
  const handleAddExpense = async () => {
    if (!selectedTrip || !newExpense.description.trim() || newExpense.amount <= 0) {
      showError('Please fill in all expense fields');
      return;
    }

    try {
      const expense: TripExpense = {
        id: Date.now().toString(),
        description: newExpense.description,
        amount: newExpense.amount,
        category: newExpense.category,
        date: new Date().toISOString().split('T')[0],
        addedBy: user.username,
        addedAt: new Date().toISOString()
      };

      const updatedTrip = {
        ...selectedTrip,
        expenses: [...selectedTrip.expenses, expense],
        lastDataUpdate: new Date().toISOString()
      };

      const updatedTrips = trips.map(t => t.id === selectedTrip.id ? updatedTrip : t);
      await saveTrips(updatedTrips);
      setSelectedTrip(updatedTrip);
      setShowAddExpense(false);
      setNewExpense({
        description: '',
        amount: 0,
        category: 'flight'
      });
      
      console.log('✅ Expense added to trip:', expense.description);
    } catch (error) {
      console.error('❌ Error adding expense to trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to add expense to trip: ${errorMessage}`);
    }
  };

  // Calculate trip financials
  const calculateTripFinancials = (trip: Trip) => {
    const totalRolling = trip.customers.reduce((sum, customer) => sum + safeNumber(customer.rollingAmount), 0);
    const totalWinLoss = trip.customers.reduce((sum, customer) => sum + safeNumber(customer.winLoss), 0);
    const totalBuyIn = trip.customers.reduce((sum, customer) => sum + safeNumber(customer.buyInAmount), 0);
    const totalBuyOut = trip.customers.reduce((sum, customer) => sum + safeNumber(customer.buyOutAmount), 0);
    const totalExpenses = trip.expenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
    const netCashFlow = totalBuyOut - totalBuyIn;
    const rollingCommission = trip.customers.reduce((sum, customer) => 
      sum + (safeNumber(customer.rollingAmount) * safeNumber(customer.rollingPercentage) / 100), 0);
    const houseGrossWin = -totalWinLoss;
    const houseNetWin = houseGrossWin - rollingCommission;
    const netResult = houseNetWin - totalExpenses;

    return {
      totalRolling,
      totalWinLoss,
      totalBuyIn,
      totalBuyOut,
      totalExpenses,
      netCashFlow,
      rollingCommission,
      houseGrossWin,
      houseNetWin,
      netResult
    };
  };

  const filteredTrips = getFilteredTrips();

  // Loading state
  if (loading && !dataLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Project Data</h3>
          <p className="text-sm text-gray-600">Connecting to Supabase and loading trips, customers, and agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                🎯 Project Management - Agent Share CRUD Added
              </p>
              <p className="text-xs text-blue-600">
                Full CRUD functionality for agent shares now available in trip details
                {lastSyncTime && ` • Last sync: ${lastSyncTime.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {saving && (
              <div className="flex items-center text-blue-600">
                <Activity className="w-4 h-4 mr-1 animate-pulse" />
                <span className="text-xs">Saving...</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadAllRealTimeData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              className="text-xs"
            >
              <Zap className={`w-3 h-3 mr-1 ${isRealTimeEnabled ? 'text-green-500' : 'text-gray-500'}`} />
              {isRealTimeEnabled ? 'Live' : 'Manual'}
            </Button>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              <CheckCircle className="w-2 h-2 mr-1" />
              CRUD Ready
            </Badge>
          </div>
        </div>
      </div>

      {/* Data Loading Status */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Trips Loaded</p>
                <p className="text-2xl font-bold text-blue-600">{trips.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Customers Available</p>
                <p className="text-2xl font-bold text-green-600">{customers.length}</p>
              </div>
              <Users className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agents Available</p>
                <p className="text-2xl font-bold text-purple-600">{agents.length}</p>
              </div>
              <UserCheck className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {errorMessage}
            <Button
              onClick={loadAllRealTimeData}
              size="sm"
              variant="outline"
              className="ml-3 text-red-800 border-red-300 hover:bg-red-100"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            All Trips
          </TabsTrigger>
          <TabsTrigger value="trip-details" disabled={!selectedTrip} className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Trip Details {selectedTrip && `- ${selectedTrip.name}`}
          </TabsTrigger>
        </TabsList>

        {/* All Trips Tab */}
        <TabsContent value="trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Project Management</h2>
              <p className="text-gray-600">
                Manage trips and project data with full CRUD functionality
                {user.role === 'agent' && ' (Your trips only)'}
              </p>
            </div>
            {(isAdmin || isAgent) && (
              <Dialog open={showCreateTrip} onOpenChange={setShowCreateTrip}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Trip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Trip</DialogTitle>
                    <DialogDescription>
                      Create a new trip that will be saved to Supabase database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tripName">Trip Name *</Label>
                      <Input
                        id="tripName"
                        value={newTrip.name}
                        onChange={(e) => setNewTrip({...newTrip, name: e.target.value})}
                        placeholder="Enter trip name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tripDescription">Description</Label>
                      <Textarea
                        id="tripDescription"
                        value={newTrip.description}
                        onChange={(e) => setNewTrip({...newTrip, description: e.target.value})}
                        placeholder="Trip description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newTrip.date}
                          onChange={(e) => setNewTrip({...newTrip, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={newTrip.endDate}
                          onChange={(e) => setNewTrip({...newTrip, endDate: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="venue">Venue</Label>
                      <Input
                        id="venue"
                        value={newTrip.venue}
                        onChange={(e) => setNewTrip({...newTrip, venue: e.target.value})}
                        placeholder="Casino venue"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={newTrip.status} 
                        onValueChange={(value) => 
                          setNewTrip({...newTrip, status: value as 'planned' | 'ongoing' | 'completed'})
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreateTrip(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTrip} disabled={saving}>
                        {saving ? 'Creating...' : 'Create Trip'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Trips List */}
          {filteredTrips.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {!dataLoaded ? 'Loading trips...' : 'No trips found'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {!dataLoaded 
                    ? 'Please wait while we load your trip data from Supabase.'
                    : 'Create your first trip to start managing projects and customer rolling amounts.'
                  }
                </p>
                {dataLoaded && (isAdmin || isAgent) && (
                  <Button onClick={() => setShowCreateTrip(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Trip
                  </Button>
                )}
                {!dataLoaded && (
                  <Button onClick={loadAllRealTimeData} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Loading
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTrips.map((trip) => {
                const financials = calculateTripFinancials(trip);
                return (
                  <Card key={trip.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{trip.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {trip.description} • {trip.date}
                          </CardDescription>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            trip.status === 'completed' ? 'default' : 
                            trip.status === 'ongoing' ? 'secondary' : 'outline'
                          }>
                            {trip.status?.charAt(0).toUpperCase() + trip.status?.slice(1)}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => selectTrip(trip)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                      
                      {/* Trip Summary Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="text-center">
                          <div className="text-gray-500 text-sm">Customers</div>
                          <div className="font-medium">{trip.customers?.length || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-sm">Rolling</div>
                          <div className="font-medium text-blue-600">HK${safeFormatNumber(financials.totalRolling)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-sm">Win/Loss</div>
                          <div className={`font-medium ${financials.totalWinLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            HK${safeFormatNumber(financials.totalWinLoss)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500 text-sm">Net Result</div>
                          <div className={`font-medium ${financials.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            HK${safeFormatNumber(financials.netResult)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Trip Details Tab */}
        <TabsContent value="trip-details" className="space-y-4">
          {selectedTrip ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrip.name}</h2>
                  <p className="text-gray-600">{selectedTrip.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <Badge variant={
                      selectedTrip.status === 'completed' ? 'default' : 
                      selectedTrip.status === 'ongoing' ? 'secondary' : 'outline'
                    }>
                      {selectedTrip.status?.charAt(0).toUpperCase() + selectedTrip.status?.slice(1)}
                    </Badge>
                    <span className="text-sm text-gray-500">{selectedTrip.date}</span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setActiveTab('trips')}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Back to Trips
                </Button>
              </div>

              {/* Trip Details Tabs */}
              <Tabs value={selectedTripTab} onValueChange={setSelectedTripTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview" className="flex items-center gap-1">
                    <BarChart className="w-3 h-3" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Customers
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Agents
                  </TabsTrigger>
                  <TabsTrigger value="expenses" className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Expenses
                  </TabsTrigger>
                  <TabsTrigger value="financials" className="flex items-center gap-1">
                    <Calculator className="w-3 h-3" />
                    Financials
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  {(() => {
                    const financials = calculateTripFinancials(selectedTrip);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Total Rolling</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-blue-600">HK${safeFormatNumber(financials.totalRolling)}</div>
                            <p className="text-xs text-gray-500">{selectedTrip.customers.length} customers</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Win/Loss</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${financials.totalWinLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              HK${safeFormatNumber(financials.totalWinLoss)}
                            </div>
                            <p className="text-xs text-gray-500">Customer perspective</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Expenses</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-orange-600">HK${safeFormatNumber(financials.totalExpenses)}</div>
                            <p className="text-xs text-gray-500">{selectedTrip.expenses.length} items</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-600">Net Result</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${financials.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              HK${safeFormatNumber(financials.netResult)}
                            </div>
                            <p className="text-xs text-gray-500">After expenses</p>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Customers ({selectedTrip.customers.length})</h3>
                    <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Customer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Customer to Trip</DialogTitle>
                          <DialogDescription>
                            Select from available customers ({customers.length} total)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {customers
                            .filter(c => !selectedTrip.customers.some(tc => tc.customerId === c.id))
                            .map(customer => (
                              <div key={customer.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-sm text-gray-500">{customer.email}</div>
                                  <div className="text-xs text-gray-400">Agent: {customer.agentName}</div>
                                </div>
                                <Button size="sm" onClick={() => handleAddCustomerToTrip(customer.id)}>
                                  Add
                                </Button>
                              </div>
                            ))}
                          {customers.filter(c => !selectedTrip.customers.some(tc => tc.customerId === c.id)).length === 0 && (
                            <p className="text-center text-gray-500 py-8">All customers are already added to this trip</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {selectedTrip.customers.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No customers added to this trip</p>
                        <Button className="mt-4" onClick={() => setShowAddCustomer(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Customer
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {selectedTrip.customers.map(tripCustomer => (
                        <Card key={tripCustomer.customerId}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{tripCustomer.customerName}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                  <div>
                                    <span className="text-sm text-gray-500">Rolling:</span>
                                    <div className="font-medium text-blue-600">HK${safeFormatNumber(tripCustomer.rollingAmount)}</div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Win/Loss:</span>
                                    <div className={`font-medium ${tripCustomer.winLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      HK${safeFormatNumber(tripCustomer.winLoss)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Buy-in:</span>
                                    <div className="font-medium">HK${safeFormatNumber(tripCustomer.buyInAmount)}</div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Buy-out:</span>
                                    <div className="font-medium">HK${safeFormatNumber(tripCustomer.buyOutAmount)}</div>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveCustomerFromTrip(tripCustomer.customerId)}
                                disabled={saving}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Enhanced Agents Tab with Full CRUD */}
                <TabsContent value="agents" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">Trip Agents ({selectedTrip.agents.length})</h3>
                      <p className="text-sm text-gray-500">Manage agent shares with full CRUD functionality</p>
                    </div>
                    <Dialog open={showAddAgent} onOpenChange={setShowAddAgent}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Agent
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Agent to Trip</DialogTitle>
                          <DialogDescription>
                            Select an agent and set their share percentage
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="sharePercentage">Share Percentage *</Label>
                            <Input
                              id="sharePercentage"
                              type="number"
                              value={newAgentShare}
                              onChange={(e) => setNewAgentShare(parseFloat(e.target.value) || 0)}
                              placeholder="Enter percentage (e.g., 25)"
                              min="0.1"
                              max="100"
                              step="0.1"
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter a value between 0.1 and 100</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Available Agents</Label>
                            {agents
                              .filter(a => !selectedTrip.agents.some(ta => ta.agentId === a.id))
                              .map(agent => (
                                <div key={agent.id} className="flex items-center justify-between p-3 border rounded">
                                  <div>
                                    <div className="font-medium">{agent.name}</div>
                                    <div className="text-sm text-gray-500">{agent.email}</div>
                                  </div>
                                  <Button size="sm" onClick={() => handleAddAgentToTrip(agent.id)}>
                                    Add
                                  </Button>
                                </div>
                              ))}
                            {agents.filter(a => !selectedTrip.agents.some(ta => ta.agentId === a.id)).length === 0 && (
                              <p className="text-center text-gray-500 py-4">All agents are already added to this trip</p>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {selectedTrip.agents.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No agents assigned to this trip</p>
                        <Button className="mt-4" onClick={() => setShowAddAgent(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Agent
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {selectedTrip.agents.map(tripAgent => (
                        <Card key={tripAgent.agentId}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{tripAgent.agentName}</h4>
                                <div className="flex items-center space-x-6 mt-2">
                                  <div>
                                    <span className="text-sm text-gray-500">Share Percentage:</span>
                                    <span className="font-medium ml-1 text-blue-600">{tripAgent.sharePercentage}%</span>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-500">Calculated Share:</span>
                                    <span className="font-medium ml-1 text-green-600">
                                      HK${safeFormatNumber(tripAgent.calculatedShare)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditAgentDialog(tripAgent)}
                                  disabled={saving}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeleteAgentDialog(tripAgent)}
                                  disabled={saving}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Edit Agent Dialog */}
                  <Dialog open={showEditAgent} onOpenChange={setShowEditAgent}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Agent Share</DialogTitle>
                        <DialogDescription>
                          Update {editingAgent?.agentName}'s share percentage
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="editSharePercentage">Share Percentage *</Label>
                          <Input
                            id="editSharePercentage"
                            type="number"
                            value={editAgentShare}
                            onChange={(e) => setEditAgentShare(parseFloat(e.target.value) || 0)}
                            placeholder="Enter percentage (e.g., 25)"
                            min="0.1"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter a value between 0.1 and 100</p>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowEditAgent(false)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleEditAgentShare} disabled={saving}>
                            {saving ? 'Updating...' : 'Update Share'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Delete Agent Confirmation Dialog */}
                  <AlertDialog open={showDeleteAgent} onOpenChange={setShowDeleteAgent}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Agent from Trip</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove <strong>{deletingAgent?.agentName}</strong> from this trip? 
                          This will remove their {deletingAgent?.sharePercentage}% share allocation.
                          <br /><br />
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAgentFromTrip}
                          disabled={saving}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {saving ? 'Removing...' : 'Remove Agent'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Trip Expenses ({selectedTrip.expenses.length})</h3>
                    <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Expense
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Expense</DialogTitle>
                          <DialogDescription>
                            Record a new expense for this trip
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="expenseDescription">Description</Label>
                            <Input
                              id="expenseDescription"
                              value={newExpense.description}
                              onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                              placeholder="Expense description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="expenseAmount">Amount (HKD)</Label>
                            <Input
                              id="expenseAmount"
                              type="number"
                              value={newExpense.amount}
                              onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                              placeholder="0.00"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="expenseCategory">Category</Label>
                            <Select 
                              value={newExpense.category} 
                              onValueChange={(value: any) => setNewExpense({...newExpense, category: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flight">Flight</SelectItem>
                                <SelectItem value="hotel">Hotel</SelectItem>
                                <SelectItem value="entertainment">Entertainment</SelectItem>
                                <SelectItem value="meal">Meal</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setShowAddExpense(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddExpense}>
                              Add Expense
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {selectedTrip.expenses.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No expenses recorded for this trip</p>
                        <Button className="mt-4" onClick={() => setShowAddExpense(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Expense
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Added By</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedTrip.expenses.map(expense => (
                              <TableRow key={expense.id}>
                                <TableCell className="font-medium">{expense.description}</TableCell>
                                <TableCell className="capitalize">{expense.category}</TableCell>
                                <TableCell>{expense.date}</TableCell>
                                <TableCell>{expense.addedBy}</TableCell>
                                <TableCell className="text-right font-medium">
                                  HK${safeFormatNumber(expense.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Financials Tab */}
                <TabsContent value="financials" className="space-y-4">
                  {(() => {
                    const financials = calculateTripFinancials(selectedTrip);
                    return (
                      <div className="space-y-6">
                        <h3 className="text-lg font-medium">Trip Financial Summary</h3>
                        
                        {/* Financial Flow Chart */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Financial Flow</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                                <span className="font-medium">Total Rolling</span>
                                <span className="text-blue-600 font-bold">HK${safeFormatNumber(financials.totalRolling)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                <span className="font-medium">Customer Win/Loss</span>
                                <span className={`font-bold ${financials.totalWinLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  HK${safeFormatNumber(financials.totalWinLoss)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                                <span className="font-medium">House Gross Win</span>
                                <span className="text-green-600 font-bold">HK${safeFormatNumber(financials.houseGrossWin)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                                <span className="font-medium">Rolling Commission</span>
                                <span className="text-purple-600 font-bold">-HK${safeFormatNumber(financials.rollingCommission)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                                <span className="font-medium">Total Expenses</span>
                                <span className="text-orange-600 font-bold">-HK${safeFormatNumber(financials.totalExpenses)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border-2 border-green-300">
                                <span className="font-bold text-lg">Net Result</span>
                                <span className={`font-bold text-xl ${financials.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  HK${safeFormatNumber(financials.netResult)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Cash Flow Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Cash Flow</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-sm">Total Buy-in:</span>
                                  <span className="font-medium">HK${safeFormatNumber(financials.totalBuyIn)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm">Total Buy-out:</span>
                                  <span className="font-medium">HK${safeFormatNumber(financials.totalBuyOut)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="font-medium">Net Cash Flow:</span>
                                  <span className={`font-bold ${financials.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    HK${safeFormatNumber(financials.netCashFlow)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Agent Shares</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-sm">Total Agents:</span>
                                  <span className="font-medium">{selectedTrip.agents.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm">Total Share %:</span>
                                  <span className="font-medium">
                                    {selectedTrip.agents.reduce((sum, agent) => sum + agent.sharePercentage, 0).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="font-medium">Company Share:</span>
                                  <span className="font-medium text-blue-600">
                                    {(100 - selectedTrip.agents.reduce((sum, agent) => sum + agent.sharePercentage, 0)).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Trip Selected</h3>
                <p className="text-gray-500 mb-4">
                  Please select a trip from the trips list to view detailed information.
                </p>
                <Button onClick={() => setActiveTab('trips')}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Go to Trips List
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export with error handling
export const ProjectManagement = withErrorHandler(ProjectManagementComponent);
export default ProjectManagement;