import React from 'react';
import { ErrorHandler } from './ErrorHandler';

export interface WithErrorHandlerProps {
  showError: (message: string) => void;
  clearError: () => void;
}

export function withErrorHandler<P extends object>(
  Component: React.ComponentType<P & WithErrorHandlerProps>
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorHandler>
        {(showError, clearError) => (
          <Component {...props} showError={showError} clearError={clearError} />
        )}
      </ErrorHandler>
    );
  };

  WrappedComponent.displayName = `withErrorHandler(${Component.displayName || Component.name})`;
  return WrappedComponent;
}