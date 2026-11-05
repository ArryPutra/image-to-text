import React, { useRef } from 'react';
import type { ProcessedImage } from '../types';
import { X, RefreshCw, Wand2, Info } from 'lucide-react';

interface ImagePreviewProps {
  image: ProcessedImage;
  onReplaceImage: (file: File) => void;
  onRemoveImage: () => void;
  enhanceContrast: boolean;
  onToggleContrast: (enabled: boolean) => void;
  disabled?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  image,
  onReplaceImage,
  onRemoveImage,
  enhanceContrast,
  onToggleContrast,
  disabled = false,
}) => {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onReplaceImage(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 flex flex-col shadow-xs h-full">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100 gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-neutral-900 truncate"
            title={image.name}
          >
            {image.name}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-0.5">
            <span>{image.dimensions.width} × {image.dimensions.height} px</span>
            <span>•</span>
            <span>{image.formattedSize}</span>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            disabled={disabled}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-40"
            title="Replace with another image"
            aria-label="Replace with another image"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRemoveImage}
            disabled={disabled}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-red-700 hover:bg-red-50 border border-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40"
            title="Remove image"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Preview Box */}
      <div className="my-3.5 relative flex-1 min-h-[200px] sm:min-h-[280px] max-h-[440px] bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden flex items-center justify-center p-2">
        <img
          src={image.previewUrl}
          alt={image.name}
          className="max-w-full max-h-full object-contain rounded select-none"
        />
      </div>

      {/* Preprocessing Toolbar */}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
        <div className="flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
          <span className="font-medium text-neutral-700">Contrast Boost</span>
          <span
            className="cursor-help text-neutral-400 hover:text-neutral-600"
            title="Optimizes low-contrast or faded screenshots before OCR."
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enhanceContrast}
            onChange={(e) => onToggleContrast(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-neutral-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neutral-900 disabled:opacity-50"></div>
        </label>
      </div>
    </div>
  );
};
