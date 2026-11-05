import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '../test-assets');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  console.log('Launching browser to generate test assets...');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 800, height: 400 } });

  // 1. English sample PNG
  await page.setContent(`
    <div style="font-family: Arial, sans-serif; background: #ffffff; color: #111111; padding: 40px; font-size: 26px; line-height: 1.6;">
      <h1 style="font-size: 32px; margin: 0 0 16px 0;">OCR Verification Test</h1>
      <p style="margin: 0 0 12px 0;">The quick brown fox jumps over the lazy dog.</p>
      <p style="margin: 0;">Client-side WebAssembly OCR engine processing text locally.</p>
    </div>
  `);
  await page.screenshot({ path: path.join(outDir, 'english-sample.png'), type: 'png' });
  console.log('Created english-sample.png');

  // 2. Indonesian sample JPG
  await page.setContent(`
    <div style="font-family: Arial, sans-serif; background: #ffffff; color: #111111; padding: 40px; font-size: 26px; line-height: 1.6;">
      <h1 style="font-size: 32px; margin: 0 0 16px 0;">Pengujian Ekstraksi Teks Bahasa Indonesia</h1>
      <p style="margin: 0 0 12px 0;">Aplikasi pengubah gambar menjadi teks berbasis peramban web.</p>
      <p style="margin: 0;">Semua data diproses secara lokal tanpa dikirim ke server luar.</p>
    </div>
  `);
  await page.screenshot({ path: path.join(outDir, 'indonesian-sample.jpg'), type: 'jpeg', quality: 95 });
  console.log('Created indonesian-sample.jpg');

  // 3. Mixed sample WEBP
  await page.setContent(`
    <div style="font-family: Arial, sans-serif; background: #ffffff; color: #111111; padding: 40px; font-size: 26px; line-height: 1.6;">
      <h1 style="font-size: 32px; margin: 0 0 14px 0;">Bukti Transaksi - Payment Invoice #4092</h1>
      <p style="margin: 0 0 10px 0;">Nama Pelanggan: Budi Santoso</p>
      <p style="margin: 0 0 10px 0;">Item: Wireless Keyboard Gaming (Harga: Rp 750.000)</p>
      <p style="margin: 0;">Status: Payment Received. Terima kasih banyak!</p>
    </div>
  `);
  await page.screenshot({ path: path.join(outDir, 'mixed-sample.webp'), type: 'webp' });
  console.log('Created mixed-sample.webp');

  // 4. Empty sample PNG (no text)
  await page.setContent(`
    <div style="background: #ffffff; width: 100%; height: 100%; min-height: 300px;"></div>
  `);
  await page.screenshot({ path: path.join(outDir, 'empty-sample.png'), type: 'png' });
  console.log('Created empty-sample.png');

  // 5. Large image PNG
  await page.setViewportSize({ width: 2400, height: 1400 });
  await page.setContent(`
    <div style="font-family: Arial, sans-serif; background: #ffffff; color: #111111; padding: 80px; font-size: 44px; line-height: 1.8;">
      <h1 style="font-size: 58px;">Large High-Resolution Document</h1>
      <p>Performance test for high resolution screenshot extraction.</p>
      <p>Ensuring no UI freezing or memory leak occurs during processing.</p>
    </div>
  `);
  await page.screenshot({ path: path.join(outDir, 'large-sample.png'), type: 'png' });
  console.log('Created large-sample.png');

  await browser.close();

  // 6. Invalid text file named .png
  fs.writeFileSync(path.join(outDir, 'invalid-text-file.png'), 'This is plain text pretending to be a PNG image.');
  console.log('Created invalid-text-file.png');

  // 7. Corrupted image
  const corruptBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00]);
  fs.writeFileSync(path.join(outDir, 'corrupted-sample.png'), corruptBuf);
  console.log('Created corrupted-sample.png');

  console.log('All test assets generated successfully!');
})();
