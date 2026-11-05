import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ProcessedImage,
  OCRStage,
  OCRProgressInfo,
  SupportedLanguage,
} from '../types';
import { inspectImage } from '../services/imagePreprocessor';
import { ocrService } from '../services/ocrService';

export function useOCR() {
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null);
  const [stage, setStage] = useState<OCRStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('ind+eng');
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(false);

  // Reference to track active in-flight job ID to ignore stale completions
  const activeJobIdRef = useRef<number>(0);
  const selectedImageRef = useRef<ProcessedImage | null>(null);
  selectedImageRef.current = selectedImage;

  // Cleanup object URL when component unmounts
  useEffect(() => {
    return () => {
      if (selectedImageRef.current?.previewUrl) {
        URL.revokeObjectURL(selectedImageRef.current.previewUrl);
      }
      ocrService.cancel().catch(() => {});
    };
  }, []);

  const runOCR = useCallback(
    async (
      imageObj: ProcessedImage,
      lang: SupportedLanguage,
      withContrast: boolean
    ) => {
      const jobId = ++activeJobIdRef.current;
      setError(null);
      setStage('loading-engine');
      setProgress(5);
      setStatusMessage('Preparing OCR engine...');

      try {
        const text = await ocrService.recognize(
          imageObj.file,
          lang,
          {
            onProgress: (prog: OCRProgressInfo) => {
              if (jobId === activeJobIdRef.current) {
                setStage(prog.stage);
                setProgress(prog.progress);
                setStatusMessage(prog.message);
              }
            },
          },
          { enhanceContrast: withContrast }
        );

        if (jobId !== activeJobIdRef.current) return;

        const trimmed = text.trim();
        if (!trimmed) {
          setStage('empty');
          setProgress(100);
          setStatusMessage('No readable text was found in this image. Try a clearer image.');
          setExtractedText('');
        } else {
          setStage('completed');
          setProgress(100);
          setStatusMessage('Text extracted successfully.');
          setExtractedText(text);
        }
      } catch (err: any) {
        if (jobId !== activeJobIdRef.current) return;

        if (err?.message?.includes('cancelled')) {
          setStage('idle');
          setProgress(0);
          setStatusMessage('');
          return;
        }

        setStage('error');
        setProgress(0);
        const errMsg = err?.message || 'Unable to extract text from this image.';
        setError(errMsg);
        setStatusMessage(errMsg);
      }
    },
    []
  );

  /**
   * Process a new image from upload, paste, or drop.
   * If the new file is invalid, keeps existing image and result intact.
   */
  const processNewImage = useCallback(
    async (file: File) => {
      setError(null);

      let newImage: ProcessedImage;
      try {
        newImage = await inspectImage(file);
      } catch (validationErr: any) {
        // Keep current image and text, just notify error
        setError(validationErr.message || 'Invalid image file.');
        return;
      }

      // Revoke previous URL to prevent memory leaks
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }

      setSelectedImage(newImage);
      setExtractedText('');

      // Automatically run OCR
      runOCR(newImage, language, enhanceContrast);
    },
    [selectedImage, language, enhanceContrast, runOCR]
  );

  /**
   * Re-run OCR on current image (e.g. after language or contrast toggle)
   */
  const reprocess = useCallback(
    (newLang?: SupportedLanguage, newContrast?: boolean) => {
      if (!selectedImage) return;
      const targetLang = newLang ?? language;
      const targetContrast = newContrast ?? enhanceContrast;
      runOCR(selectedImage, targetLang, targetContrast);
    },
    [selectedImage, language, enhanceContrast, runOCR]
  );

  /**
   * Change recognition language
   */
  const changeLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      setLanguage(newLang);
      if (selectedImage && stage !== 'loading-engine' && stage !== 'recognizing') {
        reprocess(newLang, enhanceContrast);
      }
    },
    [selectedImage, stage, enhanceContrast, reprocess]
  );

  /**
   * Toggle contrast enhancement
   */
  const toggleContrast = useCallback(
    (enabled: boolean) => {
      setEnhanceContrast(enabled);
      if (selectedImage && stage !== 'loading-engine' && stage !== 'recognizing') {
        reprocess(language, enabled);
      }
    },
    [selectedImage, stage, language, reprocess]
  );

  /**
   * Cancel ongoing OCR
   */
  const cancel = useCallback(async () => {
    activeJobIdRef.current++;
    await ocrService.cancel();
    setStage('idle');
    setProgress(0);
    setStatusMessage('Processing was cancelled.');
  }, []);

  /**
   * Reset the entire state
   */
  const reset = useCallback(() => {
    activeJobIdRef.current++;
    ocrService.cancel().catch(() => {});

    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }

    setSelectedImage(null);
    setStage('idle');
    setProgress(0);
    setStatusMessage('');
    setExtractedText('');
    setError(null);
  }, [selectedImage]);

  return {
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
    isProcessing: stage === 'loading-engine' || stage === 'loading-language' || stage === 'recognizing',
  };
}
