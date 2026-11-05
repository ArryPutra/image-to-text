# ImageToText — Fast, Private In-Browser OCR

A production-ready, lightweight, privacy-first Image to Text web application. Extracts readable text from images and screenshots directly in the user's browser using WebAssembly and Web Workers.

## 🚀 Key Features

- **⚡ Frictionless Workflow**: Take a screenshot with <kbd>Win + Shift + S</kbd> or <kbd>Cmd + Shift + 4</kbd>, open the app, press <kbd>Ctrl + V</kbd>, and copy your text. OCR starts automatically without extra clicks.
- **🛡️ 100% Strict Local Privacy**: Zero server uploads. No backend API, no database, no third-party tracking, no AI API dependencies. All WebAssembly execution and language models run entirely inside your browser.
- **🌐 Dual-Language Support**: Configured for both Indonesian (`ind`) and English (`eng`) recognition, with optional single-language filters.
- **📋 Windows Snipping Tool & Global Paste Support**: Dedicated clipboard listener detects screenshots from Windows Snipping Tool, browser clipboard, or screenshot utilities while preserving standard text paste when editing.
- **🖼️ Flexible Input Methods**: Click to browse, Drag & Drop, or Paste directly via <kbd>Ctrl + V</kbd> / <kbd>⌘ + V</kbd>. Supports PNG, JPG, JPEG, and WEBP formats up to 15 MB.
- **🎨 Minimal & Professional Design**: Clean developer-tool aesthetic built with Tailwind CSS. High contrast, accessible, responsive across desktop, tablet, and mobile.
- **✍️ Editable Results & Action Bar**: Real-time word and character counters, one-click clipboard copy with animated visual feedback, and UTF-8 `.txt` file download.
- **🔍 Multi-Pass Logo & Graphic Symbol Suppression**: 3-pass OCR architecture using Page Segmentation Modes (PSM 3, PSM 11, and targeted PSM 7) combined with lexical plausibility scoring and spatial clustering to eliminate false positives from logo graphics while preserving valid text.
- **🧪 Canvas Preprocessing & Upscaling**: Dynamic resolution enhancement and contrast normalization for low-resolution screenshots and logos.

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **OCR Engine**: [Tesseract.js v7](https://tesseract.projectnaptha.com/) with WebAssembly & Web Workers
- **Verification**: [Playwright](https://playwright.dev/) End-to-End Suite

---

## 📁 Project Structure

```
image-to-text/
├── public/
│   ├── favicon.svg                  # Brand favicon
│   ├── tessdata/                    # Self-hosted traineddata models
│   │   ├── eng.traineddata.gz       # English fast model
│   │   └── ind.traineddata.gz       # Indonesian fast model
│   └── tesseract/                   # Self-hosted Tesseract worker & WebAssembly core
│       ├── worker.min.js
│       └── tesseract-core-*.wasm
├── scripts/
│   ├── generate-test-assets.js      # Generates synthetic sample images for testing
│   └── verify-all-scenarios.js      # Automated 20-scenario E2E test runner
├── src/
│   ├── components/
│   │   ├── Header.tsx               # Product logo, privacy badge, language selector
│   │   ├── Hero.tsx                 # Heading, subtitle, feature highlights
│   │   ├── UploadArea.tsx           # Drag & drop zone, file picker, paste hint
│   │   ├── ImagePreview.tsx         # Preview thumbnail, file metadata, replace/remove
│   │   ├── ProcessingStatus.tsx     # WebAssembly progress bar, status, cancel button
│   │   ├── OCRResult.tsx            # Editable textarea, live word/char count, copy, download
│   │   ├── EmptyResult.tsx          # Friendly banner when image contains no text
│   │   ├── ErrorBanner.tsx          # Accessible error alert with retry
│   │   └── Footer.tsx               # Privacy statement & copyright
│   ├── hooks/
│   │   ├── useClipboardPaste.ts     # Global paste listener handling clipboard screenshots
│   │   └── useOCR.ts                # OCR state management hook
│   ├── services/
│   │   ├── imagePreprocessor.ts     # Canvas validation, contrast stretching, memory safety
│   │   └── ocrService.ts            # Tesseract worker singleton lifecycle & cancellation
│   ├── types/
│   │   └── index.ts                 # TypeScript types and interfaces
│   ├── App.tsx                      # Main coordinator component
│   ├── index.css                    # Tailwind CSS directives
│   └── main.tsx                     # React application entry
├── index.html                       # HTML document template with accessibility tags
├── package.json                     # Scripts and dependencies
├── tsconfig.json                    # TypeScript compiler options
└── vite.config.ts                   # Vite configuration with Tailwind plugin
```

---

## ⚡ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher (tested on Node v24)
- npm or pnpm

### Installation

```bash
# Navigate to the project directory
cd image-to-text

# Install dependencies
npm install
```

### Development Mode

Run the local development server with Hot Module Replacement:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build

Create an optimized static distribution:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 🧪 Testing & Acceptance Criteria

All 20 acceptance scenarios defined in the master specification are automated and verified via Playwright:

| # | Acceptance Scenario | Status | Verification Method |
|---|---------------------|:------:|---------------------|
| 1 | Upload PNG image and extract text | ✅ PASS | Verified with `english-sample.png` |
| 2 | Upload JPG image and extract text | ✅ PASS | Verified with `indonesian-sample.jpg` |
| 3 | Upload WEBP image and extract text | ✅ PASS | Verified with `mixed-sample.webp` |
| 4 | Paste screenshot using <kbd>Ctrl + V</kbd> | ✅ PASS | Synthetic `ClipboardEvent` with image blob |
| 5 | Paste screenshot from Windows Snipping Tool | ✅ PASS | Win+Shift+S clipboard format simulation |
| 6 | Drag and drop an image | ✅ PASS | Verified with native `DragEvent('drop')` |
| 7 | Process Indonesian text | ✅ PASS | Recognizes Indonesian vocabulary |
| 8 | Process English text | ✅ PASS | Recognizes English vocabulary |
| 9 | Process mixed Indonesian & English text | ✅ PASS | Dual-language recognition mode |
| 10 | Logo graphic noise suppression | ✅ PASS | Verified with Universitas Terbuka Logo (0 false positives) |
| 11 | Copy extracted text | ✅ PASS | Clipboard API with 2s "Copied!" feedback |
| 12 | Download extracted text as TXT | ✅ PASS | Validated UTF-8 `.txt` file emission |
| 13 | Edit extracted text manually | ✅ PASS | Live word & character counters update |
| 14 | Reset the application | ✅ PASS | Full state reset to initial upload screen |
| 15 | Handle invalid image files | ✅ PASS | Graceful alert, UI remains responsive |
| 16 | Handle images containing no readable text | ✅ PASS | Friendly empty state with contrast suggestion |
| 17 | Handle large images without freezing | ✅ PASS | 2400x1400 test image without main thread block |
| 18 | Cancel an OCR operation safely | ✅ PASS | Worker termination without hanging browser |
| 19 | Mobile responsive layout (375px) | ✅ PASS | No horizontal overflow (`scrollWidth === clientWidth`) |
| 20 | Confirm zero images sent to external servers | ✅ PASS | Zero outbound requests outside localhost |
| 21 | Confirm no backend required for OCR | ✅ PASS | 0 POST requests, 100% static client-side |

### Run the Verification Suite

```bash
# 1. Generate test assets (if not already generated)
npm run generate-assets

# 2. Run the 20-scenario verification suite
npm test
```

---

## 🔒 Privacy & Security Architecture

1. **Zero External Requests**: Unlike conventional OCR tools that send user images to cloud vision APIs, this application performs all matrix multiplications and character extraction directly on the client's GPU/CPU using WebAssembly.
2. **Same-Origin Asset Delivery**: The Tesseract worker script (`worker.min.js`), WebAssembly core binary (`tesseract-core-simd-lstm.wasm`), and trained language dictionaries (`eng.traineddata.gz`, `ind.traineddata.gz`) are hosted directly on the same origin (`/tessdata` and `/tesseract`).
3. **Memory Safety**: Temporary image object URLs are explicitly revoked using `URL.revokeObjectURL()` upon replacement or reset to prevent memory leaks during long browsing sessions.
4. **Plain Text Output**: All extracted text is rendered as plain text in an accessible `<textarea>`, eliminating any XSS attack surface from untrusted OCR content.

---

## 📄 License

MIT License. Free for personal and commercial utility use.
