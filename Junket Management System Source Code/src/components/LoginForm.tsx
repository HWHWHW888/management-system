import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { User } from '../types';
import { db } from '../utils/supabase/supabaseClients';
import { databaseWrapper } from '../utils/api/databaseWrapper';
import { Database, Shield, Info, AlertTriangle, CheckCircle, Key, Users, RefreshCw, Bug } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTestCredentials, setShowTestCredentials] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [connectionTest, setConnectionTest] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('🔐 Starting login process...');
      console.log('👤 Username:', username);
      console.log('🔑 Password length:', password.length);
      
      // First check if Supabase is healthy
      console.log('🔍 Checking database health...');
      const isHealthy = await db.isHealthy();
      if (!isHealthy) {
        throw new Error('Database connection failed. Please check your internet connection and try again.');
      }

      console.log('✅ Database health check passed, attempting login...');
      
      const user = await databaseWrapper.login(username, password);
      console.log('✅ Login successful for user:', user);
      onLogin(user);
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      // If login fails and it's admin credentials, try to initialize admin account
      if (username === 'admin' && password === 'admin123' && error.message?.includes('Invalid')) {
        console.log('🔧 Login failed for admin, attempting to initialize admin account...');
        try {
          await db.initializeSampleDataIfNeeded();
          console.log('✅ Admin account initialized, retrying login...');
          
          // Retry login after initialization
          const retryUser = await databaseWrapper.login(username, password);
          console.log('✅ Retry login successful for user:', retryUser);
          onLogin(retryUser);
          return; // Exit early if retry succeeds
        } catch (initError: any) {
          console.error('❌ Failed to initialize admin account:', initError);
          setError(`Login failed. Admin initialization error: ${initError.message}`);
          return;
        }
      }
      
      setError(error.message || 'Login failed');
      
      // If login fails, run a connection test for debugging
      if (debugMode) {
        try {
          const testResult = await db.testConnection();
          setConnectionTest(testResult);
        } catch (testError) {
          console.error('Connection test failed:', testError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fillTestCredentials = (role: string) => {
    switch (role) {
      case 'admin':
        setUsername('admin');
        setPassword('admin123');
        break;
      case 'agent':
        setUsername('agent1');
        setPassword('agent123');
        break;
      case 'staff':
        setUsername('staff1');
        setPassword('staff123');
        break;
    }
    setError('');
  };

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    try {
      const testResult = await db.testConnection();
      setConnectionTest(testResult);
      
      if (testResult.success) {
        setError('');
        console.log('✅ Database connection test successful');
      } else {
        setError(`Connection test failed: ${testResult.message}`);
        console.error('❌ Database connection test failed:', testResult);
      }
    } catch (error: any) {
      setError(`Connection test error: ${error.message}`);
      console.error('❌ Connection test error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeAdminAccount = async () => {
    setIsLoading(true);
    try {
      console.log('🔧 Manually initializing admin account...');
      await db.initializeSampleDataIfNeeded();
      setError('');
      alert('Admin account initialized successfully! Try logging in with admin/admin123');
    } catch (error: any) {
      setError(`Initialization failed: ${error.message}`);
      console.error('❌ Admin initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Casino Management System</CardTitle>
            <CardDescription>
              Sign in to access the management dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Login Failed:</strong> {error}
                    {error.includes('Invalid credentials') && (
                      <div className="mt-2 text-xs">
                        Make sure you're using the correct credentials:
                        <br />• Admin: <code className="bg-red-100 px-1 rounded">admin / admin123</code>
                        <br />• Agent: <code className="bg-red-100 px-1 rounded">agent1 / agent123</code>
                        <br />• Staff: <code className="bg-red-100 px-1 rounded">staff1 / staff123</code>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              {/* Test Credentials */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <Key className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Test Credentials</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Click to auto-fill login credentials for testing.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestCredentials(!showTestCredentials)}
                    className="text-xs"
                  >
                    {showTestCredentials ? 'Hide' : 'Show'}
                  </Button>
                </div>
                
                {showTestCredentials && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fillTestCredentials('admin')}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        Admin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fillTestCredentials('agent')}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        Agent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fillTestCredentials('staff')}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        Staff
                      </Button>
                    </div>
                    <div className="text-xs text-yellow-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Admin:</span>
                        <code className="bg-yellow-100 px-1 rounded">admin / admin123</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Agent:</span>
                        <code className="bg-yellow-100 px-1 rounded">agent1 / agent123</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Staff:</span>
                        <code className="bg-yellow-100 px-1 rounded">staff1 / staff123</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Troubleshooting Tools */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Bug className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Troubleshooting</p>
                    <p className="text-xs text-blue-700 mt-1">
                      If login fails, try these troubleshooting steps.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={testDatabaseConnection}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        <Database className="w-3 h-3 mr-1" />
                        Test Connection
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={initializeAdminAccount}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reset Admin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDebugMode(!debugMode)}
                        className="text-xs"
                      >
                        <Bug className="w-3 h-3 mr-1" />
                        {debugMode ? 'Hide' : 'Show'} Debug
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Debug Information */}
              {debugMode && connectionTest && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Debug Information</p>
                      <div className="mt-2 text-xs text-gray-600">
                        <div>Status: {connectionTest.success ? '✅ Success' : '❌ Failed'}</div>
                        <div>Message: {connectionTest.message}</div>
                        {connectionTest.details && <div>Details: {connectionTest.details}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fresh Start Information */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Fresh Start System</p>
                    <p className="text-xs text-green-700 mt-1">
                      The system starts with clean data. Only admin credentials are preset: 
                      <code className="bg-green-100 px-1 rounded ml-1">admin / admin123</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Database Status */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Database className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">Secure Cloud Storage</p>
                    <p className="text-xs text-purple-700 mt-1">
                      All data is securely stored in Supabase cloud database with automatic backups and enterprise-grade security.
                    </p>
                  </div>
                </div>
              </div>

              {/* User Roles Information */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Users className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">User Roles</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700">Admin</Badge>
                        <span className="text-xs text-gray-700">Full system access</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Agent</Badge>
                        <span className="text-xs text-gray-700">Customer & project management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Staff</Badge>
                        <span className="text-xs text-gray-700">Rolling records & reports</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Shield className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Security Notice</p>
                    <p className="text-xs text-red-600 mt-1">
                      This system contains sensitive business information. Unauthorized access is prohibited.
                      Admin credentials can be changed in Data Management after login.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}