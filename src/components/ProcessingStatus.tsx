import React from 'react';
import { Loader2, XCircle } from 'lucide-react';
import type { OCRStage } from '../types';

interface ProcessingStatusProps {
  stage: OCRStage;
  progress: number;
  message: string;
  onCancel: () => void;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  progress,
  message,
  onCancel,
}) => {
  return (
    <div
      className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs flex flex-col justify-center space-y-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-5 h-5 text-neutral-800 animate-spin" aria-hidden="true" />
          <span className="text-sm font-semibold text-neutral-900">
            {message || 'Processing image...'}
          </span>
        </div>
        <span className="text-xs font-mono font-medium text-neutral-500">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress Track and Bar */}
      <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/80">
        <div
          className="h-full bg-neutral-900 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
        />
      </div>

      {/* Footer info & Cancel */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-neutral-500">
          Running WebAssembly worker locally
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          Cancel
        </button>
      </div>
    </div>
  );
};
