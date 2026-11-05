import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface EmptyResultProps {
  onRetry: () => void;
  onEnableContrast: () => void;
  contrastEnabled: boolean;
}

export const EmptyResult: React.FC<EmptyResultProps> = ({
  onRetry,
  onEnableContrast,
  contrastEnabled,
}) => {
  return (
    <div
      className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 text-center space-y-4 shadow-xs"
      role="alert"
    >
      <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
        <AlertCircle className="w-6 h-6 stroke-[1.75]" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-amber-950">
          No readable text found
        </h3>
        <p className="text-xs text-amber-800/90 max-w-md mx-auto">
          No readable text was found in this image. Try an image with clearer lettering or higher contrast.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {!contrastEnabled && (
          <button
            type="button"
            onClick={onEnableContrast}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            Try with Contrast Boost
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Re-scan Image
        </button>
      </div>
    </div>
  );
};
