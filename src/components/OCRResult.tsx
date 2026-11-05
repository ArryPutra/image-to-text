import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, Trash2 } from 'lucide-react';

interface OCRResultProps {
  text: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  originalFileName?: string;
  isProcessing?: boolean;
}

export const OCRResult: React.FC<OCRResultProps> = ({
  text,
  onChangeText,
  onClear,
  originalFileName,
  isProcessing = false,
}) => {
  const [copied, setCopied] = useState(false);

  // Compute character and word counts
  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    return { chars, words, lines };
  }, [text]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!text.trim()) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Download TXT file
  const handleDownload = () => {
    if (!text.trim()) return;

    const baseName = originalFileName
      ? originalFileName.replace(/\.[^/.]+$/, '')
      : 'extracted-text';
    const filename = `${baseName}-ocr.txt`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 flex flex-col shadow-xs h-full">
      {/* Header and stats */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-neutral-100 gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Extracted Text
          </h2>
          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
            <span>{stats.words} words</span>
            <span>•</span>
            <span>{stats.chars} chars</span>
            <span>•</span>
            <span>{stats.lines} lines</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasText || isProcessing}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed ${
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900 shadow-2xs'
            }`}
            title="Copy extracted text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" aria-hidden="true" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          {/* Download TXT Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasText || isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download text as UTF-8 TXT file"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xs:inline">Download</span> .TXT
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClear}
            disabled={isProcessing}
            className="p-1.5 text-neutral-500 hover:text-red-700 hover:bg-red-50 border border-neutral-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40"
            title="Clear all"
            aria-label="Clear all extracted text and reset"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editable Text Area */}
      <div className="my-3 flex-1 flex flex-col">
        <label htmlFor="extracted-text-area" className="sr-only">
          Extracted OCR Text
        </label>
        <textarea
          id="extracted-text-area"
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Extracted text will appear here. You can freely edit or add notes."
          className="w-full flex-1 min-h-[220px] sm:min-h-[300px] p-3.5 font-mono text-sm leading-relaxed text-neutral-900 bg-neutral-50/50 rounded-xl border border-neutral-200 focus-visible:border-neutral-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-neutral-400 focus-visible:outline-none resize-y transition-colors selection:bg-neutral-200"
          spellCheck={false}
        />
      </div>

      {/* Helper Footer */}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
        <span>Line breaks &amp; paragraphs preserved</span>
        <span className="italic">Directly editable</span>
      </div>
    </div>
  );
};
