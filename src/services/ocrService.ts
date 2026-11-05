import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { OCRProgressInfo, SupportedLanguage } from '../types';
import { prepareImageVariants } from './imagePreprocessor';

export interface RecognizeCallbacks {
  onProgress?: (progress: OCRProgressInfo) => void;
}

export interface CandidateLine {
  text: string;
  confidence: number;
  score: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  pass: number;
}

const HAS_VOWEL = /[aeiouyAEIOUY]/;
const COMMON_SHORT_WORDS = new Set([
  'di', 'ke', 'ya', 'ha', 'si', 'in', 'on', 'at', 'to', 'is', 'it', 'he', 'we',
  'me', 'my', 'by', 'no', 'so', 'up', 'do', 'go', 'an', 'as', 'if', 'or', 'us',
  'dan', 'ini', 'itu', 'ada', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
  'rp', 'id', 'en', 'no.', 'no', 'ut', 'pt', 'cv', 'tbk', 'bill', 'sam', 'tom', 'joe'
]);

/**
 * Evaluates line quality and filters out graphic false positives
 * without dropping valid low-confidence text or table data.
 */
export function evaluateLineQuality(
  text: string,
  confidence: number
): { isNoise: boolean; score: number; text: string } {
  const trimmed = text.trim();
  if (!trimmed) return { isNoise: true, score: 0, text: '' };

  // Strip boundary noise (preserving currency symbols like $, Rp)
  const clean = trimmed
    .replace(/^[^a-zA-Z0-9(\[\"\'\$\u00A0-\uFFFF]+|[^a-zA-Z0-9)\]\"\'\$\u00A0-\uFFFF]+$/g, '')
    .trim();
  if (!clean) return { isNoise: true, score: 0, text: '' };

  const letters = clean.replace(/[^a-zA-Z]/g, '');
  const digits = clean.replace(/[^0-9]/g, '');
  const alphaNumCount = letters.length + digits.length;
  const totalChars = clean.length;
  const alphaRatio = alphaNumCount / totalChars;

  // Rule 1: No alphanumeric characters at all (pure symbols)
  if (alphaNumCount === 0) {
    return { isNoise: true, score: 0, text: '' };
  }

  // Rule 2: Single character line
  if (clean.length === 1) {
    if (confidence < 75 || !/[a-zA-Z0-9]/.test(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
    if (letters.length === 1 && !['a', 'A', 'i', 'I'].includes(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
  }

  // Rule 3: 2-character line
  if (clean.length === 2) {
    const lower = clean.toLowerCase();
    if (confidence < 70 && !COMMON_SHORT_WORDS.has(lower) && !/^\d{2}$/.test(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
  }

  // Words breakdown
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  let plausibleWords = 0;
  let gibberishWords = 0;

  for (const w of words) {
    const wLetters = w.replace(/[^a-zA-Z]/g, '');
    const wDigits = w.replace(/[^0-9]/g, '');

    // Pure digits / currency / codes (e.g. "$41,107", "217", "268")
    if (wDigits.length >= 1 && wLetters.length === 0) {
      if (wDigits.length >= 2 || confidence >= 70) {
        plausibleWords++;
      } else {
        gibberishWords++;
      }
      continue;
    }

    if (wLetters.length >= 3) {
      if (HAS_VOWEL.test(wLetters)) {
        plausibleWords++;
      } else {
        // 3+ letters without vowels is almost certainly an edge/symbol artifact
        gibberishWords++;
      }
    } else if (wLetters.length > 0) {
      if (COMMON_SHORT_WORDS.has(wLetters.toLowerCase())) {
        plausibleWords++;
      } else if (confidence >= 75) {
        plausibleWords++;
      } else {
        gibberishWords++;
      }
    }
  }

  // Rule 4: For short isolated lines (< 2 words and < 8 characters), if confidence is low (< 50),
  // it is an isolated graphic noise fragment (e.g. "Am MEA", "me", "In BB 4")
  if (words.length < 2 && clean.length < 8 && confidence < 50) {
    return { isNoise: true, score: 0, text: '' };
  }

  // If the line consists only of gibberish words and low/moderate confidence
  if (plausibleWords === 0 && (confidence < 75 || gibberishWords > 0)) {
    return { isNoise: true, score: 0, text: '' };
  }

  // Quality score formula
  let score = (confidence * 0.4) + (Math.min(plausibleWords, 10) * 8) + (alphaRatio * 20);
  if (gibberishWords > 0) score -= (gibberishWords * 15);

  return {
    isNoise: false,
    score: Math.max(1, score),
    text: clean,
  };
}

/**
 * Robust line & column assembler:
 * 1. Groups items by visual row (line) based on vertical overlap.
 * 2. Within each row, sorts distinct column items horizontally (left to right).
 * 3. Deduplicates items that overlap BOTH vertically AND horizontally.
 */
export function assembleRowsAndDeduplicate(candidates: CandidateLine[]): string[] {
  if (candidates.length === 0) return [];

  // Sort candidates primarily by Y, then by X
  const sorted = [...candidates].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  // Group candidates into visual rows (lines) based on vertical overlap
  const rows: { y0: number; y1: number; items: CandidateLine[] }[] = [];

  for (const item of sorted) {
    const itemH = item.bbox.y1 - item.bbox.y0;

    // Find row that has significant vertical overlap with this item
    let targetRow: { y0: number; y1: number; items: CandidateLine[] } | null = null;
    for (const r of rows) {
      const rowH = r.y1 - r.y0;
      const overlapY = Math.min(r.y1, item.bbox.y1) - Math.max(r.y0, item.bbox.y0);
      if (overlapY > 0.45 * Math.min(rowH, itemH)) {
        targetRow = r;
        break;
      }
    }

    if (!targetRow) {
      rows.push({
        y0: item.bbox.y0,
        y1: item.bbox.y1,
        items: [item],
      });
    } else {
      // Check if this item is a duplicate of an existing item in the row
      let matchedItemIndex = -1;
      for (let i = 0; i < targetRow.items.length; i++) {
        const existing = targetRow.items[i];
        const existW = existing.bbox.x1 - existing.bbox.x0;
        const itemW = item.bbox.x1 - item.bbox.x0;
        const overlapX = Math.min(existing.bbox.x1, item.bbox.x1) - Math.max(existing.bbox.x0, item.bbox.x0);

        // They overlap horizontally as well!
        if (overlapX > 0.45 * Math.min(existW, itemW)) {
          matchedItemIndex = i;
          break;
        }

        // Or one contains the other (e.g. full assembled row vs individual column word)
        if (
          existing.bbox.x0 <= item.bbox.x0 + 6 &&
          existing.bbox.x1 >= item.bbox.x1 - 6 &&
          existing.text.includes(item.text)
        ) {
          matchedItemIndex = i;
          break;
        }
        if (
          item.bbox.x0 <= existing.bbox.x0 + 6 &&
          item.bbox.x1 >= existing.bbox.x1 - 6 &&
          item.text.includes(existing.text)
        ) {
          matchedItemIndex = i;
          break;
        }
      }

      if (matchedItemIndex === -1) {
        // Distinct column on the same row! Add it!
        targetRow.items.push(item);
        targetRow.y0 = Math.min(targetRow.y0, item.bbox.y0);
        targetRow.y1 = Math.max(targetRow.y1, item.bbox.y1);
      } else {
        // Duplicate in the same spot: keep the fuller sentence or higher quality score
        const existing = targetRow.items[matchedItemIndex];
        const existingWords = existing.text.trim().split(/\s+/).length;
        const itemWords = item.text.trim().split(/\s+/).length;

        if (itemWords > existingWords || item.score > existing.score) {
          targetRow.items[matchedItemIndex] = item;
        }
      }
    }
  }

  // Sort rows top-to-bottom
  rows.sort((a, b) => a.y0 - b.y0);

  // For each row, sort columns left-to-right and combine
  const outputLines: string[] = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    // Combine items in the row with spaces
    const lineText = r.items.map((it) => it.text).join('   ').trim();
    if (lineText) {
      outputLines.push(lineText);
    }
  }

  return outputLines;
}

class OCRService {
  private worker: Worker | null = null;
  private currentLanguage: SupportedLanguage | null = null;
  private isInitializing: boolean = false;
  private isRecognizing: boolean = false;
  private isCancelled: boolean = false;
  private initPromise: Promise<Worker> | null = null;

  public get isBusy(): boolean {
    return this.isInitializing || this.isRecognizing;
  }

  private getWorkerOptions(onProgress?: (progress: OCRProgressInfo) => void) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    return {
      workerPath: `${origin}/tesseract/worker.min.js`,
      corePath: `${origin}/tesseract/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${origin}/tessdata`,
      cacheMethod: 'write',
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (!onProgress || this.isCancelled) return;

        let stage: OCRProgressInfo['stage'] = 'recognizing';
        let userMessage = 'Extracting text...';
        let mappedProgress = 0;

        switch (m.status) {
          case 'loading tesseract core':
          case 'initializing tesseract':
          case 'initialized tesseract':
            stage = 'loading-engine';
            userMessage = 'Preparing OCR engine...';
            mappedProgress = 10;
            break;
          case 'loading language traineddata':
          case 'loaded language traineddata':
            stage = 'loading-language';
            userMessage = 'Loading language models...';
            mappedProgress = 20;
            break;
          case 'initializing api':
          case 'initialized api':
            stage = 'loading-engine';
            userMessage = 'Configuring recognition engine...';
            mappedProgress = 25;
            break;
          default:
            mappedProgress = Math.round((m.progress || 0) * 100);
            userMessage = m.status || 'Processing image...';
        }

        onProgress({
          stage,
          progress: Math.min(100, Math.max(0, mappedProgress)),
          message: userMessage,
        });
      },
      errorHandler: (err: any) => {
        console.error('Tesseract Worker internal error:', err);
      },
    };
  }

  public async getWorker(
    language: SupportedLanguage = 'ind+eng',
    onProgress?: (progress: OCRProgressInfo) => void
  ): Promise<Worker> {
    if (this.worker && this.currentLanguage === language) {
      return this.worker;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    onProgress?.({
      stage: 'loading-engine',
      progress: 5,
      message: 'Preparing OCR engine...',
    });

    this.initPromise = (async () => {
      try {
        if (this.worker) {
          try {
            await this.worker.terminate();
          } catch {
            // ignore cleanup error
          }
          this.worker = null;
        }

        const options = this.getWorkerOptions(onProgress);
        const worker = await createWorker(language, OEM.LSTM_ONLY, options);

        this.worker = worker;
        this.currentLanguage = language;
        this.isInitializing = false;
        return worker;
      } catch (err: any) {
        this.isInitializing = false;
        this.worker = null;
        this.currentLanguage = null;
        const msg = err?.message || String(err);
        throw new Error(
          msg.includes('network') || msg.includes('Failed to fetch')
            ? 'Failed to load local OCR language models. Please check your connection on initial load.'
            : `OCR engine failed to initialize: ${msg}`
        );
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Multi-Pass OCR Execution:
   * Pass 1: Global Full-Image OCR (PSM.AUTO) - captures overall layout & horizontal lines/tables
   * Pass 2: Enhanced & Upscaled Variant with Sparse Text Test (PSM.SPARSE_TEXT - PSM 11) - captures isolated cells
   * Pass 3: Targeted Single-Line OCR (PSM.SINGLE_LINE - PSM 7) on candidate areas - verifies glyphs
   * Quality Evaluation & Row/Column Assembly without duplicate loss or false positives.
   */
  public async recognize(
    file: File | Blob,
    language: SupportedLanguage = 'ind+eng',
    callbacks?: RecognizeCallbacks,
    options?: { enhanceContrast?: boolean }
  ): Promise<string> {
    this.isCancelled = false;
    this.isRecognizing = true;

    try {
      const worker = await this.getWorker(language, callbacks?.onProgress);

      if (this.isCancelled) throw new Error('Processing was cancelled.');

      callbacks?.onProgress?.({
        stage: 'recognizing',
        progress: 30,
        message: 'Pass 1/3: Analyzing full image layout & text rows...',
      });

      // Prepare image variants (Canvas preprocessing, scaling, cropping helper)
      const variants = await prepareImageVariants(file, {
        enhanceContrast: options?.enhanceContrast,
      });

      if (this.isCancelled) throw new Error('Processing was cancelled.');

      const candidatePool: CandidateLine[] = [];

      // ==========================================
      // PASS 1: Global OCR on Primary Image (PSM 3)
      // ==========================================
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const pass1 = await worker.recognize(variants.primary, {}, { text: true, blocks: true });

      if (this.isCancelled) throw new Error('Processing was cancelled.');

      pass1.data.blocks?.forEach((b) => {
        b.paragraphs.forEach((p) => {
          p.lines.forEach((l) => {
            const q = evaluateLineQuality(l.text, l.confidence);
            if (!q.isNoise) {
              candidatePool.push({
                text: q.text,
                confidence: l.confidence,
                score: q.score,
                bbox: l.bbox,
                pass: 1,
              });
            }
          });
        });
      });

      // ==============================================================
      // PASS 2: Preprocessed / Upscaled Image & Sparse Mode (PSM 11)
      // ==============================================================
      callbacks?.onProgress?.({
        stage: 'recognizing',
        progress: 55,
        message: 'Pass 2/3: Scanning sparse text & column data...',
      });

      const pass2Target = variants.upscaled || variants.primary;
      const scale = variants.scaleFactor || 1;

      // Test PSM 11 (Sparse Text) to capture scattered words & table columns
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const pass2 = await worker.recognize(pass2Target, {}, { text: true, blocks: true });

      if (this.isCancelled) throw new Error('Processing was cancelled.');

      pass2.data.blocks?.forEach((b) => {
        b.paragraphs.forEach((p) => {
          p.lines.forEach((l) => {
            const q = evaluateLineQuality(l.text, l.confidence);
            if (!q.isNoise) {
              // Normalize bbox back to primary coordinates
              const normBbox = {
                x0: Math.round(l.bbox.x0 / scale),
                y0: Math.round(l.bbox.y0 / scale),
                x1: Math.round(l.bbox.x1 / scale),
                y1: Math.round(l.bbox.y1 / scale),
              };
              candidatePool.push({
                text: q.text,
                confidence: l.confidence,
                score: q.score,
                bbox: normBbox,
                pass: 2,
              });
            }
          });
        });
      });

      // ==============================================================
      // PASS 3: Targeted Single-Line OCR (PSM 7) on Candidate Areas
      // ==============================================================
      callbacks?.onProgress?.({
        stage: 'recognizing',
        progress: 75,
        message: 'Pass 3/3: Verifying candidate lines (PSM 7)...',
      });

      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });

      const verifiedLines: CandidateLine[] = [];

      for (const cand of candidatePool) {
        if (this.isCancelled) throw new Error('Processing was cancelled.');

        // If candidate is already a long verified sentence / table row from Pass 1, keep it
        const wordCount = cand.text.trim().split(/\s+/).length;
        if (wordCount >= 3 && cand.score >= 65) {
          verifiedLines.push(cand);
          continue;
        }

        const croppedBlob = await variants.cropCandidateArea(cand.bbox, 8);
        if (croppedBlob) {
          try {
            const pass3 = await worker.recognize(croppedBlob);
            const q = evaluateLineQuality(pass3.data.text, pass3.data.confidence);
            if (!q.isNoise) {
              if (q.score >= cand.score) {
                verifiedLines.push({
                  text: q.text,
                  confidence: pass3.data.confidence,
                  score: q.score + 10, // PSM 7 verification bonus
                  bbox: cand.bbox,
                  pass: 3,
                });
              } else {
                verifiedLines.push(cand);
              }
            } else if (cand.score > 60) {
              verifiedLines.push(cand);
            }
          } catch {
            if (cand.score > 60) verifiedLines.push(cand);
          }
        } else {
          if (cand.score > 60) verifiedLines.push(cand);
        }
      }

      // Restore PSM AUTO for next operations
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });

      if (this.isCancelled) throw new Error('Processing was cancelled.');

      callbacks?.onProgress?.({
        stage: 'recognizing',
        progress: 95,
        message: 'Assembling rows and columns...',
      });

      // Assemble rows, columns, and deduplicate with 2D spatial clustering
      const finalLines = assembleRowsAndDeduplicate(verifiedLines);

      return finalLines.join('\n');
    } finally {
      this.isRecognizing = false;
      if (this.worker) {
        this.worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }).catch(() => {});
      }
    }
  }

  public async cancel(): Promise<void> {
    this.isCancelled = true;
    this.isRecognizing = false;

    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (err) {
        console.warn('Error terminating worker during cancel:', err);
      }
      this.worker = null;
      this.currentLanguage = null;
    }
    this.initPromise = null;
    this.isInitializing = false;
  }

  public async destroy(): Promise<void> {
    await this.cancel();
  }
}

export const ocrService = new OCRService();
