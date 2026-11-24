# Moduł odczytu wyników

Biblioteki do odczytu wyników badań na urządzeniu (bez wysyłania pliku do zewnętrznych usług).
Pliki ładują się dopiero przy pierwszym użyciu i nie trafiają do precache (`scripts/generuj-precache.mjs`).
Sumy kontrolne: `js/vendor/SHA256SUMS`.

| Plik | Źródło (npm) | Licencja |
| --- | --- | --- |
| `pdf.min.mjs`, `pdf.worker.min.mjs` | `pdfjs-dist` 5.7.284 (`legacy/build`) | Apache-2.0 (`pdfjs-LICENSE.txt`) |
| `tesseract.esm.min.js`, `worker.min.js` | `tesseract.js` 7.0.0 (`dist`, bez map źródeł) | Apache-2.0 (`tesseract-LICENSE.txt`) |
| `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js` | `tesseract.js-core` 7.0.0 | Apache-2.0 |
| `pol.traineddata.gz` | `@tesseract.js-data/pol` 1.0.0 (`4.0.0_best_int`) | Apache-2.0 (tessdata) |

Po podmianie plików zwiększ `CACHE_ODCZYTU` w `sw.js`.
