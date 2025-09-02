import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { CustomerManagement } from './components/CustomerManagement';
import { AgentManagement } from './components/AgentManagement';
import { StaffManagement } from './components/StaffManagement';
import { StaffPortal } from './components/StaffPortal';
import { ProjectManagement } from './components/ProjectManagement';
import { Reports } from './components/Reports';
import { DataManagement } from './components/DataManagement';
import { Button } from './components/ui/button';
import { Alert, AlertDescription } from './components/ui/alert';
import { LogOut, Users, UserCheck, BarChart3, MapPin, ShieldCheck, Clock, Database, Settings, AlertTriangle, CheckCircle, Wifi, RefreshCw, Bug, Shield } from 'lucide-react';
import { User } from './types';
import { db } from './utils/api/databaseWrapper';
import { Badge } from './components/ui/badge';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDatabaseHealthy, setIsDatabaseHealthy] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [dataPreservationMessage, setDataPreservationMessage] = useState('');

  useEffect(() => {
    initializeApplication();
  }, []);

  const initializeApplication = async () => {
    setIsInitializing(true);
    setErrorMessage('');
    setDataPreservationMessage('');

    try {
      console.log('🚀 Initializing Casino Management System with data preservation...');
      
      // Test connection with detailed feedback
      const connectionTest = await db.testConnection();
      setConnectionDetails(connectionTest);
      
      if (!connectionTest.success) {
        setIsDatabaseHealthy(false);
        throw new Error(`Database connection failed: ${connectionTest.message}. ${connectionTest.details || ''}`);
      }

      // Check Supabase health
      const isHealthy = await db.isHealthy();
      setIsDatabaseHealthy(isHealthy);

      if (!isHealthy) {
        throw new Error('Supabase database health check failed. The server may be temporarily unavailable.');
      }

      // UPDATED: Safe initialization that preserves existing data
      console.log('🛡️ Performing safe database initialization (preserving existing data)...');
      await db.initializeSampleDataIfNeeded();
      
      // Get data count after initialization to show preservation message
      try {
        const usersCount = (await db.get('users', [])).length;
        const customersCount = (await db.get('customers', [])).length;
        const agentsCount = (await db.get('agents', [])).length;
        const tripsCount = (await db.get('trips', [])).length;
        
        const totalRecords = usersCount + customersCount + agentsCount + tripsCount;
        if (totalRecords > 1) { // More than just the admin user
          setDataPreservationMessage(
            `✅ Data preserved: ${usersCount} users, ${customersCount} customers, ${agentsCount} agents, ${tripsCount} trips`
          );
        }
      } catch (error) {
        console.warn('Could not get data counts:', error);
      }

      // Check for saved user session
      const savedUser = localStorage.getItem('casinoUser');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
          console.log('👤 Restored user session:', user.username);
          
          // Restore token to API client if available
          if (user.token) {
            const { apiClient } = await import('./utils/api/apiClient');
            apiClient.setToken(user.token);
            console.log('🔑 Token restored to API client');
          }
          
          // Set default tab based on user role
          if (user.role === 'staff') {
            setActiveTab('checkinout');
          } else {
            setActiveTab('dashboard');
          }
        } catch (error) {
          console.error('Error parsing saved user session:', error);
          localStorage.removeItem('casinoUser');
        }
      }

      console.log('✅ Application initialization completed with data preservation');

    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      setErrorMessage(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setIsDatabaseHealthy(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogin = async (user: User) => {
    try {
      // Verify database health before allowing login
      const isHealthy = await db.isHealthy();
      if (!isHealthy) {
        throw new Error('Database is not available. Please try again later.');
      }

      setCurrentUser(user);
      
      // Preserve token if it exists in localStorage (set by databaseWrapper.login)
      const existingUser = localStorage.getItem('casinoUser');
      if (existingUser) {
        try {
          const parsedUser = JSON.parse(existingUser);
          if (parsedUser.token) {
            const userWithToken = { ...user, token: parsedUser.token };
            localStorage.setItem('casinoUser', JSON.stringify(userWithToken));
          } else {
            localStorage.setItem('casinoUser', JSON.stringify(user));
          }
        } catch (error) {
          localStorage.setItem('casinoUser', JSON.stringify(user));
        }
      } else {
        localStorage.setItem('casinoUser', JSON.stringify(user));
      }
      
      // Set default tab based on user role
      if (user.role === 'staff') {
        setActiveTab('checkinout');
      } else {
        setActiveTab('dashboard');
      }

      setErrorMessage('');
      console.log('👤 User logged in:', user.username, 'Role:', user.role);
    } catch (error) {
      console.error('❌ Login error:', error);
      setErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    localStorage.removeItem('casinoUser');
    
    // Clear token from API client
    try {
      const { apiClient } = await import('./utils/api/apiClient');
      apiClient.setToken('');
      console.log('🔑 Token cleared from API client');
    } catch (error) {
      console.warn('Failed to clear token from API client:', error);
    }
    
    setActiveTab('dashboard');
    setErrorMessage('');
    console.log('👤 User logged out');
  };

  const refreshDatabaseHealth = async () => {
    try {
      setIsInitializing(true);
      
      // Run full connection test
      const connectionTest = await db.testConnection();
      setConnectionDetails(connectionTest);
      
      const isHealthy = await db.isHealthy();
      setIsDatabaseHealthy(isHealthy);
      
      if (isHealthy) {
        setErrorMessage('');
        console.log('✅ Database health check passed');
      } else {
        setErrorMessage('Database connection issues detected. Some features may not work properly.');
        console.warn('⚠️ Database health check failed');
      }
    } catch (error) {
      console.error('❌ Database health check error:', error);
      setIsDatabaseHealthy(false);
      setErrorMessage(`Database error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">Initializing Casino Management System</h2>
          <p className="text-sm text-gray-600 mb-4">Connecting to Supabase database with data preservation...</p>
          
          {connectionDetails && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Connection Status</span>
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>Status: {connectionDetails.success ? '✅ Connected' : '❌ Failed'}</div>
                <div>Message: {connectionDetails.message}</div>
                {connectionDetails.details && <div>Details: {connectionDetails.details}</div>}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Data Protection</span>
            </div>
            <p className="text-xs text-green-700">
              Your existing data is safe. The system will not clear any entered information during initialization.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div>
        {/* Show error banner above login form if there are issues */}
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Database Connection Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{errorMessage}</p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <Button
                    onClick={refreshDatabaseHealth}
                    size="sm"
                    variant="outline"
                    className="text-red-800 border-red-300 hover:bg-red-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Connection
                  </Button>
                  <Button
                    onClick={() => setDebugMode(!debugMode)}
                    size="sm"
                    variant="outline"
                    className="text-red-800 border-red-300 hover:bg-red-100"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    {debugMode ? 'Hide' : 'Show'} Debug Info
                  </Button>
                </div>
                
                {debugMode && connectionDetails && (
                  <div className="mt-3 p-2 bg-red-100 rounded text-xs">
                    <pre className="text-red-800">{JSON.stringify(connectionDetails, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const isAgent = currentUser.role === 'agent';
  const isStaff = currentUser.role === 'staff';

  // Helper function to get display role
  const getDisplayRole = () => {
    return currentUser.role.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Casino Management System</h1>
              <Badge variant="secondary" className="text-xs">
                {getDisplayRole()}
              </Badge>
              <Badge variant="default" className="text-xs flex items-center gap-1">
                <Database className="w-3 h-3" />
                Supabase
              </Badge>
              {/* Health indicator */}
              <Badge 
                variant="outline"
                className={`text-xs flex items-center gap-1 ${
                  isDatabaseHealthy ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
                }`}
              >
                {isDatabaseHealthy ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Connected
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Issues
                  </>
                )}
              </Badge>
              {/* Data Protection Badge */}
              <Badge variant="outline" className="text-xs flex items-center gap-1 border-blue-200 text-blue-700">
                <Shield className="w-3 h-3" />
                Data Protected
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              {!isDatabaseHealthy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshDatabaseHealth}
                  className="text-xs"
                >
                  <Wifi className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
              )}
              <span className="text-sm text-gray-600">Welcome, {currentUser.username}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {errorMessage && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Database Error:</strong> {errorMessage}
              <div className="mt-2">
                <Button
                  onClick={refreshDatabaseHealth}
                  size="sm"
                  variant="outline"
                  className="text-red-800 border-red-300 hover:bg-red-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Data Preservation Status */}
        {dataPreservationMessage && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <Shield className="w-5 h-5 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Data Preserved:</strong> {dataPreservationMessage}
              <p className="text-xs text-green-600 mt-1">
                Your keyed-in data is safe and will persist across system refreshes and upgrades.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Database Status Banner */}
        {isDatabaseHealthy && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    ✅ Supabase Database Connected with Data Protection
                  </p>
                  <p className="text-xs text-green-600">
                    All data is securely stored and synced with cloud database. Your entered data is preserved across refreshes.
                    {connectionDetails?.details && ` ${connectionDetails.details}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Live
                </Badge>
                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                  <Shield className="w-3 h-3 mr-1" />
                  Protected
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Staff Welcome Message */}
        {isStaff && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Welcome to the Staff Portal
                </p>
                <p className="text-xs text-blue-600">
                  You have access to customer information, agent details, check-in/out functions, and reports.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          {/* Dashboard - Only for admin and agent */}
          {(isAdmin || isAgent) && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </button>
          )}

          {/* Check-in/Out - First tab for staff */}
          {isStaff && (
            <button
              onClick={() => setActiveTab('checkinout')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'checkinout'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4 mr-2" />
              Check-in/Out
            </button>
          )}

          {/* Customers - For admin, agent, and staff */}
          {(isAdmin || isAgent || isStaff) && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'customers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Customers {isStaff && <span className="ml-1 text-xs text-gray-500">(View)</span>}
            </button>
          )}

          {/* Agents - For admin and staff */}
          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'agents'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Agents {isStaff && <span className="ml-1 text-xs text-gray-500">(View)</span>}
            </button>
          )}

          {/* Staff Management - Admin only */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'staff'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Staff
            </button>
          )}

          {/* Projects - Admin and agent only */}
          {(isAdmin || isAgent) && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'projects'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Projects
            </button>
          )}

          {/* Data Management - Admin only */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'data'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Data
            </button>
          )}

          {/* Reports - For all users */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'reports'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Reports
          </button>
        </div>

        {/* Content */}
        {activeTab === 'dashboard' && (isAdmin || isAgent) && <Dashboard user={currentUser} />}
        {activeTab === 'customers' && (isAdmin || isAgent || isStaff) && <CustomerManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'agents' && (isAdmin || isStaff) && <AgentManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'staff' && isAdmin && <StaffManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'checkinout' && isStaff && <StaffPortal user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'projects' && (isAdmin || isAgent) && <ProjectManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'data' && isAdmin && <DataManagement user={currentUser} />}
        {activeTab === 'reports' && <Reports user={currentUser} />}
      </div>
    </div>
  );
}

export default App;