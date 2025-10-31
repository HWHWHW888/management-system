import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AdminManagement } from './AdminManagement';
import { User } from '../types';
import { db } from '../utils/supabase/supabaseClients';
import { 
  Database, 
  RefreshCw, 
  Crown,
  Package
} from 'lucide-react';

interface DataManagementProps {
  user: User;
}

export function DataManagement({ user }: DataManagementProps) {
  const [dataOverview, setDataOverview] = useState<{[key: string]: number}>({});

  useEffect(() => {
    loadDataOverview();
  }, []);

  const loadDataOverview = async () => {
    try {
      const dataTypes = ['users', 'customers', 'agents', 'staff', 'trips'];
      const overview: {[key: string]: number} = {};
      
      for (const dataType of dataTypes) {
        try {
          const data = await db.get(dataType, []);
          overview[dataType] = data.length;
        } catch (error) {
          console.warn(`Could not load ${dataType}:`, error);
          overview[dataType] = 0;
        }
      }
      
      setDataOverview(overview);
    } catch (error) {
      console.error('Error loading data overview:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Data Management</h2>
        <p className="text-gray-600">
          System administration and database overview
        </p>
      </div>

      {/* Data Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Current Data Overview</span>
          </CardTitle>
          <CardDescription>
            Overview of your stored data in Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(dataOverview).map(([dataType, count]) => (
              <div key={dataType} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{count}</div>
                <div className="text-xs text-gray-600 capitalize">{dataType}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Total records: {Object.values(dataOverview).reduce((sum, count) => sum + count, 0)}
            </p>
            <Button onClick={loadDataOverview} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Database Status</span>
          </CardTitle>
          <CardDescription>
            System operates with Supabase cloud database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Database Mode</p>
                <p className="font-medium text-blue-600">Supabase Cloud</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="w-5 h-5" />
            <span>Admin Accounts</span>
          </CardTitle>
          <CardDescription>
            Manage administrator accounts and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminManagement user={user} showError={() => {}} clearError={() => {}} />
        </CardContent>
      </Card>
    </div>
  );
}
