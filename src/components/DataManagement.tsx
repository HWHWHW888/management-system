import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AdminManagement } from './AdminManagement';
import { User } from '../types';
import { db } from '../utils/supabase/supabaseClients';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  Archive,
  RotateCcw,
  Crown,
  Trash2,
  Package
} from 'lucide-react';

interface DataManagementProps {
  user: User;
}

interface BackupInfo {
  key: string;
  timestamp: string;
  size: number;
}

interface DataStats {
  mode: string;
  healthy: boolean;
  lastHealthCheck: string;
  backupCount: number;
}

export function DataManagement({ user }: DataManagementProps) {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [showFreshStartDialog, setShowFreshStartDialog] = useState(false);
  const [freshStartConfirmation, setFreshStartConfirmation] = useState('');
  const [dataOverview, setDataOverview] = useState<{[key: string]: number}>({});

  useEffect(() => {
    loadStats();
    loadBackups();
    loadDataOverview();
  }, []);

  const loadStats = () => {
    try {
      const dbStats = db.getStats();
      setStats(dbStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadBackups = () => {
    try {
      const availableBackups = db.getAvailableBackups();
      setBackups(availableBackups);
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  const loadDataOverview = async () => {
    try {
      const dataTypes = ['users', 'customers', 'agents', 'staff', 'trips', 'rollingRecords'];
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

  const handleExportData = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const data = await db.exportAllData();
      setExportData(data);
      
      // Also trigger download
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `casino-data-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage('✅ Data exported and downloaded successfully');
    } catch (error) {
      console.error('Export error:', error);
      setMessage('❌ Failed to export data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportData = async () => {
    if (!importData.trim()) {
      setMessage('❌ Please paste the backup data');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const success = await db.importAllData(importData);
      if (success) {
        setMessage('✅ Data imported successfully');
        setImportData('');
        setIsImportDialogOpen(false);
        loadBackups();
        loadDataOverview();
      } else {
        setMessage('❌ Failed to import data - invalid format');
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage('❌ Failed to import data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  const handleRestoreBackup = async (key: string, timestamp: string) => {
    setIsLoading(true);
    setMessage('');

    try {
      const success = await db.restoreFromBackup(key, timestamp);
      if (success) {
        setMessage(`✅ Restored ${key} from backup ${new Date(timestamp).toLocaleString()}`);
        loadDataOverview();
      } else {
        setMessage(`❌ Failed to restore ${key} from backup`);
      }
    } catch (error) {
      console.error('Restore error:', error);
      setMessage('❌ Failed to restore from backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const isHealthy = await db.isHealthy();
      if (isHealthy) {
        setMessage('✅ Database connection is healthy');
      } else {
        setMessage('⚠️ Database connection issues detected');
      }
      loadStats();
    } catch (error) {
      console.error('Health check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage(`❌ Health check failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFreshStart = async () => {
    if (freshStartConfirmation.toLowerCase() !== 'fresh start') {
      setMessage('❌ Please type "FRESH START" exactly to confirm');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('🧹 Admin requested fresh start - clearing all data...');
      await db.clearAllDataForFreshStart();
      setMessage('✅ Fresh start completed successfully - all data cleared and admin account recreated');
      setShowFreshStartDialog(false);
      setFreshStartConfirmation('');
      loadDataOverview();
      loadStats();
    } catch (error) {
      console.error('Fresh start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage(`❌ Fresh start failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Data Management</h2>
        <p className="text-gray-600">
          System administration, database monitoring, and security management
        </p>
      </div>

      {/* Data Protection Notice */}
      <Alert className="border-green-200 bg-green-50">
        <Shield className="w-4 h-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Data Protection Active:</strong> Your keyed-in data is automatically preserved across system refreshes and upgrades. 
          The system will never clear your data without explicit admin confirmation.
        </AlertDescription>
      </Alert>

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* Admin Navigation Tabs */}
      <Tabs defaultValue="database" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="database" className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Database Management</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center space-x-2">
            <Crown className="w-4 h-4" />
            <span>Admin Accounts</span>
          </TabsTrigger>
        </TabsList>

        {/* Database Management Tab */}
        <TabsContent value="database" className="space-y-6 mt-6">
          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Supabase Database Status</span>
              </CardTitle>
              <CardDescription>
                System operates exclusively with Supabase cloud database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Database Mode</p>
                      <Badge variant="default" className="bg-blue-600">
                        Supabase Cloud
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {stats.healthy ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Health Status</p>
                      <Badge variant={stats.healthy ? 'default' : 'destructive'}>
                        {stats.healthy ? 'Healthy' : 'Issues'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Last Check</p>
                      <p className="text-sm">{stats.lastHealthCheck}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Archive className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Backups</p>
                      <p className="text-sm">{stats.backupCount} available</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button
                  onClick={handleHealthCheck}
                  disabled={isLoading}
                  variant="default"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Check Connection
                </Button>
                
                <Button
                  onClick={loadStats}
                  disabled={isLoading}
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Backup & Recovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Data Backup & Recovery</span>
              </CardTitle>
              <CardDescription>
                Export your data for safekeeping or import from previous backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Export All Data</DialogTitle>
                      <DialogDescription>
                        This will create a complete backup of all your casino data
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {!exportData ? (
                        <Button onClick={handleExportData} disabled={isLoading} className="w-full">
                          {isLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Generate & Download Export
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Label>Export Data (automatically downloaded)</Label>
                          <Textarea
                            value={exportData}
                            readOnly
                            rows={10}
                            className="font-mono text-xs"
                            placeholder="Export data will appear here..."
                          />
                          <p className="text-xs text-gray-500">
                            The export file has been automatically downloaded. You can also copy the data above if needed.
                          </p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Import Data</DialogTitle>
                      <DialogDescription>
                        Import data from a previous backup. This will overwrite current data.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="fileImport">Upload Backup File</Label>
                        <input
                          id="fileImport"
                          type="file"
                          accept=".json"
                          onChange={handleFileImport}
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="importTextarea">Or Paste Backup Data</Label>
                        <Textarea
                          id="importTextarea"
                          value={importData}
                          onChange={(e) => setImportData(e.target.value)}
                          rows={10}
                          className="font-mono text-xs"
                          placeholder="Paste your backup JSON data here..."
                        />
                      </div>

                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          <strong>Warning:</strong> Importing data will overwrite all current data. 
                          Make sure to export your current data first if you want to keep it.
                        </AlertDescription>
                      </Alert>

                      <Button 
                        onClick={handleImportData} 
                        disabled={isLoading || !importData.trim()}
                        className="w-full"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Data
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Fresh Start Option */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-800">
                <Trash2 className="w-5 h-5" />
                <span>Fresh Start (Danger Zone)</span>
              </CardTitle>
              <CardDescription>
                Clear all data and start fresh (Admin only - requires confirmation)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-red-800">
                  <strong>Warning:</strong> This action will permanently delete all your data including customers, agents, trips, and records. 
                  Only the admin account will remain. This action cannot be undone.
                </AlertDescription>
              </Alert>

              <AlertDialog open={showFreshStartDialog} onOpenChange={setShowFreshStartDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Request Fresh Start
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>⚠️ Confirm Fresh Start</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL your data including:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>All customer records and rolling data</li>
                        <li>All agent information and assignments</li>
                        <li>All trips and project data</li>
                        <li>All staff accounts and check-in records</li>
                        <li>All financial records and reports</li>
                      </ul>
                      <br />
                      Only the admin account will be recreated with default credentials.
                      <br /><br />
                      Type <strong>"FRESH START"</strong> below to confirm:
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <input
                      type="text"
                      value={freshStartConfirmation}
                      onChange={(e) => setFreshStartConfirmation(e.target.value)}
                      placeholder="Type FRESH START to confirm"
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setFreshStartConfirmation('')}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFreshStart}
                      disabled={freshStartConfirmation.toLowerCase() !== 'fresh start' || isLoading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isLoading ? 'Clearing Data...' : 'Confirm Fresh Start'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Automatic Backups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Archive className="w-5 h-5" />
                <span>Automatic Backups</span>
              </CardTitle>
              <CardDescription>
                Recent automatic backups created by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Archive className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No automatic backups found</p>
                  <p className="text-sm">Backups are created automatically when data is saved</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.slice(0, 10).map((backup, index) => (
                    <div
                      key={`${backup.key}-${backup.timestamp}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <Archive className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{backup.key}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(backup.timestamp).toLocaleString()} • {formatBytes(backup.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreBackup(backup.key, backup.timestamp)}
                        disabled={isLoading}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                  ))}
                  
                  {backups.length > 10 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      Showing 10 most recent backups out of {backups.length} total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Messages */}
          {message && (
            <Alert className={message.includes('✅') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {/* Loading Progress */}
          {isLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
                <Progress value={undefined} className="mt-2" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Admin Accounts Tab */}
        <TabsContent value="admins" className="mt-6">
          <AdminManagement user={user} showError={() => {}} clearError={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}