import React, { useEffect, useState } from 'react';
import { useOCR } from './hooks/useOCR';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { UploadArea } from './components/UploadArea';
import { ImagePreview } from './components/ImagePreview';
import { ProcessingStatus } from './components/ProcessingStatus';
import { OCRResult } from './components/OCRResult';
import { EmptyResult } from './components/EmptyResult';
import { ErrorBanner } from './components/ErrorBanner';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  const {
    selectedImage,
    stage,
    progress,
    statusMessage,
    extractedText,
    setExtractedText,
    error,
    language,
    enhanceContrast,
    processNewImage,
    reprocess,
    changeLanguage,
    toggleContrast,
    cancel,
    reset,
    isProcessing,
  } = useOCR();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Setup global clipboard paste listener (handles Ctrl+V screenshots, snipping tool, etc.)
  useClipboardPaste({
    onImagePasted: (file) => {
      setToastMessage('Screenshot detected from clipboard! Processing...');
      setTimeout(() => setToastMessage(null), 3000);
      processNewImage(file);
    },
    onTextPasteIgnored: () => {
      // User pasted text while not inside an input
      setToastMessage('Clipboard contains text. Paste an image or screenshot to extract text.');
      setTimeout(() => setToastMessage(null), 3500);
    },
  });

  // Prevent browser default behavior of opening dropped files when dropped outside dropzone
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);

    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] text-neutral-900 font-sans antialiased overflow-x-hidden w-full">
      {/* Top Navigation */}
      <Header
        language={language}
        onLanguageChange={changeLanguage}
        disabled={isProcessing}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-start">
        <Hero />

        {/* Global Error Banner if not in two-column mode */}
        {error && !selectedImage && (
          <div className="mb-6 max-w-2xl mx-auto w-full">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* When NO image is selected: show large upload / drop / paste area */}
        {!selectedImage ? (
          <div className="max-w-3xl mx-auto w-full mt-2 sm:mt-4">
            <UploadArea onFileSelected={processNewImage} disabled={isProcessing} />
          </div>
        ) : (
          /* When image IS selected: show modern 2-column workspace */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mt-4">
            {/* Left Column: Image Preview & Preprocessing */}
            <div className="flex flex-col">
              <ImagePreview
                image={selectedImage}
                onReplaceImage={processNewImage}
                onRemoveImage={reset}
                enhanceContrast={enhanceContrast}
                onToggleContrast={toggleContrast}
                disabled={isProcessing}
              />
            </div>

            {/* Right Column: OCR Processing / Results / Empty / Error */}
            <div className="flex flex-col space-y-4">
              {/* Error within workflow */}
              {error && (
                <ErrorBanner
                  message={error}
                  onRetry={() => reprocess()}
                />
              )}

              {/* Processing Progress */}
              {isProcessing && (
                <ProcessingStatus
                  stage={stage}
                  progress={progress}
                  message={statusMessage}
                  onCancel={cancel}
                />
              )}

              {/* Empty Result Notification */}
              {stage === 'empty' && !isProcessing && (
                <EmptyResult
                  onRetry={() => reprocess()}
                  onEnableContrast={() => toggleContrast(true)}
                  contrastEnabled={enhanceContrast}
                />
              )}

              {/* OCR Result View (Editable Textarea & Actions) */}
              {(stage === 'completed' || (!isProcessing && extractedText)) && (
                <OCRResult
                  text={extractedText}
                  onChangeText={setExtractedText}
                  onClear={reset}
                  originalFileName={selectedImage.name}
                  isProcessing={isProcessing}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
