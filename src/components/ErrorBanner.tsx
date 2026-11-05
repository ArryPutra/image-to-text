import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs"
      role="alert"
    >
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 stroke-[2]" aria-hidden="true" />
      </div>

      <div className="flex-1 space-y-1">
        <h3 className="text-xs font-semibold text-red-900 uppercase tracking-wider">
          Processing Error
        </h3>
        <p className="text-sm text-red-800 leading-snug">
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-800 bg-white hover:bg-red-100 border border-red-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
};
