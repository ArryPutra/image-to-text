import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-neutral-200 bg-white mt-auto py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
        {/* Privacy Note */}
        <div className="flex items-center gap-2 text-center sm:text-left">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Zero server uploads:</strong> Images and extracted text remain on your device.
          </span>
        </div>

        {/* Engine Note & Copyright */}
        <div className="flex items-center gap-4 text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
            Client-side WebAssembly
          </span>
          <span>•</span>
          <span>© {new Date().getFullYear()} ImageToText</span>
        </div>
      </div>
    </footer>
  );
};
