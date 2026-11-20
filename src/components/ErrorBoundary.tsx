import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        displayMessage = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ''}`;
      }
    } catch {
      // Non-JSON error message; keep raw string
    }
    return { hasError: true, message: displayMessage };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#181414] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E7E0D8] rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-3 text-[#B91C3B]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-2xl font-semibold">Something went off script</h1>
            </div>
            <p className="text-sm text-[#574E4B] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#181414] text-white text-sm font-medium hover:bg-[#2F2726] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
