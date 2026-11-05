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
  'rp', 'id', 'en', 'no.', 'no', 'ut', 'pt', 'cv', 'tbk', 'bill', 'sam', 'tom', 'joe'
]);

function evaluateLineQuality(text, confidence) {
  const trimmed = text.trim();
  if (!trimmed) return { isNoise: true, score: 0, text: '' };

  const clean = trimmed
    .replace(/^[^a-zA-Z0-9(\[\"\'\$\u00A0-\uFFFF]+|[^a-zA-Z0-9)\]\"\'\$\u00A0-\uFFFF]+$/g, '')
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

  // For short isolated lines (< 2 words and < 8 characters), if confidence is low (< 50)
  if (words.length < 2 && clean.length < 8 && confidence < 50) {
    return { isNoise: true, score: 0, text: '' };
  }

  if (plausibleWords === 0 && (confidence < 75 || gibberishWords > 0)) {
    return { isNoise: true, score: 0, text: '' };
  }

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
 * 1. Groups items by vertical row (line).
 * 2. Within each row, sorts distinct column items horizontally (left to right).
 * 3. Deduplicates items that overlap BOTH vertically AND horizontally.
 */
function assembleRowsAndDeduplicate(candidates) {
  if (candidates.length === 0) return [];

  // Sort candidates primarily by Y, then by X
  const sorted = [...candidates].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  // Group candidates into visual rows (lines) based on vertical overlap
  const rows = [];

  for (const item of sorted) {
    const itemH = item.bbox.y1 - item.bbox.y0;

    // Find row that has significant vertical overlap with this item
    let targetRow = null;
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

        // Or one contains the other (e.g. full sentence vs individual word)
        if (
          existing.bbox.x0 <= item.bbox.x0 + 5 &&
          existing.bbox.x1 >= item.bbox.x1 - 5 &&
          existing.text.includes(item.text)
        ) {
          // Existing already contains item!
          matchedItemIndex = i;
          break;
        }
        if (
          item.bbox.x0 <= existing.bbox.x0 + 5 &&
          item.bbox.x1 >= existing.bbox.x1 - 5 &&
          item.text.includes(existing.text)
        ) {
          // Item contains existing!
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
        // Duplicate in the same spot: keep the one with higher quality score or fuller sentence
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
  const outputLines = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    // Combine items in the row with a clean space (or tab if widely spaced)
    const lineText = r.items.map((it) => it.text).join('   ').trim();
    if (lineText) {
      outputLines.push(lineText);
    }
  }

  return outputLines;
}

(async () => {
  const worker = await createWorker('ind+eng', OEM.LSTM_ONLY, {
    langPath: path.resolve(projectRoot, 'public/tessdata'),
    cacheMethod: 'none',
  });

  console.log('--- TESTING ON SPREADSHEET IMAGE ---');
  const imgPath = path.resolve(projectRoot, 'test-assets/spreadsheet-cropped.png');

  // Pass 1: AUTO
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const p1 = await worker.recognize(imgPath, {}, { text: true, blocks: true });
  const candidates = [];
  p1.data.blocks?.forEach((b) =>
    b.paragraphs.forEach((p) =>
      p.lines.forEach((l) => {
        const q = evaluateLineQuality(l.text, l.confidence);
        if (!q.isNoise) {
          candidates.push({
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

  // Pass 2: SPARSE_TEXT
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  const p2 = await worker.recognize(imgPath, {}, { text: true, blocks: true });
  p2.data.blocks?.forEach((b) =>
    b.paragraphs.forEach((p) =>
      p.lines.forEach((l) => {
        const q = evaluateLineQuality(l.text, l.confidence);
        if (!q.isNoise) {
          candidates.push({
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

  const resultSpreadsheet = assembleRowsAndDeduplicate(candidates);
  console.log('--- ASSEMBLED SPREADSHEET RESULT ---');
  console.log(resultSpreadsheet.join('\n'));

  console.log('\n--- TESTING ON UT LOGO ---');
  const logoPath = path.resolve(projectRoot, 'test-assets/logo-ut-cropped.png');
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const p1Logo = await worker.recognize(logoPath, {}, { text: true, blocks: true });
  const logoCandidates = [];
  p1Logo.data.blocks?.forEach((b) =>
    b.paragraphs.forEach((p) =>
      p.lines.forEach((l) => {
        const q = evaluateLineQuality(l.text, l.confidence);
        if (!q.isNoise) {
          logoCandidates.push({
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
  const resultLogo = assembleRowsAndDeduplicate(logoCandidates);
  console.log('--- ASSEMBLED LOGO RESULT ---');
  console.log(resultLogo);

  await worker.terminate();
})();
