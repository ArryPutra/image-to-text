import { createWorker, OEM, PSM } from 'tesseract.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const HAS_VOWEL = /[aeiouyAEIOUY]/;
const COMMON_SHORT_WORDS = new Set([
  'di', 'ke', 'ya', 'ha', 'si', 'in', 'on', 'at', 'to', 'is', 'it', 'he', 'we', 
  'me', 'my', 'by', 'no', 'so', 'up', 'do', 'go', 'an', 'as', 'if', 'or', 'us',
  'dan', 'ini', 'itu', 'ada', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
  'rp', 'id', 'en', 'no.', 'no', 'ut', 'pt', 'cv', 'tbk'
]);

export function evaluateLineQuality(text, confidence) {
  const trimmed = text.trim();
  if (!trimmed) return { isNoise: true, score: 0, text: '' };

  const clean = trimmed
    .replace(/^[^a-zA-Z0-9(\[\"\'\u00A0-\uFFFF]+|[^a-zA-Z0-9)\]\"\'\u00A0-\uFFFF]+$/g, '')
    .trim();
  if (!clean) return { isNoise: true, score: 0, text: '' };

  const letters = clean.replace(/[^a-zA-Z]/g, '');
  const digits = clean.replace(/[^0-9]/g, '');
  const alphaNumCount = letters.length + digits.length;
  const totalChars = clean.length;
  const alphaRatio = alphaNumCount / totalChars;

  if (alphaNumCount === 0) {
    return { isNoise: true, score: 0, text: '' };
  }

  // Single character line
  if (clean.length === 1) {
    if (confidence < 75 || !/[a-zA-Z0-9]/.test(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
    if (letters.length === 1 && !['a', 'A', 'i', 'I'].includes(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
  }

  // 2-character line
  if (clean.length === 2) {
    const lower = clean.toLowerCase();
    if (confidence < 70 && !COMMON_SHORT_WORDS.has(lower) && !/^\d{2}$/.test(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
  }

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  let plausibleWords = 0;
  let gibberishWords = 0;

  for (const w of words) {
    const wLetters = w.replace(/[^a-zA-Z]/g, '');
    const wDigits = w.replace(/[^0-9]/g, '');

    // Pure digits / currency / codes
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
        gibberishWords++;
      }
    } else if (wLetters.length > 0) {
      if (COMMON_SHORT_WORDS.has(wLetters.toLowerCase())) {
        plausibleWords++;
      } else if (confidence >= 80) {
        plausibleWords++;
      } else {
        gibberishWords++;
      }
    }
  }

  // Rule: For short lines (< 3 words and < 12 characters), if confidence is low (< 55),
  // it is an isolated symbol/edge noise fragment (e.g. "Am MEA", "me", "In BB 4")
  if (words.length < 3 && clean.length < 12 && confidence < 55) {
    return { isNoise: true, score: 0, text: '' };
  }

  // If the line consists only of gibberish words and low/moderate confidence
  if (plausibleWords === 0 && (confidence < 75 || gibberishWords > 0)) {
    return { isNoise: true, score: 0, text: '' };
  }

  let score = (confidence * 0.5) + (Math.min(plausibleWords, 8) * 6) + (alphaRatio * 20);
  if (gibberishWords > 0) score -= (gibberishWords * 15);

  return {
    isNoise: false,
    score: Math.max(1, score),
    text: clean,
  };
}

export function deduplicateAndRankLines(candidateLines) {
  if (candidateLines.length === 0) return [];

  const sorted = [...candidateLines].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const merged = [];

  for (const candidate of sorted) {
    const matchIndex = merged.findIndex((existing) => {
      const h1 = existing.bbox.y1 - existing.bbox.y0;
      const h2 = candidate.bbox.y1 - candidate.bbox.y0;
      const overlapY = Math.min(existing.bbox.y1, candidate.bbox.y1) - Math.max(existing.bbox.y0, candidate.bbox.y0);
      const isOverlap = overlapY > 0.45 * Math.min(h1, h2);
      const isTextMatch = existing.text.toLowerCase() === candidate.text.toLowerCase();
      return isOverlap || isTextMatch;
    });

    if (matchIndex === -1) {
      merged.push(candidate);
    } else {
      if (candidate.score > merged[matchIndex].score) {
        merged[matchIndex] = candidate;
      }
    }
  }

  merged.sort((a, b) => a.bbox.y0 - b.bbox.y0);
  return merged.map((m) => m.text);
}

async function runMultiPass(worker, imgPath) {
  const candidatePool = [];

  // PASS 1: Full-Image Recognition (PSM 3)
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const pass1Res = await worker.recognize(imgPath, {}, { text: true, blocks: true });
  pass1Res.data.blocks?.forEach((b) =>
    b.paragraphs.forEach((p) =>
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
      })
    )
  );

  // PASS 2: Sparse Text Mode (PSM 11) for scattered text detection
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  const pass2Res = await worker.recognize(imgPath, {}, { text: true, blocks: true });
  pass2Res.data.blocks?.forEach((b) =>
    b.paragraphs.forEach((p) =>
      p.lines.forEach((l) => {
        const q = evaluateLineQuality(l.text, l.confidence);
        if (!q.isNoise) {
          candidatePool.push({
            text: q.text,
            confidence: l.confidence,
            score: q.score,
            bbox: l.bbox,
            pass: 2,
          });
        }
      })
    )
  );

  // PASS 3: Targeted Single-Line OCR (PSM 7) on candidate areas
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  const verifiedLines = [];

  for (const cand of candidatePool) {
    const pad = 6;
    const rect = {
      left: Math.max(0, cand.bbox.x0 - pad),
      top: Math.max(0, cand.bbox.y0 - pad),
      width: cand.bbox.x1 - cand.bbox.x0 + pad * 2,
      height: cand.bbox.y1 - cand.bbox.y0 + pad * 2,
    };
    try {
      const pass3Res = await worker.recognize(imgPath, { rectangle: rect });
      const q = evaluateLineQuality(pass3Res.data.text, pass3Res.data.confidence);
      if (!q.isNoise) {
        // If PSM 7 gave higher confidence or better score, prefer PSM 7
        if (q.score >= cand.score) {
          verifiedLines.push({
            text: q.text,
            confidence: pass3Res.data.confidence,
            score: q.score + 10,
            bbox: cand.bbox,
            pass: 3,
          });
        } else {
          verifiedLines.push(cand);
        }
      } else if (cand.score > 60) {
        // If original was high quality (e.g. document text), keep original
        verifiedLines.push(cand);
      }
    } catch {
      if (cand.score > 60) verifiedLines.push(cand);
    }
  }

  // Restore PSM AUTO
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });

  return deduplicateAndRankLines(verifiedLines);
}

(async () => {
  const worker = await createWorker('ind+eng', OEM.LSTM_ONLY, {
    langPath: path.resolve(projectRoot, 'public/tessdata'),
    cacheMethod: 'none',
  });

  console.log('--- 1. UT LOGO ---');
  const resUT = await runMultiPass(worker, path.resolve(projectRoot, 'test-assets/logo-ut-cropped.png'));
  console.log('Lines:', resUT);

  console.log('\n--- 2. ENGLISH MULTI-LINE DOCUMENT ---');
  const resEng = await runMultiPass(worker, path.resolve(projectRoot, 'test-assets/english-sample.png'));
  console.log('Lines count:', resEng.length);
  console.log(resEng.join('\n'));

  console.log('\n--- 3. INDONESIAN MULTI-LINE DOCUMENT ---');
  const resInd = await runMultiPass(worker, path.resolve(projectRoot, 'test-assets/indonesian-sample.jpg'));
  console.log('Lines count:', resInd.length);
  console.log(resInd.join('\n'));

  console.log('\n--- 4. MIXED INVOICE RECEIPT (WEBP) ---');
  const resMixed = await runMultiPass(worker, path.resolve(projectRoot, 'test-assets/mixed-sample.webp'));
  console.log('Lines count:', resMixed.length);
  console.log(resMixed.join('\n'));

  console.log('\n--- 5. EMPTY IMAGE (NO TEXT) ---');
  const resEmpty = await runMultiPass(worker, path.resolve(projectRoot, 'test-assets/empty-sample.png'));
  console.log('Lines count:', resEmpty.length);

  await worker.terminate();
})();
