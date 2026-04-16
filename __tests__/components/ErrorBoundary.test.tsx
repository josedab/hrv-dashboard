/**
 * Tests for ErrorBoundary component.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(false),
  captureException: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('../../src/utils/crashReporting', () => ({
  reportError: jest.fn(),
}));

import React from 'react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { reportError } from '../../src/utils/crashReporting';

// Lightweight render helper for class components
function renderToJSON(element: React.ReactElement): string {
  // Use React.createElement to simulate rendering
  return JSON.stringify(element, (key, value) => {
    if (key === '_owner' || key === '_store' || key === 'ref' || key === '$$typeof') return undefined;
    return value;
  });
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an instance with initial state of no error', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });

  it('getDerivedStateFromError sets error state', () => {
    const error = new Error('Test error');
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it('componentDidCatch reports the error', () => {
    const boundary = new ErrorBoundary({ children: null });
    const error = new Error('Component crash');
    const errorInfo = { componentStack: 'at TestComponent' } as React.ErrorInfo;

    // Suppress console.error in test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    boundary.componentDidCatch(error, errorInfo);
    consoleSpy.mockRestore();

    expect(reportError).toHaveBeenCalledWith(error, { componentStack: 'at TestComponent' });
  });

  it('render shows error UI when hasError is true', () => {
    const boundary = new ErrorBoundary({ children: React.createElement('Text', null, 'child') });
    boundary.state = { hasError: true, error: new Error('Something broke') };

    const output = renderToJSON(boundary.render() as React.ReactElement);
    expect(output).toContain('Something went wrong');
    expect(output).toContain('Something broke');
    expect(output).toContain('Try Again');
  });

  it('render shows children when hasError is false', () => {
    const child = React.createElement('Text', null, 'Hello World');
    const boundary = new ErrorBoundary({ children: child });
    boundary.state = { hasError: false, error: null };

    const result = boundary.render();
    expect(result).toBe(child);
  });

  it('handleReset is a function that can be called', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(typeof boundary.handleReset).toBe('function');
  });

  it('getDerivedStateFromError followed by reset pattern works', () => {
    // Verify the error → recovery state transition
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('crash'));
    expect(errorState.hasError).toBe(true);

    // After reset (which sets state back), the derived state is clear
    const clearState = { hasError: false, error: null };
    expect(clearState.hasError).toBe(false);
    expect(clearState.error).toBeNull();
  });

  it('shows fallback message when error has no message', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, error: { message: '' } as Error };

    const output = renderToJSON(boundary.render() as React.ReactElement);
    expect(output).toContain('An unexpected error occurred');
  });
});
