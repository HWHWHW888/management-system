import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { User } from '../types';
import { db } from '../utils/supabase/supabaseClients';
import { db as databaseWrapper } from '../utils/api/databaseWrapper';
import { AlertTriangle } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      console.log('🔍 User object structure:', JSON.stringify(user, null, 2));
      console.log('🔍 User role:', user?.role);
      console.log('🔍 User token:', user?.token ? 'Present' : 'Missing');
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
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="bg-white/95 backdrop-blur-sm border-2 border-amber-300 shadow-2xl shadow-amber-500/20">
          <CardHeader className="text-center pb-8 pt-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">HW</span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
              Hoe Win Junket Management System
            </CardTitle>
            <CardDescription className="text-slate-600 mt-3 font-medium">
              Professional Gaming Management Platform
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 font-semibold">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={isLoading}
                  className="h-12 border-2 border-slate-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white/80 backdrop-blur-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={isLoading}
                  className="h-12 border-2 border-slate-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white/80 backdrop-blur-sm"
                />
              </div>

              {error && (
                <Alert className="border-2 border-red-300 bg-red-50/80 backdrop-blur-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <AlertDescription className="text-red-800 font-medium">
                    <strong>Authentication Failed:</strong> {error}
                    {error.includes('Invalid credentials') && (
                      <div className="mt-3 p-3 bg-red-100/50 rounded-md text-sm">
                        <div className="font-semibold mb-2">Valid Credentials:</div>
                        <div className="space-y-1">
                          <div>• Admin: <code className="bg-red-200 px-2 py-1 rounded font-mono">admin / admin123</code></div>
                          <div>• Agent: <code className="bg-red-200 px-2 py-1 rounded font-mono">agent1 / agent123</code></div>
                          <div>• Staff: <code className="bg-red-200 px-2 py-1 rounded font-mono">staff1 / staff123</code></div>
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/25 border-0 transition-all duration-200" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  'Access Dashboard'
                )}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}