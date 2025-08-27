import React, { useState, useCallback } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { AlertTriangle, X, Database, RefreshCw } from 'lucide-react';
import { db } from '../utils/supabase/client';

interface ErrorHandlerProps {
  children: (showError: (message: string) => void, clearError: () => void) => React.ReactNode;
}

export function ErrorHandler({ children }: ErrorHandlerProps) {
  const [error, setError] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  const showError = useCallback((message: string) => {
    setError(message);
    console.error('🔴 Application Error:', message);
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const retryConnection = async () => {
    setIsRetrying(true);
    try {
      const isHealthy = await db.isHealthy();
      if (isHealthy) {
        clearError();
      } else {
        setError('Database connection is still unavailable. Please try again later.');
      }
    } catch (error) {
      setError(`Connection retry failed: ${error.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:max-w-md z-50">
          <Alert className="border-red-200 bg-red-50 shadow-lg">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <AlertDescription className="text-red-800 pr-8">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium mb-1">Database Error</p>
                  <p className="text-sm">{error}</p>
                  <div className="mt-3 flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={retryConnection}
                      disabled={isRetrying}
                      className="h-7 px-2 text-xs border-red-300 text-red-700 hover:bg-red-100"
                    >
                      {isRetrying ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <Database className="w-3 h-3 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearError}
                      className="h-7 px-2 text-xs text-red-700 hover:bg-red-100"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearError}
                  className="h-6 w-6 p-0 text-red-500 hover:bg-red-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {children(showError, clearError)}
    </>
  );
}