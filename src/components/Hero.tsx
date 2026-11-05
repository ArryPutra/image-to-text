import React from 'react';
import { Lock, Zap, FileSpreadsheet } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="text-center pt-5 sm:pt-8 pb-5 sm:pb-6 px-2 sm:px-4 max-w-full">
      <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 mb-2">
        Image to Text Converter
      </h1>
      <p className="text-sm sm:text-lg text-neutral-600 max-w-2xl mx-auto mb-3 sm:mb-4 px-2">
        Extract readable text from screenshots and images instantly in your browser.
      </p>

      {/* Feature highlights bar */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-neutral-500 font-medium">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-neutral-700 shrink-0" aria-hidden="true" />
          Immediate WebAssembly OCR
        </span>
        <span className="hidden sm:inline text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-neutral-700 shrink-0" aria-hidden="true" />
          Zero server uploads (Strict privacy)
        </span>
        <span className="hidden sm:inline text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-700 shrink-0" aria-hidden="true" />
          Indonesian &amp; English
        </span>
      </div>
    </section>
  );
};
