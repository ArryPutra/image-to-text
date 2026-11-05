import React from 'react';
import { ShieldCheck, FileText, Globe } from 'lucide-react';
import type { SupportedLanguage } from '../types';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  disabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  disabled = false,
}) => {
  return (
    <header className="w-full border-b border-neutral-200 bg-white sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-semibold text-base sm:text-lg shadow-xs shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-950 text-sm sm:text-base tracking-tight">
                ImageToText
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200 hidden xs:inline">
                v1.0
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 hidden md:inline">
              Fast In-Browser OCR
            </span>
          </div>
        </div>

        {/* Right Controls: Privacy Indicator & Language Selection */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Privacy Indicator */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-medium shrink-0"
            title="All OCR runs locally in your browser via WebAssembly. Your images are never uploaded anywhere."
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">100% Local</span>
            <span className="sm:hidden">Local</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 sm:p-1 rounded-lg border border-neutral-200 shrink-0">
            <Globe className="w-3.5 h-3.5 text-neutral-500 ml-1 hidden sm:inline" aria-hidden="true" />
            <label htmlFor="language-select" className="sr-only">
              OCR Recognition Language
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              disabled={disabled}
              className="text-[11px] sm:text-xs bg-white text-neutral-800 font-medium py-1 px-1.5 sm:px-2 rounded border border-neutral-200 shadow-2xs hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 cursor-pointer disabled:opacity-50"
            >
              <option value="ind+eng">ID + EN</option>
              <option value="eng">English</option>
              <option value="ind">Indonesian</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
