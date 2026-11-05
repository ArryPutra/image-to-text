import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, ClipboardPaste } from 'lucide-react';

interface UploadAreaProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFileSelected,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
      e.target.value = '';
    }
  };

  const openFileDialog = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
      className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-150 p-5 sm:p-10 text-center cursor-pointer select-none box-border ${
        isDragOver
          ? 'border-neutral-900 bg-neutral-100/70 scale-[0.995]'
          : 'border-neutral-300 hover:border-neutral-400 bg-white hover:bg-neutral-50/60 shadow-xs'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Upload an image or paste screenshot using Ctrl+V"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFileDialog();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3.5">
        {/* Upload Icon Container */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-800 flex items-center justify-center shadow-2xs group-hover:bg-neutral-200/60 transition-colors">
          <Upload className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" aria-hidden="true" />
        </div>

        {/* Primary Call to Action */}
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-semibold text-neutral-900 leading-snug">
            <span className="text-neutral-950 underline underline-offset-2 decoration-neutral-300">
              Click to select an image
            </span>{' '}
            or drag &amp; drop
          </p>
          <p className="text-xs sm:text-sm text-neutral-500">
            Or paste using <kbd className="font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-800 font-semibold shadow-2xs">Ctrl + V</kbd>
          </p>
        </div>

        {/* Paste Badge & Snipping tool note */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-neutral-100/80 border border-neutral-200 text-neutral-600 text-[11px] sm:text-xs max-w-full">
          <ClipboardPaste className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
          <span>Windows Snipping Tool (<kbd className="font-mono font-medium">Win+Shift+S</kbd>)</span>
        </div>

        {/* Formats & File Limit */}
        <div className="pt-1 flex items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            PNG, JPG, WEBP
          </span>
          <span>•</span>
          <span>Up to 15 MB</span>
        </div>
      </div>
    </div>
  );
};
