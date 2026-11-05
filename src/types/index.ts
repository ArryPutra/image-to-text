export type SupportedLanguage = 'ind+eng' | 'eng' | 'ind';

export interface LanguageOption {
  id: SupportedLanguage;
  label: string;
  badge: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProcessedImage {
  file: File;
  name: string;
  size: number;
  formattedSize: string;
  dimensions: ImageDimensions;
  previewUrl: string;
}

export type OCRStage = 
  | 'idle'
  | 'validating'
  | 'loading-engine'
  | 'loading-language'
  | 'recognizing'
  | 'completed'
  | 'empty'
  | 'error';

export interface OCRProgressInfo {
  stage: OCRStage;
  progress: number; // 0 to 100
  message: string;
}

export interface PreprocessingOptions {
  enhanceContrast: boolean;
  grayscale: boolean;
}
