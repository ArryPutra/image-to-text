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
  'dan', 'ini', 'itu', 'ada', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all'
]);

function evaluateLineQuality(text, confidence) {
  const trimmed = text.trim();
  if (!trimmed) return { isNoise: true, score: 0, text: '' };

  // Strip obvious edge noise (isolated bullets/tildes/quotes at line boundaries)
  const clean = trimmed.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
  if (!clean) return { isNoise: true, score: 0, text: '' };

  const letters = clean.replace(/[^a-zA-Z]/g, '');
  const digits = clean.replace(/[^0-9]/g, '');
  const alphaNumCount = letters.length + digits.length;
  const totalChars = clean.length;
  const alphaRatio = alphaNumCount / totalChars;

  // Rule 1: No alphanumeric characters
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
    if (confidence < 75 && !COMMON_SHORT_WORDS.has(lower) && !/^\d{2}$/.test(clean)) {
      return { isNoise: true, score: 0, text: '' };
    }
  }

  // Words breakdown
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  let plausibleWords = 0;
  let gibberishWords = 0;

  for (const w of words) {
    const wLetters = w.replace(/[^a-zA-Z]/g, '');
    const wDigits = w.replace(/[^0-9]/g, '');

    // Pure number/code
    if (wDigits.length >= 1 && wLetters.length === 0) {
      plausibleWords++;
      continue;
    }

    if (wLetters.length >= 3) {
      if (HAS_VOWEL.test(wLetters)) {
        plausibleWords++;
      } else {
        // 3+ letters without vowels is almost certainly a graphic edge artifact
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

  // If the line consists only of gibberish words and low/moderate confidence
  if (plausibleWords === 0 && (confidence < 75 || gibberishWords > 0)) {
    return { isNoise: true, score: 0, text: '' };
  }

  let score = (confidence * 0.5) + (Math.min(plausibleWords, 6) * 5) + (alphaRatio * 20);
  if (gibberishWords > 0) score -= (gibberishWords * 15);

  return {
    isNoise: false,
    score: Math.max(1, score),
    text: clean,
  };
}

(async () => {
  const worker = await createWorker('ind+eng', OEM.LSTM_ONLY, {
    langPath: path.resolve(projectRoot, 'public/tessdata'),
    cacheMethod: 'none',
  });

  console.log('--- TEST 1: LOGO UT ---');
  const resLogo = await worker.recognize(path.resolve(projectRoot, 'test-assets/logo-ut-cropped.png'), {}, { text: true, blocks: true });
  const linesLogo = [];
  resLogo.data.blocks?.forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    const evalResult = evaluateLineQuality(l.text, l.confidence);
    console.log(JSON.stringify(l.text.trim()), 'conf:', l.confidence, 'isNoise:', evalResult.isNoise);
    if (!evalResult.isNoise) {
      linesLogo.push(evalResult.text);
    }
  })));
  console.log('Result UT lines:', linesLogo);

  console.log('\n--- TEST 2: ENGLISH DOCUMENT ---');
  const resEng = await worker.recognize(path.resolve(projectRoot, 'test-assets/english-sample.png'), {}, { text: true, blocks: true });
  const linesEng = [];
  resEng.data.blocks?.forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    const evalResult = evaluateLineQuality(l.text, l.confidence);
    if (!evalResult.isNoise) {
      linesEng.push(evalResult.text);
    }
  })));
  console.log('Result English lines count:', linesEng.length);
  console.log(linesEng.join('\n'));

  console.log('\n--- TEST 3: INDONESIAN DOCUMENT ---');
  const resInd = await worker.recognize(path.resolve(projectRoot, 'test-assets/indonesian-sample.jpg'), {}, { text: true, blocks: true });
  const linesInd = [];
  resInd.data.blocks?.forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    const evalResult = evaluateLineQuality(l.text, l.confidence);
    if (!evalResult.isNoise) {
      linesInd.push(evalResult.text);
    }
  })));
  console.log('Result Indonesian lines count:', linesInd.length);
  console.log(linesInd.join('\n'));

  console.log('\n--- TEST 4: EMPTY IMAGE ---');
  const resEmpty = await worker.recognize(path.resolve(projectRoot, 'test-assets/empty-sample.png'), {}, { text: true, blocks: true });
  const linesEmpty = [];
  resEmpty.data.blocks?.forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    const evalResult = evaluateLineQuality(l.text, l.confidence);
    if (!evalResult.isNoise) {
      linesEmpty.push(evalResult.text);
    }
  })));
  console.log('Result Empty lines count:', linesEmpty.length);

  await worker.terminate();
})();
