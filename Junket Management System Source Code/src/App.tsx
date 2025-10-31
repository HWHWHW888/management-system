import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { CustomerManagement } from './components/CustomerManagement';
import { AgentManagement } from './components/AgentManagement';
import { StaffManagement } from './components/StaffManagement';
import { StaffSelfService } from './components/StaffSelfService';
import ProjectManagement from './components/ProjectManagement';
import { DataManagement } from './components/DataManagement';
import { Reports } from './components/Reports';
import { Button } from './components/ui/button';
import { LogOut, Users, UserCheck, BarChart3, MapPin, ShieldCheck, Clock, Database, Settings, AlertTriangle, CheckCircle, Wifi, RefreshCw, Bug, Shield } from 'lucide-react';
import { User } from './types';
import { db } from './utils/api/databaseWrapper';
import { Badge } from './components/ui/badge';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { LanguageToggle } from './components/LanguageToggle';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { CurrencyToggle } from './components/CurrencyToggle';

function AppContent() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDatabaseHealthy, setIsDatabaseHealthy] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    // Check if this is production domain but don't clear session immediately
    const hostname = window.location.hostname;
    const isProductionDomain = hostname === 'www.hoewingroup.com' || hostname === 'hoewingroup.com';
    
    if (isProductionDomain) {
      console.log('🔒 Production domain detected - enhanced security mode');
    }
    
    // Parallel initialization
    Promise.all([
      initializeApplication(),
      // Preload API health check in parallel
      fetch(`${process.env.REACT_APP_API_URL?.replace('/api', '')}/health`)
        .then(res => res.json())
        .then(data => {
          console.log('✅ Backend health check:', data);
        })
        .catch(error => {
          console.error('❌ Backend health check failed:', error);
        })
    ]).catch(error => {
      console.error('❌ Parallel initialization error:', error);
    });
  }, []);

  const initializeApplication = async () => {
    setIsInitializing(true);
    setErrorMessage('');

    try {
      console.log('🚀 Initializing Casino Management System...');
      
      // Single connection test (combines health check)
      const connectionTest = await db.testConnection();
      setConnectionDetails(connectionTest);
      setIsDatabaseHealthy(connectionTest.success);
      
      if (!connectionTest.success) {
        throw new Error(`Database connection failed: ${connectionTest.message}. ${connectionTest.details || ''}`);
      }

      // Skip data initialization for faster startup
      // Only initialize if explicitly needed (first time setup)
      const skipDataInit = localStorage.getItem('app_initialized');
      if (!skipDataInit) {
        console.log('🛡️ First-time setup - initializing data...');
        await db.initializeSampleDataIfNeeded();
        localStorage.setItem('app_initialized', 'true');
      } else {
        console.log('⚡ Skipping data initialization - already configured');
      }

      // Smart session management for production domains
      const hostname = window.location.hostname;
      const isProductionDomain = hostname === 'www.hoewingroup.com' || hostname === 'hoewingroup.com';
      
      const savedUser = localStorage.getItem('casinoUser');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          
          if (isProductionDomain) {
            // For production domain, validate token freshness
            const loginTime = user.loginTime || 0;
            const currentTime = Date.now();
            const sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
            
            if (currentTime - loginTime > sessionTimeout) {
              // Session expired, clear only this user's session
              console.log('🔒 Session expired for production domain - requiring fresh login');
              localStorage.removeItem('casinoUser');
            } else {
              // Valid session, restore user
              setCurrentUser(user);
              console.log('👤 Restored valid session for production:', user.username);
              
              if (user.token) {
                const { apiClient } = await import('./utils/api/apiClient');
                apiClient.setToken(user.token);
                console.log('🔑 Token restored to API client');
              }
              
              if (user.role === 'staff') {
                setActiveTab('checkinout');
              } else {
                setActiveTab('dashboard');
              }
            }
          } else {
            // Development environment - restore session normally
            setCurrentUser(user);
            console.log('👤 Restored user session:', user.username);
            
            if (user.token) {
              const { apiClient } = await import('./utils/api/apiClient');
              apiClient.setToken(user.token);
              console.log('🔑 Token restored to API client');
            }
            
            if (user.role === 'staff') {
              setActiveTab('checkinout');
            } else {
              setActiveTab('dashboard');
            }
          }
        } catch (error) {
          console.error('Error parsing saved user session:', error);
          localStorage.removeItem('casinoUser');
        }
      } else if (isProductionDomain) {
        console.log('🔒 Production domain - no saved session, showing login');
      }

      console.log('✅ Application initialization completed');

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

      console.log('🔍 App.handleLogin received user:', user);
      console.log('🔍 App.handleLogin user role:', user?.role);
      console.log('🔍 App.handleLogin user token:', user?.token ? 'Present' : 'Missing');
      
      // Add login timestamp for session management
      const userWithTimestamp = {
        ...user,
        loginTime: Date.now()
      };
      
      // Use the user object directly from databaseWrapper.login (already has token and role)
      setCurrentUser(userWithTimestamp);
      
      // Update localStorage with timestamp
      localStorage.setItem('casinoUser', JSON.stringify(userWithTimestamp));
      console.log('🔍 App.handleLogin updated localStorage with timestamp');
      
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

  const isAdmin = currentUser?.role === 'admin';
  const isAgent = currentUser?.role === 'agent';
  const isStaff = currentUser?.role === 'staff';
  const isBoss = currentUser?.role === 'boss';

  // Helper function to get display role
  const getDisplayRole = () => {
    return currentUser?.role?.toUpperCase() ;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Left side - Title and badges */}
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <h1 className="text-sm sm:text-xl font-semibold text-gray-900 truncate">
                <span className="hidden sm:inline">Casino Management System</span>
                <span className="sm:hidden">Casino Management</span>
              </h1>
              <div className="hidden sm:flex items-center space-x-2">
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
              {/* Mobile badges - only show essential ones */}
              <div className="sm:hidden flex items-center space-x-1">
                <Badge variant="secondary" className="text-xs">
                  {getDisplayRole()}
                </Badge>
                <Badge 
                  variant="outline"
                  className={`text-xs flex items-center gap-1 ${
                    isDatabaseHealthy ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
                  }`}
                >
                  {isDatabaseHealthy ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                </Badge>
              </div>
            </div>
            
            {/* Right side - Controls */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <LanguageToggle />
              <CurrencyToggle />
              {!isDatabaseHealthy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshDatabaseHealth}
                  className="text-xs hidden sm:flex"
                >
                  <Wifi className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
              )}
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">Welcome, {currentUser.username}</span>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 sm:space-x-1 mb-6 sm:mb-8 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {/* Dashboard - For admin, agent, and boss */}
          {(isAdmin || isAgent || isBoss) && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('dashboard')}</span>
              <span className="sm:hidden">Dashboard</span>
            </button>
          )}

          {/* Check-in/Out - First tab for staff */}
          {isStaff && (
            <button
              onClick={() => setActiveTab('checkinout')}
              className={`flex items-center px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'checkinout'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('checkinout')}</span>
              <span className="sm:hidden">Check</span>
            </button>
          )}

          {/* Customers - For admin, agent, staff, and boss */}
          {(isAdmin || isAgent || isStaff || isBoss) && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'customers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('customers')} {(isStaff || isBoss) && <span className="ml-1 text-xs text-gray-500">(View)</span>}</span>
              <span className="sm:hidden">Customers</span>
            </button>
          )}

          {/* Agents - For admin, staff, and boss */}
          {(isAdmin || isStaff || isBoss) && (
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'agents'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('agents')} {(isStaff || isBoss) && <span className="ml-1 text-xs text-gray-500">(View)</span>}</span>
              <span className="sm:hidden">Agents</span>
            </button>
          )}

          {/* Staff Management - Admin and boss */}
          {(isAdmin || isBoss) && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'staff'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {t('staff')}
            </button>
          )}

          {/* Projects - Admin, agent, and boss */}
          {(isAdmin || isAgent || isBoss) && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'projects'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {t('projects')}
            </button>
          )}

          {/* Reports - Admin and boss */}
          {(isAdmin || isBoss) && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {t('reports')}
            </button>
          )}

          {/* Settings - Admin only */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {t('settings')}
            </button>
          )}

        </div>

        {/* Content */}
        {activeTab === 'dashboard' && <Dashboard user={currentUser} />}
        {activeTab === 'customers' && (isAdmin || isAgent || isStaff || isBoss) && <CustomerManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'agents' && (isAdmin || isStaff || isBoss) && <AgentManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'staff' && (isAdmin || isBoss) && <StaffManagement user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'checkinout' && isStaff && <StaffSelfService user={currentUser} showError={() => {}} clearError={() => {}} />}
        {activeTab === 'projects' && (isAdmin || isAgent || isBoss) && <ProjectManagement user={currentUser} />}
        {activeTab === 'reports' && (isAdmin || isBoss) && <Reports user={currentUser} />}
        {activeTab === 'settings' && isAdmin && <DataManagement user={currentUser} />}
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <AppContent />
      </CurrencyProvider>
    </LanguageProvider>
  );
}

export default App;